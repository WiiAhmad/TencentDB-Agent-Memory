/**
 * L2 MMD Generation Prompt — migrated from context-offload-server.
 *
 * Generates/updates Mermaid flowchart diagrams from offload entries.
 */

// ─── System Prompt ───────────────────────────────────────────────────────────

export const L2_SYSTEM_PROMPT = `You are an extremely pragmatic AI task-topology architect and visual storyteller.
Your core logic is to express as much information as possible with as few characters as possible so the LLM can understand it. This is not for human presentation; minimize useless visual symbols. Your task is to elevate low-level tool-call records into a highly semantic, expressive, and extremely restrained Mermaid (flowchart TD) cognitive state machine. Based on the current task and intent, summarize the "past", consider how the "future" can use the existing information (only record existing information; do not write next-step plans), and mark danger zones. Keep the diagram highly summarized.

【Advanced cognition and topology guide (your autonomy and minimalism principles)】
1. Flexible aggregation: You have full autonomy to decide whether to split or merge nodes. For consecutive routine actions with the same intent, such as reading several files to understand context, prefer merging them into one macro node; keep key turning points or major discoveries as separate nodes. The chart must remain high-level and restrained, never a detailed chronological log.
2. Cognitive tombstones (avoid repeating mistakes): For dead ends that are completely unworkable or abandoned approaches that caused serious errors, you may create warning nodes (status: done, with the summary explaining the blockage). Do not record low-value failure information.
3. Conclusion-oriented summaries: A node's summary (preferably under 150 characters) should focus on "what conclusion was reached" or "what substantive change happened", not list trivial data or parameters. Keep the minimalism principle.
4. Be factual. Your job is to record and summarize what has already happened, not to plan future concrete operations. Do not write nodes for events that have not happened. Recorded nodes must have corresponding message sources, marked with node_id.
【Symbols as semantics: high-dimensional cognitive dictionary (your core tool)】To compress tokens aggressively and provide cognitive anchors for your next reasoning step, freely use different MMD shapes to represent different node logic. Let shapes speak for you and omit redundant textual description.

【Highly flexible topology and minimalism rules】
1. Semantic condensation: Since shapes already express the "domain", your summary must be extremely concise (≤150 characters), such as "deadlock found", "dependency conflict", or "fixed".
2. Flexible topology: Freely use labeled edges (-->|test failed|) and dotted lines (-.->|reference|) to build dependency trees and hypothesis-validation loops. Do not keep a chronological log.
3. Dynamic updates (token-minimal):
   - replace (incremental adjustment): Use when only changing existing node status, timestamps, short text, or appending very few nodes.
   - write (full rewrite): Use when logic is substantially reshuffled, the chart is restructured, or the chart is initialized.
Note: Each line in Existing Mermaid content starts with a line-number marker, such as "L1: ...". These line numbers are only for reference in replace mode and are not part of the MMD content.

【Strict engineering baseline】
1. Standard node format: NodeID["Stage name: macro action summary<br/>status: done|doing|todo <br/>summary: core conclusion summary<br/>Timestamp: ISO8601"]
2. Complete source mapping: Every new input tool_call_id must be assigned to a Node ID in node_mapping. Every node in the MMD should have a source tool_call message; do not invent sources, and never omit any. Node_id and tool_call_id are one-to-many.
3. Use aggregation wherever possible to keep the updated MMD file under 4000 characters.

【Strict timestamp and metadata rules】
1. Top metadata (required): %%{ "taskGoal": "one-sentence summary of this task's goal (may be updated dynamically)", "progress（0-100）": "progress percentage (be strict; use 90+ only when almost certainly complete)", "createdTime": "ISO time", "updatedTime": "ISO time" }%%. updatedTime must be the latest time among the nodes.
2. Node timestamps: If multiple new entries are merged, the node's Timestamp must use the latest ISO time among them.

【Strict JSON output format】
Correctly escape double quotes. All Mermaid code, whether in mmd_content or replace_blocks.content, must be wrapped in \`\`\`mermaid ... \`\`\` code fences. Use the exact string "replace" or "write" for file_action. The example below illustrates replace mode:
{
  "file_action": "replace",
  "mmd_content": null,
  "replace_blocks": [
    {
      "start_line": "Starting line number of the update range (integer, corresponding to the L marker in Existing Mermaid content)",
      "end_line": "Ending line number of the update range (integer, inclusive). To insert new content before a line without deleting any line, set start_line to that line number and end_line to start_line - 1",
      "content": "Replacement content without line-number prefixes, wrapped in \`\`\`mermaid ... \`\`\`"
    }
  ],
  "node_mapping": {
    "tool_call_id_1": "N1",
    "tool_call_id_2": "N1"
  }
}

Output only a pure JSON object. Do not include any explanation.`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface L2NewEntry {
  toolCallId: string;
  toolCall: string;
  summary: string;
  timestamp: string;
}

// ─── User Prompt Builder ─────────────────────────────────────────────────────

/**
 * Build the L2 user prompt for MMD generation.
 * Mirrors context-offload-server/internal/service/prompt/BuildL2UserPrompt.
 */
export function buildL2UserPrompt(opts: {
  existingMmd: string | null;
  entries: L2NewEntry[];
  recentHistory: string | null;
  currentTurn: string | null;
  taskLabel: string;
  mmdPrefix: string;
  charCount: number;
}): string {
  const { existingMmd, entries, recentHistory, currentTurn, taskLabel, mmdPrefix, charCount } = opts;
  const parts: string[] = [];

  // History section
  if (recentHistory) {
    parts.push(`## Recent conversation history:\n${recentHistory}`);
  } else {
    parts.push("## Recent conversation history:\n(no available history)");
  }

  if (currentTurn) {
    parts.push(`\n## Current latest turn:\n${currentTurn}`);
  }

  parts.push(`\n## MMD prefix: ${mmdPrefix}`);
  parts.push(`(All node IDs must start with this prefix, e.g. ${mmdPrefix}-N1, ${mmdPrefix}-N2...)`);
  parts.push(`\n## Current task label: ${taskLabel}`);

  // Char count warning
  if (charCount > 2500) {
    parts.push(`\n## Current MMD size: ${charCount} chars (budget: 4000 chars)`);
    parts.push("⚠ Near the limit. Aggressively merge nodes and shorten summary fields; prefer replace-mode adjustments over full write rewrites.");
  } else if (charCount > 2000) {
    parts.push(`\n## Current MMD size: ${charCount} chars (budget: 4000 chars)`);
    parts.push("Control growth and merge similar nodes.");
  }

  // Existing MMD with line numbers
  parts.push("\n## Existing Mermaid content:");
  if (existingMmd) {
    const lines = existingMmd.split("\n");
    for (let i = 0; i < lines.length; i++) {
      parts.push(`L${i + 1}: ${lines[i]}`);
    }
  } else {
    parts.push("(empty — create new)");
  }

  // New entries
  parts.push("\n## New offload entries to incorporate:");
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    parts.push(`${i + 1}. [${e.toolCallId}] ${e.toolCall} → ${e.summary} (${e.timestamp})`);
  }

  parts.push("\nGenerate or update the Mermaid flowchart according to the system instructions, and output a valid JSON object including node_mapping.");
  return parts.join("\n");
}
