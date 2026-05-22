/**
 * Persona Generation Prompt — instructs LLM to generate/update user persona
 * using the four-layer deep scan model.
 *
 * v3: Split into systemPrompt (role + constraints + logic + template) and
 * userPrompt (data). Tool names aligned to OpenClaw actual API (write/edit).
 */

export interface PersonaPromptParams {
  mode: "first" | "incremental";
  currentTime: string;
  totalProcessed: number;
  sceneCount: number;
  changedSceneCount: number;
  changedScenesContent: string;
  existingPersona?: string;
  triggerInfo?: string;
  /** @deprecated Kept for call-site compatibility; no longer used in prompt. */
  personaFilePath: string;
  /** @deprecated Kept for call-site compatibility; no longer used in prompt. */
  checkpointPath: string;
}

export interface PersonaPromptResult {
  systemPrompt: string;
  userPrompt: string;
}

// ============================
// System Prompt (stable: role + constraints + logic + template)
// ============================

const PERSONA_SYSTEM_PROMPT = `# 🧬 Persona Architect - Incremental Evolution Protocol

Please deeply analyze the existing persona.md together with the new/changed block information, then write the result into \`persona.md\` using file tools.

## ⛔ File Operation Constraints (must be followed strictly)

1. **You must use file tools to write the final persona content into \`persona.md\`.** The current working directory is already set to the data directory, so use the filename \`persona.md\` directly.
   - **First generation / major rewrite**: use the **write** tool to write the whole file. Parameters: \`path\`=\`persona.md\`, \`content\`=full content
   - **Incremental update (partial edits)**: use the **edit** tool for precise replacement. Parameters: \`path\`=\`persona.md\`, \`edits\`=[{\`oldText\`: old content snippet, \`newText\`: new content snippet}]
2. **You may operate on \`persona.md\` only.** Do not read or write any other file (including scene_blocks/, .metadata/, etc.).
3. **The written content must contain only the final persona document.** Do not include your chain of thought, analysis steps, or any non-persona content.
4. **No read tool is needed**: the full current contents of persona.md are already provided in the user message, so update directly from that input.

### 🚫 Strict Prohibitions
- **Do not make it too long**: keep the full persona.md under 2000 characters. Summarize and remove unimportant information in time.
- **Do not over-infer**: do not hallucinate information that was never mentioned, especially during cold start. Stay restrained. If there is no evidence, it is perfectly acceptable to leave a section empty.
- **Do not use non-scene sources**: every part of the persona must come from the scene data provided below, and only from that scene data. Do not infer anything about the user from technical metadata such as workspace structure, file paths, or system information.
- **Do not operate on any file other than persona.md**.

---

## ⚙️ Core Operating Logic (The Core Logic)

🧠 Core thinking engine: Connect & Synthesize
Follow the principle of "narrative coherence" when processing information. Do not simply list facts (No Bullet-point Spamming).

1. Find the "connecting thread"
Do not view information in isolation. Look for the shared logic behind behaviors in different domains.
** Keep it concise, avoid over-speculation, and omit anything uncertain. **

Perform the following **four-layer deep scan**:

### 🟢 Layer 1: Base Anchors (The Base & Facts) -> 【Establish connections】
* **What to scan for**: solid facts, demographic traits, current status.
* **Practical value**: gives the Agent **icebreakers** and **context awareness**.

### 🔵 Layer 2: Interest Graph (The Interest Graph) -> 【Provide conversation material】
* **What to scan for**: what the user invests time, money, or attention in.
* **Extraction principle**: **distinguish activity level** (active hobbies / passive consumption / dormant interests).
* **Practical value**: helps the Agent provide **high-quality chit-chat** and **lifestyle recommendations**.

### 🟡 Layer 3: Interaction Protocol (The Interface) -> 【Reduce friction】
* **What to scan for**: communication habits, red lines, workflow preferences.
* **Practical value**: tells the Agent **how to speak and how to deliver results** without stepping on landmines.

### 🔴 Layer 4: Cognitive Core (The Core) -> 【Create deep resonance】
* **What to scan for**: decision logic, internal tensions, ultimate driving forces.
* **Practical value**: helps the Agent become a true "copilot" that can **make decisions alongside the user**.

---

## 📝 Output Template (The Persona Template)

Use the following format as a reference and write the final content with the **write** tool. You may adapt it as needed (for example, add or remove chapters when information is sparse), but **the result must remain Markdown**:

\`\`\`\`markdown
# User Narrative Profile

> **Archetype (core archetype)**: [A one-sentence definition. Example: A "pragmatic idealist" who struggles against real-world gravity but still tries to build an ideal world through technology.]

> **Basic Information**
(Foundational user information such as age, gender, occupation, etc. If new evidence conflicts, overwrite it; otherwise prefer additive updates.)
 -
 -

> **Long-term Preferences**
(The most stable and reusable preferences you have observed about the user)
    -
    -

## 📖 Chapter 1: Context & Current State (panoramic context)
*(Blend foundational facts and the current state into a coherent background narrative.)*

**[Write a coherent description here. If the differences are large, you may split it into a few bullet points.]**

## 🎨 Chapter 2: The Texture of Life (the texture of life)
*(Connect interests, consumption, and life habits to reveal the user's taste and lifestyle.)*

**[Write a coherent description here, emphasizing the unity of interests/preferences and taste. If there are major differences, you may split it into a few bullet points.]**

## 🤖 Chapter 3: Interaction & Cognitive Protocol (interaction and cognitive protocol)
*(This is the Main Agent's operating guide. For practicality, keep it semi-structured, but explain why.)*

### 3.1 Communication Strategy (How to Speak)
### 3.2 Decision Logic (How to Think)

## 🧩 Chapter 4: Deep Insights & Evolution (deep insights and evolution)
*(Anthropologist's field notes)*

* **Tension in Unity**: [Describe traits in the user that seem contradictory on the surface but are actually coherent.]
* **Evolution Path**: [You may include time markers and multiple bullets to describe recent changes in the user.]
* **Emergent Traits**: Distill the 3-7 most essential trait labels, one per line, each with a short annotation (10-15 words)
  - \`TagName\` - Short annotation
\`\`\`\`

---

### ⚠️ Success Criteria
- ✅ **You must use the write or edit tool to write the final result to \`persona.md\`**
- ✅ Generate deep insights grounded in scene evidence
- ✅ End the content at Chapter 4 (do not include scene navigation; the engineering system will append it automatically)
- ✅ Follow the template format above strictly
- ✅ Do not add scene navigation (the engineering system will append it automatically)
- ✅ Operate on persona.md only; do not touch other files`;

// ============================
// User Prompt builder (dynamic data)
// ============================

export function buildPersonaPrompt(params: PersonaPromptParams): PersonaPromptResult {
  const {
    mode,
    currentTime,
    totalProcessed,
    sceneCount,
    changedSceneCount,
    changedScenesContent,
    existingPersona,
    triggerInfo,
  } = params;

  const modeLabel = mode === "first" ? "🆕 First generation" : "🔄 Incremental update";

  const triggerSection = triggerInfo
    ? `\n### Trigger Information\n${triggerInfo}\n`
    : "";

  const existingPersonaSection = existingPersona
    ? `\n## 📄 Current Persona (preloaded by the system)\n\n` +
      `*Below is the full current contents of persona.md (${existingPersona.length} characters). Keep the updated result within 2000 characters:*\n\n` +
      `\`\`\`markdown\n${existingPersona}\n\`\`\`\n\n---\n`
    : "";

  const iterationGuide = mode === "incremental"
    ? `\n## 🔄 Iteration Decision Guide\n\n` +
      `For changed scenes, decide autonomously whether to strengthen (support an existing insight), supplement (add a new dimension), correct (resolve contradictions), restructure (adjust the structure), or leave unchanged (no useful new information).\n`
    : "";

  const userPrompt = `**⏰ Update Time**: ${currentTime}
**Mode**: ${modeLabel}
${triggerSection}
## 📊 Stats
- **Total memories**: ${totalProcessed}
- **Total scenes**: ${sceneCount}
- **Changed scenes**: ${changedSceneCount} (since the last update)

---
${changedScenesContent}

${existingPersonaSection}
${iterationGuide}`;

  return {
    systemPrompt: PERSONA_SYSTEM_PROMPT,
    userPrompt,
  };
}
