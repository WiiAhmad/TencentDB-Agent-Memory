# Repository English Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Translate all approved Chinese human-readable text in `TencentDB-Agent-Memory` into polished English across four path-based phases without touching `.github/**`, `_CN` files, images, or unrelated logic.

**Architecture:** Execute the translation as four isolated path-based batches so terminology stabilizes from root docs into core prompts, offload prompts, and finally scripts. Each phase starts with a CJK inventory, edits only its exact file list, runs syntax and verification commands appropriate to the touched file types, and ends with a commit that stages only that phase's files.

**Tech Stack:** Markdown, TypeScript, JSON, Bash shell scripts, Node.js/npm, Git, ripgrep, Vitest, tsdown, TypeScript compiler

---

## Preflight Rules

### Branch-only workflow

Run these commands before Phase 1 and do not create a worktree at any point:

```bash
git branch --show-current
git status --short --branch
```

Expected:
- `git branch --show-current` prints a normal branch name such as `english`
- `git status --short --branch` does not show detached `HEAD`
- if unrelated local files are present, leave them unstaged throughout the translation work

### Exclusion list

Do not modify any path under `.github/**`.

Do not modify any tracked file whose exact filename includes `_CN`:

```bash
git ls-files "*_CN*"
```

Expected:

```text
CONTRIBUTING_CN.md
README_CN.md
```

### Shared translation guardrails

Apply these rules in every phase:

```text
- Translate only human-readable Chinese text.
- Preserve filenames, command names, code identifiers, import/export names, JSON keys, YAML keys, SQL, Mermaid syntax, and env var names.
- Preserve code fences, numbered lists, Markdown tables, shell flags, path literals, and placeholders.
- In prompt files, preserve output contracts, required field names, JSON schemas, enum values, and formatting constraints.
- Rewrite mixed Chinese/English prose into polished English; do not do literal word-for-word translation.
- Do not edit .github/**, README_CN.md, or CONTRIBUTING_CN.md.
```

### Shared terminology baseline

Use the same English terms across all four phases:

```text
记忆分层 -> memory layering
符号化记忆 -> symbolic memory
上下文卸载 -> context offloading
长期记忆 -> long-term memory
短期记忆 -> short-term memory
画像 / 用户画像 -> persona / user persona
场景 / 场景块 -> scene / scene block
原始对话 -> raw conversation
原子事实 -> atomic fact
下钻 / 溯源 -> drill down / trace back
任务画布 -> task canvas
符号图谱 -> symbol graph
```

## File Map

### Phase 1 files
- `README.md` — public repository overview, benchmark explanation, installation guide, and operator-facing documentation
- `CHANGELOG.md` — release notes and change summaries
- `SKILL.md` — main skill documentation surfaced to users and agents
- `SKILL-MIGRATION.md` — migration guidance for skill consumers
- `SKILL-DIAGNOSTIC-EXPORT.md` — diagnostic export workflow documentation
- `openclaw.plugin.json` — plugin metadata and human-readable descriptive strings
- `index.ts` — plugin entrypoint with comments and user/model-facing text

### Phase 2 files
- `src/cli/README.md` — CLI usage documentation
- `src/core/hooks/auto-recall.ts` — recall hook comments and human-readable strings
- `src/core/persona/persona-generator.ts` — persona generation comments and runtime strings
- `src/core/persona/persona-trigger.ts` — persona trigger comments and runtime strings
- `src/core/prompts/l1-dedup.ts` — L1 dedup prompt contract
- `src/core/prompts/l1-extraction.ts` — L1 extraction prompt contract
- `src/core/prompts/persona-generation.ts` — persona generation prompt contract
- `src/core/prompts/scene-extraction.ts` — scene extraction prompt contract
- `src/core/record/l1-extractor.ts` — L1 record extraction comments and strings
- `src/core/scene/scene-extractor.ts` — scene extraction comments and strings
- `src/core/scene/scene-navigation.ts` — scene navigation comments and strings
- `src/core/store/sqlite.ts` — SQLite store comments and user-facing strings
- `src/core/store/tcvdb.ts` — Tencent VDB store comments and user-facing strings

### Phase 3 files
- `src/offload/types.ts` — offload type comments and explanatory text
- `src/offload/hooks/after-tool-call.ts` — hook comments and runtime strings
- `src/offload/hooks/llm-input-l3.ts` — hook comments and runtime strings
- `src/offload/index.ts` — offload entrypoint comments and strings
- `src/offload/l3-token-helpers.ts` — helper comments and runtime strings
- `src/offload/local-llm/prompts/l1-prompt.ts` — L1 summarization prompt contract
- `src/offload/local-llm/prompts/l15-prompt.ts` — L1.5 prompt contract
- `src/offload/local-llm/prompts/l2-prompt.ts` — L2 prompt contract
- `src/offload/mmd-injector.ts` — Mermaid injection comments and user/model-facing strings
- `src/utils/memory-cleaner.ts` — helper comments and runtime strings
- `src/utils/sanitize.ts` — helper comments and runtime strings
- `bin/export-tencent-vdb.mjs` — CLI wrapper comments and text
- `bin/read-local-memory.mjs` — CLI wrapper comments and text

### Phase 4 files
- `docker/opensource/README-hermes.md` — Docker deployment documentation for Hermes
- `scripts/README.memory-tencentdb-ctl.md` — operator documentation for the control script
- `scripts/bugfix-20260423/BUGFIX-20260423-SOP.md` — bugfix SOP documentation
- `scripts/bugfix-20260423/bugfix-20260423-full.sh` — shell comments and help text
- `scripts/bugfix-20260423/bugfix-20260423.sh` — shell comments and help text
- `scripts/export-diagnostic.sh` — shell comments and help text
- `scripts/export-tencent-vdb/export-tencent-vdb.ts` — script comments and runtime strings
- `scripts/install_hermes_memory_tencentdb.sh` — shell comments and help text
- `scripts/memory-tencentdb-ctl.sh` — shell comments and help text
- `scripts/migrate-sqlite-to-tcvdb/README.md` — migration script documentation
- `scripts/migrate-sqlite-to-tcvdb/sqlite-to-tcvdb.ts` — migration script comments and runtime strings
- `scripts/openclaw-after-tool-call-messages.patch.sh` — shell comments and help text
- `scripts/read-local-memory/read-local-memory.ts` — script comments and runtime strings
- `scripts/setup-offload.sh` — shell comments and help text

### Task 1: Phase 1 — Root-Level English-Facing Files

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `SKILL.md`
- Modify: `SKILL-MIGRATION.md`
- Modify: `SKILL-DIAGNOSTIC-EXPORT.md`
- Modify: `openclaw.plugin.json`
- Modify: `index.ts`
- Verify: `README_CN.md`
- Verify: `CONTRIBUTING_CN.md`
- Verify: `.github/**`

- [ ] **Step 1: Run the Phase 1 inventory**

```bash
rg -n "[一-龥]" README.md CHANGELOG.md SKILL.md SKILL-MIGRATION.md SKILL-DIAGNOSTIC-EXPORT.md openclaw.plugin.json index.ts
```

Expected: ripgrep prints matches in the listed Phase 1 files.

- [ ] **Step 2: Translate the Phase 1 Markdown files**

```text
Edit these files:
- README.md
- CHANGELOG.md
- SKILL.md
- SKILL-MIGRATION.md
- SKILL-DIAGNOSTIC-EXPORT.md

While editing:
- Keep Markdown headings, tables, links, anchor targets, and code fences intact.
- Keep links to README_CN.md or other excluded files unchanged.
- Rewrite benchmark explanations, installation notes, SOP text, and mixed Chinese/English prose into polished English.
- Preserve version numbers, command examples, filenames, and env var names exactly.
```

- [ ] **Step 3: Translate the Phase 1 metadata and entrypoint text**

```text
Edit these files:
- openclaw.plugin.json
- index.ts

While editing:
- Translate only human-readable descriptions, comments, and strings.
- Do not rename JSON keys, exported symbols, plugin identifiers, command names, or config field names.
- Keep quoting, escaping, and object structure intact.
```

- [ ] **Step 4: Verify Phase 1 before committing**

```bash
rg -n "[一-龥]" README.md CHANGELOG.md SKILL.md SKILL-MIGRATION.md SKILL-DIAGNOSTIC-EXPORT.md openclaw.plugin.json index.ts
git status --short -- .github README_CN.md CONTRIBUTING_CN.md
node -e "JSON.parse(require('node:fs').readFileSync('openclaw.plugin.json','utf8')); console.log('openclaw.plugin.json OK')"
npm run build:plugin
```

Expected:
- the first `rg` command prints no output
- `git status --short -- .github README_CN.md CONTRIBUTING_CN.md` prints no output
- Node prints `openclaw.plugin.json OK`
- `npm run build:plugin` exits with code 0

- [ ] **Step 5: Commit Phase 1 only**

```bash
git add README.md CHANGELOG.md SKILL.md SKILL-MIGRATION.md SKILL-DIAGNOSTIC-EXPORT.md openclaw.plugin.json index.ts
git commit -m "docs(i18n): translate root repository text to English"
git status --short
```

Expected: the commit succeeds and `git status --short` shows no remaining Phase 1 files.

### Task 2: Phase 2 — `src/core/**` and `src/cli/**`

**Files:**
- Modify: `src/cli/README.md`
- Modify: `src/core/hooks/auto-recall.ts`
- Modify: `src/core/persona/persona-generator.ts`
- Modify: `src/core/persona/persona-trigger.ts`
- Modify: `src/core/prompts/l1-dedup.ts`
- Modify: `src/core/prompts/l1-extraction.ts`
- Modify: `src/core/prompts/persona-generation.ts`
- Modify: `src/core/prompts/scene-extraction.ts`
- Modify: `src/core/record/l1-extractor.ts`
- Modify: `src/core/scene/scene-extractor.ts`
- Modify: `src/core/scene/scene-navigation.ts`
- Modify: `src/core/store/sqlite.ts`
- Modify: `src/core/store/tcvdb.ts`
- Verify: `README_CN.md`
- Verify: `CONTRIBUTING_CN.md`
- Verify: `.github/**`
- Verify: `package.json` scripts `build:plugin` and `test`

- [ ] **Step 1: Run the Phase 2 inventory**

```bash
rg -n "[一-龥]" src/cli/README.md src/core/hooks/auto-recall.ts src/core/persona/persona-generator.ts src/core/persona/persona-trigger.ts src/core/prompts/l1-dedup.ts src/core/prompts/l1-extraction.ts src/core/prompts/persona-generation.ts src/core/prompts/scene-extraction.ts src/core/record/l1-extractor.ts src/core/scene/scene-extractor.ts src/core/scene/scene-navigation.ts src/core/store/sqlite.ts src/core/store/tcvdb.ts
```

Expected: ripgrep prints matches in the listed Phase 2 files.

- [ ] **Step 2: Translate the Phase 2 non-prompt files**

```text
Edit these files:
- src/cli/README.md
- src/core/hooks/auto-recall.ts
- src/core/persona/persona-generator.ts
- src/core/persona/persona-trigger.ts
- src/core/record/l1-extractor.ts
- src/core/scene/scene-extractor.ts
- src/core/scene/scene-navigation.ts
- src/core/store/sqlite.ts
- src/core/store/tcvdb.ts

While editing:
- Translate comments, inline explanations, and user-facing strings.
- Keep TypeScript identifiers, SQL, schema fields, function names, and path literals unchanged.
- Preserve code formatting and line-break structure where it affects readability.
```

- [ ] **Step 3: Translate the Phase 2 prompt contracts**

```text
Edit these files:
- src/core/prompts/l1-dedup.ts
- src/core/prompts/l1-extraction.ts
- src/core/prompts/persona-generation.ts
- src/core/prompts/scene-extraction.ts

While editing:
- Preserve required output field names, JSON examples, bullet structure, numbering, and formatting rules.
- Keep canonical terms consistent with the glossary: L0 Conversation, L1 Atom, L2 Scenario, L3 Persona.
- Translate instruction text and examples into polished English without changing the contract.
```

- [ ] **Step 4: Verify Phase 2 before committing**

```bash
rg -n "[一-龥]" src/cli/README.md src/core/hooks/auto-recall.ts src/core/persona/persona-generator.ts src/core/persona/persona-trigger.ts src/core/prompts/l1-dedup.ts src/core/prompts/l1-extraction.ts src/core/prompts/persona-generation.ts src/core/prompts/scene-extraction.ts src/core/record/l1-extractor.ts src/core/scene/scene-extractor.ts src/core/scene/scene-navigation.ts src/core/store/sqlite.ts src/core/store/tcvdb.ts
git status --short -- .github README_CN.md CONTRIBUTING_CN.md
npm run build:plugin
npm test
```

Expected:
- the `rg` command prints no output
- `git status --short -- .github README_CN.md CONTRIBUTING_CN.md` prints no output
- `npm run build:plugin` exits with code 0
- `npm test` exits with code 0

- [ ] **Step 5: Commit Phase 2 only**

```bash
git add src/cli/README.md src/core/hooks/auto-recall.ts src/core/persona/persona-generator.ts src/core/persona/persona-trigger.ts src/core/prompts/l1-dedup.ts src/core/prompts/l1-extraction.ts src/core/prompts/persona-generation.ts src/core/prompts/scene-extraction.ts src/core/record/l1-extractor.ts src/core/scene/scene-extractor.ts src/core/scene/scene-navigation.ts src/core/store/sqlite.ts src/core/store/tcvdb.ts
git commit -m "refactor(i18n): translate core memory text to English"
git status --short
```

Expected: the commit succeeds and `git status --short` shows no remaining Phase 2 files.

### Task 3: Phase 3 — `src/offload/**`, `src/utils/**`, and `bin/**`

**Files:**
- Modify: `src/offload/types.ts`
- Modify: `src/offload/hooks/after-tool-call.ts`
- Modify: `src/offload/hooks/llm-input-l3.ts`
- Modify: `src/offload/index.ts`
- Modify: `src/offload/l3-token-helpers.ts`
- Modify: `src/offload/local-llm/prompts/l1-prompt.ts`
- Modify: `src/offload/local-llm/prompts/l15-prompt.ts`
- Modify: `src/offload/local-llm/prompts/l2-prompt.ts`
- Modify: `src/offload/mmd-injector.ts`
- Modify: `src/utils/memory-cleaner.ts`
- Modify: `src/utils/sanitize.ts`
- Modify: `bin/export-tencent-vdb.mjs`
- Modify: `bin/read-local-memory.mjs`
- Verify: `README_CN.md`
- Verify: `CONTRIBUTING_CN.md`
- Verify: `.github/**`
- Verify: `package.json` scripts `build:plugin` and `test`

- [ ] **Step 1: Run the Phase 3 inventory**

```bash
rg -n "[一-龥]" src/offload/types.ts src/offload/hooks/after-tool-call.ts src/offload/hooks/llm-input-l3.ts src/offload/index.ts src/offload/l3-token-helpers.ts src/offload/local-llm/prompts/l1-prompt.ts src/offload/local-llm/prompts/l15-prompt.ts src/offload/local-llm/prompts/l2-prompt.ts src/offload/mmd-injector.ts src/utils/memory-cleaner.ts src/utils/sanitize.ts bin/export-tencent-vdb.mjs bin/read-local-memory.mjs
```

Expected: ripgrep prints matches in the listed Phase 3 files.

- [ ] **Step 2: Translate the Phase 3 runtime and helper files**

```text
Edit these files:
- src/offload/types.ts
- src/offload/hooks/after-tool-call.ts
- src/offload/hooks/llm-input-l3.ts
- src/offload/index.ts
- src/offload/l3-token-helpers.ts
- src/offload/mmd-injector.ts
- src/utils/memory-cleaner.ts
- src/utils/sanitize.ts
- bin/export-tencent-vdb.mjs
- bin/read-local-memory.mjs

While editing:
- Translate comments, explanatory strings, and CLI/help text.
- Keep identifiers, env var names, node_id references, JSON keys, Mermaid syntax, and file paths unchanged.
- Preserve import/export structure and executable shebang behavior.
```

- [ ] **Step 3: Translate the Phase 3 offload prompt contracts**

```text
Edit these files:
- src/offload/local-llm/prompts/l1-prompt.ts
- src/offload/local-llm/prompts/l15-prompt.ts
- src/offload/local-llm/prompts/l2-prompt.ts

While editing:
- Preserve contract tokens such as [NEEDS_COMPRESS], tool_call_id, timestamp, score, node_id, Mermaid, and JSON array/object requirements.
- Preserve ordered rules, length constraints, and output-only instructions.
- Translate examples and instructional prose into polished English without changing the expected output shape.
```

- [ ] **Step 4: Verify Phase 3 before committing**

```bash
rg -n "[一-龥]" src/offload/types.ts src/offload/hooks/after-tool-call.ts src/offload/hooks/llm-input-l3.ts src/offload/index.ts src/offload/l3-token-helpers.ts src/offload/local-llm/prompts/l1-prompt.ts src/offload/local-llm/prompts/l15-prompt.ts src/offload/local-llm/prompts/l2-prompt.ts src/offload/mmd-injector.ts src/utils/memory-cleaner.ts src/utils/sanitize.ts bin/export-tencent-vdb.mjs bin/read-local-memory.mjs
git status --short -- .github README_CN.md CONTRIBUTING_CN.md
npm run build:plugin
npm test
```

Expected:
- the `rg` command prints no output
- `git status --short -- .github README_CN.md CONTRIBUTING_CN.md` prints no output
- `npm run build:plugin` exits with code 0
- `npm test` exits with code 0

- [ ] **Step 5: Commit Phase 3 only**

```bash
git add src/offload/types.ts src/offload/hooks/after-tool-call.ts src/offload/hooks/llm-input-l3.ts src/offload/index.ts src/offload/l3-token-helpers.ts src/offload/local-llm/prompts/l1-prompt.ts src/offload/local-llm/prompts/l15-prompt.ts src/offload/local-llm/prompts/l2-prompt.ts src/offload/mmd-injector.ts src/utils/memory-cleaner.ts src/utils/sanitize.ts bin/export-tencent-vdb.mjs bin/read-local-memory.mjs
git commit -m "refactor(i18n): translate offload and tooling text to English"
git status --short
```

Expected: the commit succeeds and `git status --short` shows no remaining Phase 3 files.

### Task 4: Phase 4 — `scripts/**`, `docker/**`, and Final Repo Sweep

**Files:**
- Modify: `docker/opensource/README-hermes.md`
- Modify: `scripts/README.memory-tencentdb-ctl.md`
- Modify: `scripts/bugfix-20260423/BUGFIX-20260423-SOP.md`
- Modify: `scripts/bugfix-20260423/bugfix-20260423-full.sh`
- Modify: `scripts/bugfix-20260423/bugfix-20260423.sh`
- Modify: `scripts/export-diagnostic.sh`
- Modify: `scripts/export-tencent-vdb/export-tencent-vdb.ts`
- Modify: `scripts/install_hermes_memory_tencentdb.sh`
- Modify: `scripts/memory-tencentdb-ctl.sh`
- Modify: `scripts/migrate-sqlite-to-tcvdb/README.md`
- Modify: `scripts/migrate-sqlite-to-tcvdb/sqlite-to-tcvdb.ts`
- Modify: `scripts/openclaw-after-tool-call-messages.patch.sh`
- Modify: `scripts/read-local-memory/read-local-memory.ts`
- Modify: `scripts/setup-offload.sh`
- Verify: `README_CN.md`
- Verify: `CONTRIBUTING_CN.md`
- Verify: `.github/**`
- Verify: `package.json` scripts `build`, `build:scripts`, and `test`

- [ ] **Step 1: Run the Phase 4 inventory**

```bash
rg -n "[一-龥]" docker/opensource/README-hermes.md scripts/README.memory-tencentdb-ctl.md scripts/bugfix-20260423/BUGFIX-20260423-SOP.md scripts/bugfix-20260423/bugfix-20260423-full.sh scripts/bugfix-20260423/bugfix-20260423.sh scripts/export-diagnostic.sh scripts/export-tencent-vdb/export-tencent-vdb.ts scripts/install_hermes_memory_tencentdb.sh scripts/memory-tencentdb-ctl.sh scripts/migrate-sqlite-to-tcvdb/README.md scripts/migrate-sqlite-to-tcvdb/sqlite-to-tcvdb.ts scripts/openclaw-after-tool-call-messages.patch.sh scripts/read-local-memory/read-local-memory.ts scripts/setup-offload.sh
```

Expected: ripgrep prints matches in the listed Phase 4 files.

- [ ] **Step 2: Translate the Phase 4 documentation files**

```text
Edit these files:
- docker/opensource/README-hermes.md
- scripts/README.memory-tencentdb-ctl.md
- scripts/bugfix-20260423/BUGFIX-20260423-SOP.md
- scripts/migrate-sqlite-to-tcvdb/README.md

While editing:
- Rewrite operator instructions and explanatory prose into polished English.
- Keep command examples, paths, version strings, environment variable names, and filenames unchanged.
- Preserve Markdown structure, tables, code fences, and ordered steps.
```

- [ ] **Step 3: Translate the Phase 4 script comments and help text**

```text
Edit these files:
- scripts/bugfix-20260423/bugfix-20260423-full.sh
- scripts/bugfix-20260423/bugfix-20260423.sh
- scripts/export-diagnostic.sh
- scripts/export-tencent-vdb/export-tencent-vdb.ts
- scripts/install_hermes_memory_tencentdb.sh
- scripts/memory-tencentdb-ctl.sh
- scripts/migrate-sqlite-to-tcvdb/sqlite-to-tcvdb.ts
- scripts/openclaw-after-tool-call-messages.patch.sh
- scripts/read-local-memory/read-local-memory.ts
- scripts/setup-offload.sh

While editing:
- Translate comments, inline help text, and human-readable log/help strings.
- Keep shell flags, exit codes, env vars, paths, SQL, and TypeScript identifiers unchanged.
- Preserve quoting, escaping, and multiline heredoc or template-string structure.
```

- [ ] **Step 4: Run the final verification sweep**

```bash
rg -n "[一-龥]" docker/opensource/README-hermes.md scripts/README.memory-tencentdb-ctl.md scripts/bugfix-20260423/BUGFIX-20260423-SOP.md scripts/bugfix-20260423/bugfix-20260423-full.sh scripts/bugfix-20260423/bugfix-20260423.sh scripts/export-diagnostic.sh scripts/export-tencent-vdb/export-tencent-vdb.ts scripts/install_hermes_memory_tencentdb.sh scripts/memory-tencentdb-ctl.sh scripts/migrate-sqlite-to-tcvdb/README.md scripts/migrate-sqlite-to-tcvdb/sqlite-to-tcvdb.ts scripts/openclaw-after-tool-call-messages.patch.sh scripts/read-local-memory/read-local-memory.ts scripts/setup-offload.sh
rg -n "[一-龥]" README.md CHANGELOG.md SKILL.md SKILL-MIGRATION.md SKILL-DIAGNOSTIC-EXPORT.md openclaw.plugin.json index.ts src/core src/cli src/offload src/utils bin scripts docker
git status --short -- .github README_CN.md CONTRIBUTING_CN.md
bash -n scripts/bugfix-20260423/bugfix-20260423-full.sh scripts/bugfix-20260423/bugfix-20260423.sh scripts/export-diagnostic.sh scripts/install_hermes_memory_tencentdb.sh scripts/memory-tencentdb-ctl.sh scripts/openclaw-after-tool-call-messages.patch.sh scripts/setup-offload.sh
npm run build
npm test
```

Expected:
- both `rg` commands print no output
- `git status --short -- .github README_CN.md CONTRIBUTING_CN.md` prints no output
- `bash -n ...` exits with code 0
- `npm run build` exits with code 0
- `npm test` exits with code 0

- [ ] **Step 5: Commit Phase 4 only**

```bash
git add docker/opensource/README-hermes.md scripts/README.memory-tencentdb-ctl.md scripts/bugfix-20260423/BUGFIX-20260423-SOP.md scripts/bugfix-20260423/bugfix-20260423-full.sh scripts/bugfix-20260423/bugfix-20260423.sh scripts/export-diagnostic.sh scripts/export-tencent-vdb/export-tencent-vdb.ts scripts/install_hermes_memory_tencentdb.sh scripts/memory-tencentdb-ctl.sh scripts/migrate-sqlite-to-tcvdb/README.md scripts/migrate-sqlite-to-tcvdb/sqlite-to-tcvdb.ts scripts/openclaw-after-tool-call-messages.patch.sh scripts/read-local-memory/read-local-memory.ts scripts/setup-offload.sh
git commit -m "docs(i18n): translate script and Docker text to English"
git status --short
```

Expected: the commit succeeds and `git status --short` shows no remaining Phase 4 files.

## Spec Coverage Check

This plan covers every approved requirement from `docs/superpowers/specs/2026-05-22-repository-english-translation-design.md`:

- four path-based phases: covered by Tasks 1-4
- polished English rewrite standard: covered by Preflight guardrails and per-task translation steps
- `.github/**` exclusion: covered by every task's verify step
- exact `_CN` filename exclusion: covered by Preflight and every task's verify step
- images excluded: no task edits image paths
- branch-only workflow: covered by Preflight branch checks and no worktree creation
- phase-only commits: covered by each task's commit step with explicit `git add` lists
- syntax/runtime safety: covered by build, test, JSON parse, and shell syntax checks

## Placeholder Scan

No task in this plan uses `TBD`, `TODO`, or implied follow-up placeholders. Every phase names exact files, exact verification commands, and an exact commit command.

## Consistency Check

The same exclusion list, glossary, and verification pattern are reused in every phase so terminology and workflow stay aligned from Phase 1 through Phase 4.
