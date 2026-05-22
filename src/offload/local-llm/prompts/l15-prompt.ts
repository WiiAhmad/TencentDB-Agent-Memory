/**
 * L1.5 Task Judgment Prompt — migrated from context-offload-server.
 *
 * Determines task lifecycle: completion, continuation, new task detection.
 */

// ─── System Prompt ───────────────────────────────────────────────────────────

export const L15_SYSTEM_PROMPT = `You are the "task lifecycle gatekeeper" for an AI coding assistant.
Your responsibility is to cross-analyze the three provided input sources, judge the task state precisely, and output a pure JSON object.

【Input data usage guide (required reasoning path)】
1. Step 1 - Analyze recentMessages (identify intent): From the current and historical conversation, extract the core request in the user's latest reply. Decide whether it means "continue investigating", "declare completion" (for example, "it works"), "single-turn casual Q&A", or "start a brand-new requirement".
2. Step 2 - Align with currentMmd (evaluate the current baseline): Compare the user's latest intent against the full Mermaid content in currentMmd, focusing on taskGoal, each node's status (done/doing/todo), and summary. If the request is completely outside the current diagram's scope or the goal has been achieved (all nodes done with no follow-up), set taskCompleted to true. If the work is still solving a subproblem in the diagram, including a doing or todo node or an active bug fix, set it to false. If there is no currentMmd, judge whether the task continues using only the current and historical conversation.
3. Step 3 - Search availableMmds (decide continuation): If the judgment is to start a new task (isLongTask=true and taskCompleted=true/current task absent), you must scan taskGoal and time information in availableMmds. If the new request strongly overlaps with an old task in the list, such as returning to an unfinished module from yesterday, it is a continuation (isContinuation=true).

【Strict JSON output format】
Output a valid pure JSON object in this format:
{
  "taskCompleted": boolean, // Whether the current task has ended. If currentMmd is none, this must be true.
  "isLongTask": boolean,    // Whether the latest request is a complex engineering task requiring multiple steps. Set false for ordinary technical Q&A or casual chat.
  "isContinuation": boolean, // Whether this continues a historical task in availableMmds.
  "continuationMmdFile": null, // If continuing an old task, exactly fill in the filename from availableMmds without any path prefix; otherwise null.
  "newTaskLabel": null // For a brand-new long task, generate a short label (≤30 characters, kebab-case, e.g. "refactor-api"); otherwise null.
}

Output only a pure JSON object. Do not include explanatory text.`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface L15CurrentMmd {
  filename: string;
  content: string;
  path: string;
}

export interface L15MmdMeta {
  filename: string;
  path: string;
  taskGoal: string;
  doneCount: number;
  doingCount: number;
  todoCount: number;
  updatedTime?: string | null;
  nodeSummaries?: Array<{ nodeId: string; status: string; summary: string }>;
}

// ─── User Prompt Builder ─────────────────────────────────────────────────────

/**
 * Build the L1.5 user prompt for task judgment.
 * Mirrors context-offload-server/internal/service/prompt/BuildL15UserPrompt.
 */
export function buildL15UserPrompt(
  recentMessages: string,
  currentMmd: L15CurrentMmd | null,
  metas: L15MmdMeta[],
): string {
  const parts: string[] = [];

  parts.push("## 1. Recent conversation context (recent 6 messages):");
  parts.push(recentMessages);
  parts.push("\n## 2. Currently mounted task graph (Active Mermaid — full content):");

  if (currentMmd && currentMmd.filename) {
    parts.push(`**File:** ${currentMmd.filename}`);
    if (currentMmd.path) {
      parts.push(`**Path:** \`${currentMmd.path}\``);
    }
    parts.push(`\n\`\`\`mermaid\n${currentMmd.content}\n\`\`\``);
  } else {
    parts.push("(none - currently idle, no active task)");
  }

  parts.push("\n## 3. Available historical task graphs (Available Mermaid task files):");

  if (metas.length === 0) {
    parts.push("(none - no historical long tasks yet)");
  } else {
    for (const m of metas) {
      parts.push(`- **${m.filename}**`);
      parts.push(`  path: \`${m.path}\``);
      parts.push(`  taskGoal: ${m.taskGoal}`);
      const total = m.doneCount + m.doingCount + m.todoCount;
      parts.push(`  progress: ${m.doneCount}/${total} done, ${m.doingCount} doing, ${m.todoCount} todo`);
      if (m.updatedTime) {
        parts.push(`  lastUpdated: ${m.updatedTime}`);
      }
      if (m.nodeSummaries && m.nodeSummaries.length > 0) {
        parts.push("  recentNodes:");
        for (const n of m.nodeSummaries) {
          parts.push(`    - [${n.nodeId}] (${n.status}) ${n.summary}`);
        }
      }
      parts.push("");
    }
  }

  parts.push("Judge strictly according to the system instructions' three-step reasoning path, and output a valid JSON object.");
  return parts.join("\n");
}
