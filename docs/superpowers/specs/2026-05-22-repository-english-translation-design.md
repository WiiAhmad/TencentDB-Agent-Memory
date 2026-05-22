# Repository English Translation Design

**Date:** 2026-05-22  
**Repository:** `TencentDB-Agent-Memory`

## Goal

Translate the repository into polished, idiomatic English across all included human-readable text so the project presents a consistent English-first experience for docs, prompts, comments, scripts, and user-facing text.

## Non-Goals

- Do not translate any file whose exact filename includes `_CN`.
- Do not translate anything under `.github/`.
- Do not edit images, screenshots, or other visual assets.
- Do not make logic changes unrelated to translation.
- Do not switch to a worktree; all work stays on a normal branch.

## Included Scope

Translate human-readable Chinese text in these areas when present:

- Root-level English-facing files such as `README.md`, `CHANGELOG.md`, `SKILL.md`, `SKILL-MIGRATION.md`, `SKILL-DIAGNOSTIC-EXPORT.md`, `openclaw.plugin.json`, and `index.ts`
- `src/core/**`
- `src/cli/**`
- `src/offload/**`
- `src/utils/**`
- `bin/**`
- `scripts/**`
- `docker/**`

This includes:

- Markdown prose
- Code comments
- Prompt strings
- JSON or YAML descriptive text
- Shell-script comments
- CLI or operator-facing help text
- Inline explanatory strings that are meant for people or models to read

## Translation Standard

Use polished English rewrites rather than literal translation. The output should read naturally to English-speaking developers while preserving the original technical meaning.

Preserve without semantic drift:

- code blocks
- shell syntax
- JSON keys and structural fields
- placeholders and variables
- escaping and quoting
- prompt structure where wording changes could affect runtime behavior

Small string-safe edits are allowed when required to keep syntax valid after translation.

## Repo Facts Used For Scope

Current branch at design time: `english`

Observed translation-bearing files outside exclusions include root docs, prompt files under `src/core/**` and `src/offload/**`, source comments in `src/utils/**`, operator docs and script comments under `scripts/**`, CLI docs under `src/cli/**`, bin wrapper text, Docker docs, and package-facing text in root files.

The highest Chinese density is in `scripts/**`, followed by prompt and comment text in `src/**`.

## Phased Execution Design

### Phase 1: Root-Level English-Facing Files

Translate top-level, non-`_CN` files that shape the public repository experience.

Primary targets:

- `README.md`
- `CHANGELOG.md`
- `SKILL.md`
- `SKILL-MIGRATION.md`
- `SKILL-DIAGNOSTIC-EXPORT.md`
- `openclaw.plugin.json`
- `index.ts`
- any other root text file with Chinese outside excluded paths

Why first:

- establishes terminology for later phases
- improves first-contact repository UX immediately
- creates a base glossary for prompts and scripts

### Phase 2: `src/core/**` and `src/cli/**`

Translate core pipeline comments, prompt text, and CLI-facing docs.

Primary targets:

- `src/core/hooks/**`
- `src/core/persona/**`
- `src/core/prompts/**`
- `src/core/record/**`
- `src/core/scene/**`
- `src/core/store/**`
- `src/cli/README.md`

Why second:

- centralizes terminology in the concept-heavy core memory flow
- reduces inconsistent wording before offload-layer prompt work
- keeps core behavior-sensitive prompts reviewed together

### Phase 3: `src/offload/**`, `src/utils/**`, and `bin/**`

Translate offload prompts, helper comments, hook text, and bin wrapper text.

Primary targets:

- `src/offload/**`
- `src/utils/**`
- `bin/**`

Why third:

- isolates behavior-sensitive prompt rewrites into their own review boundary
- keeps helper/comment cleanup near the offload subsystem that uses it
- allows consistency checks against terminology already set in Phases 1 and 2

### Phase 4: `scripts/**`, `docker/**`, and Final Repo Sweep

Translate script comments, operator docs, setup notes, and Docker-facing documentation, then run a repo-wide included-path sweep.

Primary targets:

- `scripts/**`
- `docker/**`
- any included files missed by earlier phases

Why last:

- `scripts/**` has the largest raw Chinese footprint
- script translations benefit from stabilized terminology from earlier phases
- the final sweep can normalize wording and catch leftovers without touching exclusions

## Phase Workflow

Each phase follows the same workflow:

1. Inventory in-scope files for the phase that still contain Chinese text.
2. Translate only those files within the approved phase paths.
3. Preserve formatting and syntax while rewriting to polished English.
4. Run targeted verification for that phase.
5. Stage only the files changed in that phase.
6. Create one phase-specific commit on the current branch.

## Verification Rules

For every phase:

- run a scoped CJK search on that phase's included paths to confirm coverage
- verify `.github/**` was not changed
- verify files with `_CN` in the exact filename were not changed
- sanity-check translated code, prompts, JSON, and shell content for syntax integrity
- review terminology against earlier phases for consistency

Phase 4 additionally runs a repo-wide included-path CJK scan to catch leftovers.

## Commit Strategy

- Stay on a normal branch only; do not use a worktree.
- Use one commit per phase.
- Stage only the files changed in the current phase.
- Do not batch multiple phases into one commit.
- Do not include excluded paths in any phase commit.

## Risks and Controls

### Prompt Behavior Drift

Risk: aggressive rewrites could change model-facing instructions.

Control: keep prompt structure, constraints, examples, and formatting stable while rewriting wording into natural English.

### Syntax Breakage

Risk: translated strings in TypeScript, JSON, or shell files may break quoting or escaping.

Control: perform per-phase syntax sanity checks and keep string-safe edits minimal and localized.

### Terminology Drift Across Phases

Risk: the same concept may be translated differently in docs, prompts, and scripts.

Control: establish terminology in Phase 1 and keep a consistent vocabulary through later phases, with Phase 4 as the normalization pass.

### Scope Creep

Risk: translation work expands into unrelated refactoring or visual asset replacement.

Control: restrict edits to human-readable text in included paths and preserve all approved exclusions.

## Success Criteria

The project is ready to move from design to implementation planning when the plan can guarantee all of the following:

- included human-readable Chinese text is translated to polished English in the four approved path-based phases
- `.github/**` remains untouched
- exact `_CN` filenames remain untouched
- images remain untouched
- each phase has a clean verification boundary and a phase-only commit strategy
- translation work preserves runtime behavior and syntax integrity
