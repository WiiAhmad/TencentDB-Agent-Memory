# Node + Bun Dual Runtime Design

**Date:** 2026-05-23  
**Status:** Approved in chat, written for review  
**Target baseline:** Node 22.x and latest Bun

## Goal

Make this repository work as a first-class dual-runtime project for both Node and Bun.

Success means all of the following work in this repo:
- install
- build
- test
- all shipped CLI commands

The supported workflows are:
- `npm install`, `npm run build`, `npm test`, and the existing CLI scripts under Node
- `bun install`, `bun run build`, `bun run test`, and the same CLI scripts under Bun
- explicit Bun aliases such as `bun:build` and `bun:migrate-sqlite-to-tcvdb`

## Scope

This design covers:
- local SQLite runtime support under both Node and Bun
- package scripts and CLI command compatibility for both ecosystems
- documentation updates needed to present Bun as a supported runtime
- verification that both runtimes exercise the same local SQLite behavior

This design does not cover:
- support for Node versions older than 22
- replacing Vitest with Bun's test runner unless that becomes necessary for compatibility
- changing the TCVDB backend behavior beyond keeping it compatible with the new runtime wiring
- broad refactors unrelated to runtime compatibility

## Current State

The current local SQLite implementation is Node-specific:
- `src/core/store/sqlite.ts` imports `DatabaseSync` and `StatementSync` from `node:sqlite`
- `src/core/store/sqlite.ts` loads `sqlite-vec` directly into the Node database instance
- `package.json` scripts hardcode `npm run` in chained build steps
- shipped CLI scripts are invoked through `node ./bin/...`

This means Bun can potentially run some project commands, but the repo is not designed as a true Bun runtime target today.

## Decision Summary

The project will keep one `VectorStore` implementation and introduce a thin runtime adapter beneath it.

The design explicitly rejects a split `VectorStoreNode` / `VectorStoreBun` approach because the store file already contains a large amount of shared schema, FTS, vector, migration, and reindex logic. Duplicating that logic would create long-term maintenance cost and increase the chance of runtime drift.

## Architecture

### 1. Single store, runtime-specific adapter

`VectorStore` remains the single owner of:
- schema creation
- sqlite-vec table setup
- FTS setup and rebuild logic
- L0/L1 writes
- vector search
- FTS search
- cleanup and reindex flows

Runtime-specific database access moves into a small adapter layer.

Proposed structure:
- `src/core/store/sqlite.ts` remains the main store implementation
- add a runtime adapter module such as `src/core/store/sqlite-runtime.ts`
- `src/core/store/factory.ts` continues to construct the same `VectorStore`
- callers outside the store do not branch on runtime

### 2. Adapter contract

The adapter normalizes the small set of database features the store actually needs.

Proposed internal contract:

```ts
interface SqliteDatabaseAdapter {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatementAdapter;
  close(): void;
}

interface SqliteStatementAdapter {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid?: number | bigint };
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Array<Record<string, unknown>>;
}
```

Normalization rules:
- Bun `Statement.get()` returns `null`; the adapter converts that to `undefined`
- result rows are exposed to the store as plain objects in both runtimes
- existing positional parameter calls stay unchanged
- vector values continue to use typed arrays or binary buffers compatible with `sqlite-vec`

### 3. Runtime selection

Runtime selection happens once when opening the SQLite database.

Node path:
- use `node:sqlite`
- preserve the current synchronous model based on `DatabaseSync`

Bun path:
- use `bun:sqlite`
- preserve the same synchronous operational model through Bun's `Database` and `Statement`

The store should not contain scattered `if (isBun)` checks. Runtime branching belongs in the adapter module.

The adapter implementation must lazy-load only the active runtime module. It must not use top-level static imports for both `node:sqlite` and `bun:sqlite`, because each runtime needs to avoid resolving the other runtime's built-in module during startup.

## SQLite and sqlite-vec Strategy

### 1. Preserve the synchronous local database model

The store will stay synchronous for local SQLite operations. This matches the current design and avoids changing transaction behavior, control flow, or error handling semantics.

### 2. Keep sqlite-vec as a shared dependency

The design keeps `sqlite-vec` as the vector extension in both runtimes.

Current documentation indicates `sqliteVec.load(db)` works with both:
- Node `DatabaseSync`
- Bun `Database`

Because of that, the extension-loading flow should stay centralized and minimal:
- open runtime-specific database instance
- load `sqlite-vec` into that instance
- continue with the existing schema initialization flow

### 3. Isolate extension-loading differences

The adapter module is responsible for handling runtime-specific opening details, including any constructor or option differences needed before `sqlite-vec` is loaded.

The store remains responsible only for reacting to extension-load success or failure the same way it already does.

## Command and Package Strategy

### 1. Shared scripts remain the primary interface

The current script names stay supported so both ecosystems can use the same commands:
- `build`
- `build:plugin`
- `build:scripts`
- `build:migrate-sqlite-to-vdb`
- `build:export-tencent-vdb`
- `build:read-local-memory`
- `test`
- `test:watch`
- `test:coverage`
- `migrate-sqlite-to-tcvdb`
- `export-tencent-vdb`
- `read-local-memory`

### 2. Add explicit Bun aliases

Add Bun-specific aliases for discoverability:
- `bun:build`
- `bun:test`
- `bun:test:watch`
- `bun:test:coverage`
- `bun:migrate-sqlite-to-tcvdb`
- `bun:export-tencent-vdb`
- `bun:read-local-memory`

These aliases should call the same underlying workflow, not a separate implementation.

### 3. Remove npm-specific script chaining from shared scripts

Shared scripts should not depend on nested `npm run ...` calls where that would force npm semantics.

Instead, shared scripts should be expressed in a package-manager-neutral way so that:
- `npm run build` works
- `bun run build` works

The implementation may use direct tool invocations or a neutral orchestration approach, but the design requirement is that shared scripts must execute correctly from either ecosystem.

## CLI Strategy

### 1. Keep existing shipped CLI entry points

The repo should keep the current shipped CLI surface:
- `bin/migrate-sqlite-to-tcvdb.mjs`
- `bin/export-tencent-vdb.mjs`
- `bin/read-local-memory.mjs`

### 2. Make wrapper behavior runtime-neutral

The wrapper modules should remain ESM and avoid relying on Node-only logic beyond what is unavoidable for npm bin compatibility.

The key compatibility goal is functional execution:
- existing Node-driven CLI invocations continue to work
- Bun users can execute the same built CLI paths through `bun run` and Bun script aliases

The shebang line can remain npm-friendly if needed; the important requirement is that the module body and script wiring do not force Node-only runtime behavior when Bun is used intentionally.

## Data and Behavior Guarantees

This design requires local SQLite behavior to stay aligned across Node and Bun for:
- schema creation
- WAL and pragma setup
- sqlite-vec initialization
- FTS availability handling
- L0 metadata writes
- L1 metadata writes
- vector inserts and searches
- FTS indexing and searches
- reindex behavior
- cleanup behavior
- migration cursor reads

There is no supported feature fork where one runtime has reduced local-memory behavior.

## Error Handling

The existing store behavior should be preserved:
- if `sqlite-vec` fails to load, the store can enter degraded mode rather than crashing the surrounding plugin flow
- schema initialization failure remains non-fatal to the host process where that is current behavior
- search and write methods keep their current defensive empty-result or false-return behavior where already implemented

The adapter should avoid adding its own policy layer. Its job is to normalize runtime API differences and surface failures in a form the store already knows how to handle.

## Documentation Changes

Documentation should present Bun as a supported first-class workflow.

Expected doc updates:
- `README.md`
- any CLI-specific README content
- any migration or helper script docs that currently imply Node-only usage

Docs should clearly show both styles:
- npm/Node usage
- Bun usage

They should also clarify that Node 22 remains the baseline Node target while Bun support is additive, not a replacement.

## Verification Requirements

Completion is defined by verification, not just code changes.

### 1. Build verification

Under Node/npm:
- install succeeds
- build succeeds
- tests succeed

Under Bun:
- install succeeds
- build succeeds
- tests succeed

### 2. CLI verification

At least one real invocation path for each shipped CLI command should be exercised in both ecosystems:
- migration CLI
- export CLI
- read-local-memory CLI

### 3. SQLite verification

In both runtimes, verification must confirm:
- database opens successfully
- `sqlite-vec` loads successfully
- schema init succeeds
- one write/read path works
- one vector search path works
- FTS path still behaves as expected when enabled

### 4. Adapter-focused verification

Targeted tests should cover the normalized runtime differences, especially:
- `get()` null-to-undefined normalization
- statement result shape compatibility
- extension loading path compatibility

### 5. Docs verification

Examples added or changed in docs must be executable as written.

## Non-Goals and Constraints

- The project will not maintain separate feature implementations for Node and Bun local SQLite behavior.
- The project will not widen Node support below 22.x as part of this change.
- The project will not redesign unrelated storage abstractions.
- The project will not require Bun for contributors who prefer Node.

## Final Recommended Design

Adopt a thin runtime adapter beneath the existing SQLite store, keep one shared `VectorStore`, convert shared scripts to package-manager-neutral execution, add explicit Bun aliases, and verify the full install/build/test/CLI workflow under both Node 22 and Bun.

This gives the repo real Bun runtime support while keeping the local-memory implementation unified and maintainable.