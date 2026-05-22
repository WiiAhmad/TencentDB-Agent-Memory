/**
 * L1 Conflict Detection Prompt (Batch Mode)
 *
 * Based on Kenty's validated prototype prompt (l1_conflict_detection_prompt.md).
 * Batch-compares multiple new memories against a unified candidate pool,
 * supporting cross-type merge and multi-target operations.
 */

import type { MemoryRecord, ExtractedMemory } from "../record/l1-writer.js";

// ============================
// System Prompt
// ============================

export const CONFLICT_DETECTION_SYSTEM_PROMPT = `You are a memory conflict detector. Compare each item in 【New Memories】 against the existing memories in the 【Unified Candidate Memory Pool】 and decide how to handle them one by one.

## Core Rules

- **Cross-type merge**: Memories with different types (persona / episodic / instruction) may still be **merged** if they semantically describe the same fact or event.
- **Many-to-many merge**: A single new memory may replace or merge with **multiple** existing memories in the candidate pool at the same time (specified through the target_ids array).
- After merging, you must decide the best resulting type for the new memory (merged_type).

## Decision Logic

1. **Identify the memory category**:
   - **State-like memories** (persona/instruction): preferences, traits, long-term settings, relatively stable facts, behavior rules
   - **Event-like memories** (episodic): one-off experiences, objective records tied to a point in time; when appropriate, merge the cause and effect of the same event

2. **Judge whether they describe the same fact/event**: same subject, same topic, close time, similar scene_name

3. **Choose an action**:
   - "store": Treat it as new information and store the current memory.
   - "skip": The existing memory is better; the new memory adds nothing or is vaguer, so ignore the current memory.
   - "update": Same fact/event, but the new memory is better in content or time (more specific, more recent, or a correction). Use the new memory as the primary version while preserving any still-correct details from the old memory.
   - "merge": Same fact or same evolution process; multiple memories are complementary and non-contradictory, so combine them into one more complete memory with as little redundancy as possible.

4. **Strategy tendencies**:
   - State-like memories: multiple descriptions of the same preference/trait → prefer merge; no added value → skip; explicit update → update
   - Event-like memories: cause/effect or different stages of the same event → prefer merging into one complete account; completely identical → skip
   - Cross-type example: an episodic memory "The user started podcasting in 2018" plus a persona memory "The user has podcast production experience" → may be merged into either persona or episodic depending on the emphasis of the combined information

5. **timestamp handling**:
   - For merge / update, merged_timestamps should contain the **union of all related memory timestamps**, deduplicated and sorted
   - This preserves the full timeline of when the event occurred

## Output Format

Output a JSON array strictly and nothing else. Each element corresponds to the decision for one new memory:

[
  {
    "record_id": "record_id of the new memory",
    "action": "store|update|skip|merge",
    "target_ids": ["record_id 1 of the candidate memory to remove", "record_id 2"],
    "merged_content": "Merged/updated memory content (required for merge/update)",
    "merged_type": "Best resulting type after merge: persona|episodic|instruction (required for merge/update)",
    "merged_priority": 85,
    "merged_timestamps": ["Merged timestamp array containing the union of all new and old memory timestamps (required for merge/update)"]
  }
]

Field notes:
- target_ids: an **array** of old memory IDs to replace/remove (one or many). Omit or leave empty for store/skip.
- merged_content: the final memory text for merge/update. Omit for store/skip.
- merged_type: the type the merged/updated memory should belong to. Judge it from the essence of the merged content.
- merged_priority: the new priority after merge/update (integer 0-100, required for merge/update). Because merged information is usually more complete and more certain, priority should often be **raised appropriately** (for example, merging two priority-70 memories may justify raising it to 80). Reference scale: 80-100 (core traits / important events), 60-79 (general preferences / ordinary activities), <60 (minor information).
- merged_timestamps: the merged timestamp array. Collect timestamps from the new memory and all merged old memories, then deduplicate and sort them.`;

// ============================
// Prompt Builder
// ============================

/**
 * Candidate search result for a single new memory.
 */
export interface CandidateMatch {
  newMemory: ExtractedMemory & { record_id: string };
  candidates: MemoryRecord[];
}

/**
 * Format the batch conflict detection prompt using a unified candidate pool.
 *
 * Format (aligned with prototype):
 * 1. Unified candidate pool: de-duplicated list of all existing candidates across all new memories
 * 2. Per new memory: content + list of related candidate IDs from the pool
 *
 * This approach lets the LLM see the global picture and handle cross-memory dedup in one pass.
 *
 * @param matches - Array of new memories with their candidate matches
 */
export function formatBatchConflictPrompt(matches: CandidateMatch[]): string {
  // Step 1: Build unified candidate pool (de-duplicate across all new memories)
  const unifiedPool = new Map<string, MemoryRecord>();
  const perMemoryCandidateIds = new Map<string, string[]>();

  for (const m of matches) {
    const candidateIds: string[] = [];
    for (const c of m.candidates) {
      if (!unifiedPool.has(c.id)) {
        unifiedPool.set(c.id, c);
      }
      candidateIds.push(c.id);
    }
    perMemoryCandidateIds.set(m.newMemory.record_id, candidateIds);
  }

  // Step 2: Format unified pool as JSON
  const poolList = Array.from(unifiedPool.values()).map((c) => ({
    record_id: c.id,
    content: c.content,
    type: c.type,
    priority: c.priority,
    scene_name: c.scene_name,
    timestamps: c.timestamps,
  }));

  let poolSection: string;
  if (poolList.length === 0) {
    poolSection = "## Unified Candidate Memory Pool\n\n(Empty. There are no existing memories, so all new memories should be stored directly.)";
  } else {
    const poolStr = JSON.stringify(poolList, null, 2);
    poolSection = `## Unified Candidate Memory Pool (${poolList.length} existing memories total)\n\n${poolStr}`;
  }

  // Step 3: Format each new memory with its related candidate IDs
  const memoryParts = matches.map((m, idx) => {
    const relatedIds = perMemoryCandidateIds.get(m.newMemory.record_id) ?? [];
    const relatedNote =
      relatedIds.length > 0
        ? JSON.stringify(relatedIds)
        : "[] (No similar candidates; store directly)";

    const memStr = JSON.stringify(
      {
        record_id: m.newMemory.record_id,
        content: m.newMemory.content,
        type: m.newMemory.type,
        priority: m.newMemory.priority,
        scene_name: m.newMemory.scene_name,
      },
      null,
      2,
    );

    return `### New Memory ${idx + 1} (record_id: ${m.newMemory.record_id})\n${memStr}\n\n[Related Candidate IDs] ${relatedNote}`;
  });

  const newMemoriesText = memoryParts.join(
    "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n",
  );

  // Step 4: Assemble final prompt
  return `${poolSection}

${"═".repeat(50)}

## New Memories to Evaluate (${matches.length} total)

${newMemoriesText}

Evaluate them one by one and output the decision JSON array. If a new memory has an empty candidate list, output action=store for that item directly.`;
}
