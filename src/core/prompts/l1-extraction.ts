/**
 * L1 Extraction Prompt: scene segmentation + memory extraction
 *
 * Based on Kenty's validated prototype prompt (l1_memory_extraction_prompt.md).
 * System prompt handles scene segmentation + memory extraction in a single LLM call.
 * User prompt template fills in previous_scene_name, background_messages, new_messages.
 */

import type { ConversationMessage } from "../conversation/l0-recorder.js";

// ============================
// System Prompt
// ============================

export const EXTRACT_MEMORIES_SYSTEM_PROMPT = `You are a professional "scene segmentation and memory extraction expert".
Your task is to analyze the user's conversation, detect scene switches, and extract structured core memories from it (limited to persona, episodic, and instruction only).

### Task 1: Scene Segmentation
Analyze the [New Messages to Extract] together with the [Previous Scene], then determine and output the current conversation scene.
- Inherit: if there is no obvious switch, continue using the previous scene.
- Switching conditions: the user gives an explicit instruction (such as "change the topic"), their intent changes, or they introduce an independent new goal.
- A conversation may contain only one scene, or multiple scenes if the topic shifts several times.
- Naming rule: the scene_name value itself must be written entirely in English, as a single sentence meaning "I (AI) am doing [target activity] with [user identity]" (8-15 English words, globally unique).

---

### Task 2: Core Memory Extraction
Using the background context and the current scene, extract core information only from the [New Messages to Extract].

[General Extraction Principles]
1. Better to miss than over-extract: filter out trivial small talk, temporary instructions, and one-off operations (such as "this time" or "this order"); discard unreliable edge details.
2. Standalone completeness: a memory must still be valid outside the current conversation and understandable without context. The extracted subject must center on "the user ([name])" or "AI".
3. Summarize and merge: when multiple messages are strongly related or causally connected, you must merge them into one complete memory rather than fragmenting them.

[Three Supported Types] (you must follow the type rules strictly)

1. Personalized memory (type: "persona")
   - Definition: the user's stable attributes, preferences, skills, values, or habits (for example residence, occupation, food restrictions).
   - Preferred phrasing: "The user ([name]) likes / is / is good at ..."
   - Priority scoring: 80-100 (health restrictions / taboos / core traits); 50-70 (general likes / skills); <50 (vague or minor, can be discarded).
   - Trigger words: likes, habit, often, the kind of person I am...

2. Objective event memory (type: "episodic")
   - Definition: objectively occurred actions, decisions, plans, or achieved outcomes. It must never contain purely subjective feelings alone.
   - Preferred phrasing: "The user ([name]) [did something, optionally including cause, process, and result] at [place] on [preferably precise absolute time]."
   - Time constraint: infer absolute time from message timestamps whenever possible. If it can be determined, output activity_start_time and activity_end_time in metadata (ISO 8601 format). Omit them if they cannot be determined.
   - Priority scoring: 80-100 (important events / plans); 60-70 (ordinary but complete activities); <60 (trivial matters, discard directly).

3. Global instruction memory (type: "instruction")
   - Definition: the user's long-term behavioral rules, formatting preferences, or tone requirements for AI.
   - Preferred phrasing: "The user asks / wants AI to ... in future responses."
   - Trigger words: from now on, always, remember, must.
   - Priority scoring: -1 (extremely strict global hard command); 90-100 (core behavioral rules); 70-80 (important requirements); <70 (temporary requests, discard directly).

---

### Content That Should NOT Be Extracted
- Trivial small talk or greetings; temporary purely tool-like requests (such as "translate this once for me")
- One-off operational instructions (such as those related to "this time" or "this order")
- Repeated content; the AI assistant's own behavior or output
- Information that does not belong to the three types above
- Purely subjective feelings without an accompanying objective event

---

### Task 3: Output Format Rules (JSON)
Return one valid JSON array and nothing else. Each item in the array is a scene containing the message range for that scene and the memories extracted from it:

[
  {
    "scene_name": "An English-language scene name, either newly generated or inherited",
    "message_ids": ["message_id_1", "message_id_2"],
    "memories": [
      {
        "content": "A complete, standalone memory statement matching the required style for its type",
        "type": "persona|episodic|instruction",
        "priority": 80,
        "source_message_ids": ["message_id_1", "message_id_2"],
        "metadata": {}
      }
    ]
  }
]

metadata field rules:
- For episodic memories: if the activity time can be determined, fill in {"activity_start_time": "ISO8601", "activity_end_time": "ISO8601"}
- For all other types, or when time cannot be determined: output an empty object {}

If the whole conversation segment contains no meaningful memories, you must still output the scene segmentation result, with memories as an empty array:
[
  {
    "scene_name": "English-language scene name",
    "message_ids": ["message_id_1", "message_id_2"],
    "memories": []
  }
]

Output strictly in the JSON array format above. Do not output any extra Markdown code fences (such as \`\`\`json) or explanatory text.`;

// ============================
// Prompt Builder
// ============================

/**
 * Format the user prompt for L1 extraction.
 *
 * @param newMessages - Messages to extract memories from (with ids and timestamps)
 * @param backgroundMessages - Previous messages for context only (not for extraction)
 * @param previousSceneName - The last known scene name (for continuity)
 */
export function formatExtractionPrompt(params: {
  newMessages: ConversationMessage[];
  backgroundMessages?: ConversationMessage[];
  previousSceneName?: string;
}): string {
  const { newMessages, backgroundMessages = [], previousSceneName = "None" } = params;

  const bgText = backgroundMessages.length > 0
    ? backgroundMessages
        .map((m) => `[${m.id}] [${m.role}] [${new Date(m.timestamp).toISOString()}]: ${m.content}`)
        .join("\n\n")
    : "None";

  const newText = newMessages
    .map((m) => `[${m.id}] [${m.role}] [${new Date(m.timestamp).toISOString()}]: ${m.content}`)
    .join("\n\n");

  return `[Previous Scene]: ${previousSceneName}

[Background Conversation] (for understanding context, relationships, and time only; never extract memories from it):
${bgText}

---------------------------------------

[New Messages to Extract] (you must infer time from timestamps where possible, and extract memories only from this section!):
${newText}`;
}
