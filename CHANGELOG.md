# Changelog

This file records all notable changes to the `@tencentdb-agent-memory/memory-tencentdb` plugin. The format follows [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/), and version numbers follow [Semantic Versioning](https://semver.org/).

---

## [0.3.5] - 2026-05-15

### 🐛 Fixes

- **Compatible with OpenClaw v2026.5.7 zod v4 subpath**: explicitly declare a `zod@^4.4.3` dependency to fix the runtime `Cannot find module zod/v4` error that occurs when `@ai-sdk/provider-utils@4.x` requires the `zod/v4` subpath export but the host environment may hoist zod@3.x.

### ✨ Improvements

- **L1→L2 delay reduced from 90s to 10s**: `l2DelayAfterL1Seconds` default changed from 90 to 10, so cold-start users no longer need to wait ~90s to see L2 scene extraction results.

### 📖 Documentation

- Added a Docker Quick Start section to the README, explaining how to configure model URL/Name environment variables.

---

## [0.3.4] - 2026-05-12

### 🐛 Fixes

- **Compatible with empty L1 extraction output on OpenClaw versions earlier than v2026.4.7**: older hosts do not support `systemPromptOverride`, so the system prompt now falls back to `extraSystemPrompt` to ensure the LLM works as a data extraction assistant.
- **Redundant double HTTP calls in TCVDB hybrid recall**: `auto-recall` sent two identical `hybridSearch` requests to TCVDB, and the keyword path incorrectly passed the FTS5 OR expression into the BM25 encoder. Added a `nativeHybridSearch` short-circuit so TCVDB completes dense + sparse + RRF in a single call, cutting recall latency in half (~50-120ms).
- **L2 parser aligned with the Go backend**: added Mermaid fallback and fixed the `first{...last}` JSON extraction logic.

### ✨ Improvements

- **VDB HTTP request-level timing**: `tcvdb-client` now logs one info timing line per request (`/document/hybridSearch 85ms`), while retry/failure details remain at debug level.
- **Misleading startup-path logs downgraded to DEBUG**: normal scenarios such as store manifest mismatch, sqlite schema migration, and profile-sync MD5 mismatch no longer emit warn/info logs, avoiding AI misdiagnosis.
- **L1 extraction debug logs**: added the `[l1-debug]` series (RESOLVE / INVOKE / RESULT / EMPTY_DUMP / ENTRY / NO_JSON) to help locate LLM call-chain issues.

### 🔧 Compatibility adaptations

- **OC 2026.4.23 Zod schema compatibility patch script** (`scripts/bugfix-20260423/`): one-command fix for `allowConversationAccess` being rejected by `.strict()`, including a lightweight script, fully automatic script, and manual SOP documentation.
- Removed the `Backend` prefix from Offload logs, and set the default timeout to 120s.

### 📦 New features

- **Offload Local Mode**: supports running offload in local mode without depending on a remote backend.
- **Integrated Docker image** (`Dockerfile.hermes`): single container bundling Hermes Agent + memory_tencentdb plugin + TDAI Memory Gateway, driven by unified `MODEL_*` environment variables.

### ✅ Tests

- Fixed `fault-injection` FI-05 mock config missing the `embedding` field
- Fixed `cli.test` dependency assertions for the newly added dependency
- Skipped the `patch-effectiveness` test for deleted `install-plugin.sh`

---

## [0.3.3] - 2026-05-08

### 🐛 Fixes

- **Hardened hook-policy version decision logic**: automatically writes `hooks.allowConversationAccess` only when the host version is a strict `x.y.z` semantic version and is `>= 2026.4.24`; unparseable versions (such as `unknown`, beta, snapshot, or other non-standard versions) are always skipped to avoid writing invalid configuration for old or unexpected versions and causing startup failure.
- Added debug logs for key hook-policy paths (raw version string, parsed version, minimum required version, and patch decision) to simplify production troubleshooting.

### ✅ Tests

- Added `src/utils/ensure-hook-policy.test.ts`, covering standard versions, prereleases, `unknown`, boundary values, and related decision cases.

## [0.3.2] - 2026-05-08

### 🐛 Fixes

- Compatible with OpenClaw versions before v2026.4.23; prevents written hook configuration from causing startup failure
- Changed `allowConversationAccess` so it is added only for 2026.4.24+.

## [0.3.1-beta.1] - 2026-05-07

### 🐛 Fixes

- **Compatible with OpenClaw v2026.4.23+ hook permission policy**: this version introduced the `allowConversationAccess` security gate ([openclaw#70786](https://github.com/openclaw/openclaw/pull/70786)), causing the `agent_end` hook for non-bundled plugins to be silently blocked and breaking the entire capture pipeline. Added `ensurePluginHookPolicy()` to detect and complete configuration automatically, preferably triggering gateway auto-restart through the SDK and falling back to manually writing the config file.
- **Compatible with OpenClaw 2026.5.3+ installation validation**: added tsdown build configuration to generate `dist/index.mjs`, satisfying the newer installation requirement for compiled artifacts (pure TypeScript entrypoints are no longer accepted).
- **Declared `activation.onStartup`**: ensures the gateway loads this plugin at startup.
- **Declared `contracts.tools`**: registers the tool names `tdai_memory_search` and `tdai_conversation_search`, satisfying the tool registration contract.

---

## [0.3.0] - 2026-05-06

### 🚀 New features

**Operations management tool (CTL)**

- Added the `memory-tencentdb-ctl` command-line management tool, supporting both standalone and hermes modes
- Added the `install-memory-tencentdb` one-click installation script
- Added the `config vdb-off` command to CTL, allowing Gateway storage to fall back from VDB to SQLite
- Gateway installation script supports writing environment variables to `~/.hermes/.env` (systemd scenarios)

**Offload enhancements**

- Automatically applies the `after_tool_call` patch when Offload starts, and automatically disables offload if the patch fails
- Added the `setup-offload.sh` one-click enable/disable script for offload, with `--backend-api-key` support
- L0 capture filtering: excludes MMD context blocks injected by offload, avoiding accidental storage of intermediate compression artifacts as memories

**Gateway self-healing and stability**

- Added watchdog + lazy probe mechanism to the Hermes plugin, automatically recovering Gateway failures
- Gateway YAML configuration parsing supports arbitrary nesting depth

### ✨ Improvements

- Unified data and installation directories under `~/.memory-tencentdb/`
- Introduced the `$HERMES_HOME` environment variable convention and removed the hard-coded `~/.hermes` path
- CTL hermes configuration editing is now indentation-aware and preserves original file formatting
- Operations scripts remain in the tarball but are no longer registered as bin commands, reducing global command pollution
- init/destroy lifecycle logs downgraded to debug level
- Patch script is compatible with pnpm installations and uses Node.js to dynamically resolve the openclaw installation path

### 🐛 Fixes

**Core stability**

- Fixed race conditions when `ensureSchedulerStarted` is called concurrently
- Fixed `/session/end` incorrectly destroying the global scheduler (now scoped by `session_key`)
- Fixed store shutdown not waiting for background fire-and-forget tasks to finish
- Fixed `disable_offload` not correctly removing the `slots.contextEngine` configuration

**Offload**

- Fixed slot occupancy detection: reject only when `ok=false` (slot occupied), and no longer misjudge API exceptions as conflicts
- Fixed offload not being disabled when `registerContextEngine` throws
- Fixed all offload features not being fully disabled when the slot is occupied

**L3 compression**

- Fixed aggressive/emergency compression getting stuck when the user message is at the head of the queue
- Fixed compression stalling after many messages are offloaded

**Migration tools**

- Fixed migration script crash when the source data directory or SQLite database does not exist (now skips gracefully)
- Fixed config/manifest not being written when source data is empty

**Scripts and operations**

- Fixed `((VAR++))` causing script exit under `set -e` when VAR=0
- Fixed patch script false-reporting FAILED count (skips candidates without an after_tool_call context)
- Fixed Gateway subprocess not being terminated when Hermes exits

### ♻️ Refactoring

- Unified patch detection logic: always delegates to the patch script and determines the result by exit code

---

## [0.3.0-beta.1] - 2026-04-23

### 🚀 New features

**Short-term memory compression (Context Offload)**

- Added the Offload module, supporting context compression and memory offloading in long-conversation scenarios

**Architecture refactor: Core + Gateway multi-framework support**

- Refactored to a host-neutral `TdaiCore` core layer + adapter pattern, decoupling OpenClaw framework dependencies
- Added `HostAdapter` / `LLMRunner` / `LLMRunnerFactory` abstractions, supporting LLM calls from different hosts
- Added Hermes Gateway adapter (`memory_tencentdb` Hermes Plugin), supporting standalone operation through the Hermes framework
- `TdaiCore` provides unified APIs such as `handleBeforeRecall()` / `handleTurnCommitted()` / `searchMemories()`
- Gateway zero-config auto-discovery: the Hermes plugin automatically detects configuration and data directories
- Data directory ownership moved from the plugin to the Gateway layer

**Recall injection optimization (cache-friendly)**

- Moved L1 recalled memories from `appendSystemContext` to `prependContext` (user-message prefix), avoiding prompt cache busts caused by changing the system prompt every turn
- Persona / Scene Navigation / Tools Guide remain in `appendSystemContext` (stable content, enabling cache hits across consecutive turns)
- Registered the `before_message_write` hook to strip `<relevant-memories>` tags before user messages are persisted to JSONL, preventing old recalled content from accumulating in historical messages

**Scenario-specific embedding timeouts**

- Added `embedding.recallTimeoutMs` (recall path) and `embedding.captureTimeoutMs` (capture path) configuration
- On recall timeout, the hybrid strategy automatically degrades to pure keyword search; on capture timeout, L1 dedup degrades to FTS
- Backward-compatible: falls back to global `embedding.timeoutMs` when not configured

### ✨ Improvements

- CleanContextRunner uses `systemPromptOverride` to replace OpenClaw's default system prompt, saving ~4500 input tokens per L1/L2/L3 call
- Split L2 (scene extraction) and L3 (persona generation) prompts into `systemPrompt` + `userPrompt`, making role separation clearer
- Adjusted pipeline defaults: `l1IdleTimeoutSeconds` 60→600s, `l2MinIntervalSeconds` 300→900s, `l2MaxIntervalSeconds` 1800→3600s

### 🐛 Fixes

- Fixed `pullProfilesToLocal` concurrent contention causing `ENOTEMPTY` errors (optimistic lock-free fix: silently use the other result when rename contention fails)
- Fixed broken `originalUserMessageCount` data chain that prevented the L0 recorder from locating polluted user messages
- Fixed missing `prependContext` field in the `RecallResult` type definition (`types.ts` and `auto-recall.ts` were inconsistent)

---

## [0.2.2] - 2026-04-17

### 🐛 Fixes

- Fixed TCVDB client load failure caused by not declaring the `undici` dependency (development previously relied on transitive resolution from the monorepo root `node_modules`)
- Downgraded large volumes of INFO logs during plugin registration to DEBUG, avoiding excessive unrelated output in CLI mode

## [0.2.1] - 2026-04-16 (deprecated)

> NOTE: This version has been deprecated because an issue with the undici dependency could cause plugin startup failure.
> The issue has been fixed in 0.2.2 and later versions.

### 🚀 New features

- Added HTTPS connection support for TCVDB; custom CA certificate PEM files can be specified through plugin config `caPemPath` or migration script parameter `--tcvdb-ca-pem`
- Added single-file L2 query support to the `read-local-memory` script, and switched L0 / L1 queries to read directly from `vectors.db`, supporting SQL-level filtering, sorting, and pagination

### ✨ Improvements

- TCVDB L0 / L1 vector indexes now default to `DISK_FLAT`, and automatically fall back to `HNSW` on instances that do not support that index type
- Default server-side embedding model changed to `bge-large-zh`
- All TCVDB read APIs now use `readConsistency: "strongConsistency"`, eliminating read-after-write inconsistency
- Health-check script VDB connections support HTTPS self-signed certificates

### 🐛 Fixes

- Fixed L3 persona sync skipping writes due to version conflicts when the remote baseline had not been pulled
- Fixed `memories_since_last_persona` being counted twice by L0 and L1, inflating the persona trigger threshold
- Removed deprecated methods in `CheckpointManager` that had been replaced by `captureAtomically()`

---

## [0.2.0] - 2026-04-15

### 🚀 New features

**Tencent Cloud Vector Database (TCVDB) storage backend**

- Added Tencent Cloud Vector Database storage backend with hybrid vector + BM25 recall
- Supports index structure synchronization between SQLite and TCVDB
- L2 scenes / L3 personas support two-way synchronization between local cache and the vector database
- Plugin configuration (manifest) exposes configuration items such as `storeBackend`, `tcvdb`, `bm25`, and `embedding.timeoutMs`

**Local BM25 keyword retrieval**

- Replaced the previous BM25 HTTP sidecar service with the local tcvdb-text encoder, eliminating the external dependency

**Seed data import tool**

- Added CLI `seed` command for bulk memory import from external data
- Extracted shared pipeline-factory for reuse by seed and normal runtime
- Supports ISO 8601 timestamp format (JSONL support removed)

**Data migration and operations tools**

- Added SQLite → Tencent Cloud Vector Database migration script, supporting `--help` / `-h` to display complete parameter descriptions and usage examples
- Added VDB data export script (including precompiled JS and CLI launcher)
- Added local Memory data query script
- Registered all CLI bin entrypoints: `migrate-sqlite-to-tcvdb`, `export-tencent-vdb`, `read-local-memory`

**Memory search tool call limit**

- Added a combined per-turn maximum of 3 calls for `tdai_memory_search` + `tdai_conversation_search`, using tool descriptions and recall guidance prompts to constrain model behavior and prevent ineffective repeated searches

### 🐛 Fixes

- Fixed inability to delete old files during L2 scene merge (MERGE): OpenClaw 4.1+ write tool rejects blank content, so `[DELETED]` marker is used for soft deletion, and the SceneExtractor cleanup phase recognizes and cleans it up
- Fixed orphan BATCH/ARCHIVE files generated by L2 extraction, and unified `maxScenes` limit to 15
- Fixed duplicate profile pulls during L3 startup
- Filtered skill wrapper noise markers (`¥¥[...]¥¥`)
- Handled `createCollection` concurrency race (error code 15202)

### ♻️ Refactoring

- Pipeline checkpoint cursor semantics changed from timestamp to update_at
- Runner now uses `api.runtime.agent.runEmbeddedPiAgent`, avoiding cross-environment import failures
- Unified script build flow: added the `build:scripts` one-command compilation, and the `prepack` hook now automatically compiles all script artifacts before `npm pack`

### 📚 Documentation

- Added technical documentation for the design and implementation of the AI Agent long-term memory plugin
- Added project guide and R&D system layered-architecture documentation
- Added VDB storage design documentation and migration guide

---

<details>
<summary>Prerelease versions</summary>

## [0.2.0-beta.1] - 2026-04-14

*The contents of this version have been merged into the official [0.2.0] release.*

</details>

## [0.1.4] - 2026-04-10

### 🚀 Features

- *(auto-recall)* Add recall hint text before memories

## [0.1.3] - 2026-04-09

### 🚀 Features

- *(memory-tdai)* Replace emitMetric with reporter abstraction
- *(L3)* L3 uses read/write tools to prevent model output from including CoT
- *(memory)* Add embedding truncation, recall timeout, and code-block removal from L0 capture
- *(config)* Embedding timeout supports configuration
- *(report)* Expose report configuration in schema, and change the default value to false

### 🐛 Fixes

- *(capture)* Skip heartbeat/scheduled task/automation/scheduler messages
- *(recall)* Clear timeout timer when recall completes, avoiding false timeout warnings

### 💼 Other

- Rename package to memory-tencentdb
- *(deps)* Change node-llama-cpp to an optional dependency

### ⚡ Performance

- *(auto-capture)* Move L0 vector embedding into the background to reduce latency

### 📚 Documentation

- Add warning documentation for allowPromptInjection configuration

## [0.1.2] — 2026-03-26

### Changes

1. Improved conversation capture and memory extraction filtering mechanisms

## [0.1.1] — 2026-03-25

### Changes

1. Compatible with openclaw 2026.3.23 update

## [0.1.0] — 2026-03-25

> First official release. A local-first four-layer memory system (L0→L1→L2→L3), implemented with SQLite + LLM for conversation capture, memory extraction, scene summarization, and user persona generation.

### Changes

1. Added FTS5 full-text index to keyword retrieval, using jieba tokenization
2. When no remote embedding service is configured, embedding capability is disabled by default (local embedding is not used automatically, and configuration entrypoints that actively use local embedding are blocked)
3. Optimized L2 and L3 generation prompts to control generated content size (reducing token overhead)
4. Optimized file-lock usage in the Pipeline scheduler
5. Avoid full reads of L0 and L1 data
