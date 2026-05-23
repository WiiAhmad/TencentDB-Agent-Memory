# Node + Bun Dual Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class Bun support alongside Node 22 so install, build, test, the SQLite-backed runtime, and all shipped CLI commands work in both ecosystems.

**Architecture:** Keep a single `VectorStore` and move runtime-specific SQLite behavior into one thin adapter that lazy-loads `node:sqlite` or `bun:sqlite` at runtime. Reuse that adapter from the offline `read-local-memory` script, keep package scripts package-manager-neutral where possible, and expose explicit `bun:*` aliases for Bun-native execution paths.

**Tech Stack:** TypeScript, Vitest, Node.js 22 `node:sqlite`, Bun `bun:sqlite`, `sqlite-vec`, tsdown, TypeScript compiler, npm, Bun, Git

---

## Preflight Rules

### Leave unrelated local changes unstaged

This repository already has local changes unrelated to dual-runtime work. Do not stage or commit them by accident.

Run these commands first:

```bash
git status --short
git diff -- README.md scripts/migrate-sqlite-to-tcvdb/README.md
```

Expected:
- `git status --short` shows pre-existing edits in docs and worktree artifacts
- you understand whether `README.md` and `scripts/migrate-sqlite-to-tcvdb/README.md` already contain unrelated local edits before touching them

Do **not** stage these paths unless the user explicitly wants them included with the runtime work:
- `.claude/worktrees/**`
- `docs/superpowers/specs/2026-05-23-node-bun-dual-runtime-design.md`
- `bun.lock`

If `README.md` or `scripts/migrate-sqlite-to-tcvdb/README.md` contain unrelated changes you did not author and cannot confidently separate, stop before the docs task and ask the user whether to fold the runtime docs into those dirty files.

## File Map

### New files
- `src/core/store/sqlite-runtime.ts` — shared runtime adapter for opening SQLite, wrapping statements, and loading `sqlite-vec` under Node or Bun
- `src/core/store/sqlite-runtime.test.ts` — unit tests for runtime detection and statement normalization
- `src/core/store/sqlite.test.ts` — integration tests for `VectorStore` using the adapter-backed database connection
- `src/package-scripts.test.ts` — script contract tests for package-manager-neutral build scripts and Bun aliases

### Modified files
- `src/core/store/sqlite.ts` — replace direct `node:sqlite` usage with the shared runtime adapter
- `tsdown.config.ts` — mark `bun:` builtins as external so the plugin build does not try to bundle them
- `scripts/read-local-memory/read-local-memory.ts` — replace direct `node:sqlite` usage with the shared runtime adapter
- `scripts/read-local-memory/tsconfig.json` — widen `rootDir` so the script can import the shared adapter from `src/core/store`
- `bin/read-local-memory.mjs` — update compiled output path if `rootDir` change nests the build output
- `package.json` — make shared build scripts package-manager-neutral and add explicit `bun:*` aliases
- `bin/migrate-sqlite-to-tcvdb.mjs` — update runtime-neutral build/help text
- `bin/export-tencent-vdb.mjs` — update runtime-neutral build/help text
- `README.md` — document Bun install/build/test and dual SQLite runtime support
- `src/cli/README.md` — document Bun support for the offline CLI surface
- `scripts/migrate-sqlite-to-tcvdb/README.md` — fix script names and add Bun examples

## Task 1: Add the shared SQLite runtime adapter

**Files:**
- Create: `src/core/store/sqlite-runtime.ts`
- Create: `src/core/store/sqlite-runtime.test.ts`

- [ ] **Step 1: Write the failing adapter unit tests**

```ts
import { describe, expect, it, vi } from "vitest";

import {
  isBunRuntime,
  wrapBunStatement,
  wrapNodeStatement,
} from "./sqlite-runtime.js";

describe("sqlite runtime adapter", () => {
  it("normalizes Bun get() null to undefined", () => {
    const wrapped = wrapBunStatement({
      get: vi.fn(() => null),
      all: vi.fn(() => [{ record_id: "l0-1" }]),
      run: vi.fn(() => ({ changes: 1, lastInsertRowid: 7 })),
    });

    expect(wrapped.get("ignored")).toBeUndefined();
    expect(wrapped.all("ignored")).toEqual([{ record_id: "l0-1" }]);
    expect(wrapped.run("ignored")).toEqual({ changes: 1, lastInsertRowid: 7 });
  });

  it("passes Node statement results through unchanged", () => {
    const row = { record_id: "l1-1", content: "hello" };
    const wrapped = wrapNodeStatement({
      get: vi.fn(() => row),
      all: vi.fn(() => [row]),
      run: vi.fn(() => ({ changes: 2, lastInsertRowid: 11 })),
    });

    expect(wrapped.get("ignored")).toEqual(row);
    expect(wrapped.all("ignored")).toEqual([row]);
    expect(wrapped.run("ignored")).toEqual({ changes: 2, lastInsertRowid: 11 });
  });

  it("detects Bun from globalThis.Bun", () => {
    const target = globalThis as { Bun?: unknown };
    const previous = target.Bun;
    target.Bun = {};

    try {
      expect(isBunRuntime()).toBe(true);
    } finally {
      if (previous === undefined) delete target.Bun;
      else target.Bun = previous;
    }
  });
});
```

- [ ] **Step 2: Run the adapter test to verify it fails**

Run:

```bash
npx vitest run src/core/store/sqlite-runtime.test.ts
```

Expected: FAIL with `Cannot find module './sqlite-runtime.js'` or missing export errors.

- [ ] **Step 3: Write the shared adapter implementation**

```ts
import { createRequire } from "node:module";
import * as sqliteVec from "sqlite-vec";

const require = createRequire(import.meta.url);

export interface SqliteRunResult {
  changes: number | bigint;
  lastInsertRowid?: number | bigint;
}

export interface SqliteStatementAdapter {
  run(...params: unknown[]): SqliteRunResult;
  get<T extends Record<string, unknown> = Record<string, unknown>>(...params: unknown[]): T | undefined;
  all<T extends Record<string, unknown> = Record<string, unknown>>(...params: unknown[]): T[];
}

export interface SqliteDatabaseAdapter {
  readonly raw: unknown;
  exec(sql: string): void;
  prepare(sql: string): SqliteStatementAdapter;
  close(): void;
}

export interface OpenSqliteOptions {
  allowExtension?: boolean;
  readonly?: boolean;
  timeout?: number;
}

export function isBunRuntime(): boolean {
  return typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
}

export function wrapNodeStatement(statement: {
  run: (...params: unknown[]) => SqliteRunResult;
  get: <T extends Record<string, unknown> = Record<string, unknown>>(...params: unknown[]) => T | undefined;
  all: <T extends Record<string, unknown> = Record<string, unknown>>(...params: unknown[]) => T[];
}): SqliteStatementAdapter {
  return statement;
}

export function wrapBunStatement(statement: {
  run: (...params: unknown[]) => SqliteRunResult;
  get: <T extends Record<string, unknown> = Record<string, unknown>>(...params: unknown[]) => T | null;
  all: <T extends Record<string, unknown> = Record<string, unknown>>(...params: unknown[]) => T[];
}): SqliteStatementAdapter {
  return {
    run: (...params) => statement.run(...params),
    get: (...params) => statement.get(...params) ?? undefined,
    all: (...params) => statement.all(...params),
  };
}

function wrapNodeDatabase(db: {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    run: (...params: unknown[]) => SqliteRunResult;
    get: <T extends Record<string, unknown> = Record<string, unknown>>(...params: unknown[]) => T | undefined;
    all: <T extends Record<string, unknown> = Record<string, unknown>>(...params: unknown[]) => T[];
  };
  close: () => void;
}): SqliteDatabaseAdapter {
  return {
    raw: db,
    exec: (sql) => db.exec(sql),
    prepare: (sql) => wrapNodeStatement(db.prepare(sql)),
    close: () => db.close(),
  };
}

function wrapBunDatabase(db: {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    run: (...params: unknown[]) => SqliteRunResult;
    get: <T extends Record<string, unknown> = Record<string, unknown>>(...params: unknown[]) => T | null;
    all: <T extends Record<string, unknown> = Record<string, unknown>>(...params: unknown[]) => T[];
  };
  close: (throwOnError?: boolean) => void;
}): SqliteDatabaseAdapter {
  return {
    raw: db,
    exec: (sql) => db.exec(sql),
    prepare: (sql) => wrapBunStatement(db.prepare(sql)),
    close: () => db.close(false),
  };
}

export function openSqliteDatabase(dbPath: string, options: OpenSqliteOptions = {}): SqliteDatabaseAdapter {
  if (isBunRuntime()) {
    const { Database } = require("bun:sqlite") as typeof import("bun:sqlite");
    const db = new Database(dbPath, {
      readonly: options.readonly ?? false,
      create: options.readonly ? false : true,
      readwrite: options.readonly ? false : true,
      strict: false,
    });

    if (options.readonly) {
      db.exec("PRAGMA query_only = ON");
    }

    return wrapBunDatabase(db);
  }

  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
  const db = new DatabaseSync(dbPath, {
    allowExtension: options.allowExtension ?? false,
    readOnly: options.readonly ?? false,
    timeout: options.timeout ?? 0,
  });

  if (options.readonly) {
    db.exec("PRAGMA query_only = ON");
  }

  return wrapNodeDatabase(db);
}

export function loadSqliteVec(database: SqliteDatabaseAdapter): void {
  const raw = database.raw as { enableLoadExtension?: (enabled: boolean) => void };
  raw.enableLoadExtension?.(true);
  try {
    sqliteVec.load(database.raw as never);
  } finally {
    raw.enableLoadExtension?.(false);
  }
}
```

- [ ] **Step 4: Run the adapter test to verify it passes**

Run:

```bash
npx vitest run src/core/store/sqlite-runtime.test.ts
```

Expected: PASS with 3 passing tests.

- [ ] **Step 5: Commit the adapter layer**

```bash
git add src/core/store/sqlite-runtime.ts src/core/store/sqlite-runtime.test.ts
git commit -m "test(store): add sqlite runtime adapter coverage"
```

Expected: commit succeeds and only the new adapter files are included.

## Task 2: Refactor `VectorStore` to use the shared adapter

**Files:**
- Create: `src/core/store/sqlite.test.ts`
- Modify: `src/core/store/sqlite.ts`
- Modify: `tsdown.config.ts`

- [ ] **Step 1: Write the failing `VectorStore` integration test**

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { VectorStore } from "./sqlite.js";

const tempDirs: string[] = [];

function makeStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-tdai-sqlite-"));
  tempDirs.push(dir);
  const dbPath = path.join(dir, "vectors.db");
  const logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };
  return new VectorStore(dbPath, 4, logger);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("VectorStore", () => {
  it("initializes with the runtime adapter and starts empty", () => {
    const store = makeStore();
    const result = store.init({ provider: "test", model: "test-model" });

    expect(result.needsReindex).toBe(false);
    expect(store.isDegraded()).toBe(false);
    expect(store.countL0()).toBe(0);
    expect(store.countL1()).toBe(0);

    store.close();
  });

  it("persists metadata-only L0 rows without a vector", () => {
    const store = makeStore();
    store.init({ provider: "test", model: "test-model" });

    const ok = store.upsertL0(
      {
        id: "l0-1",
        sessionKey: "demo",
        sessionId: "s-1",
        role: "user",
        messageText: "hello bun",
        recordedAt: "2026-05-23T00:00:00.000Z",
        timestamp: 1747958400000,
      },
      undefined,
    );

    expect(ok).toBe(true);
    expect(store.queryL0ForL1("demo", undefined, 10)).toHaveLength(1);

    store.close();
  });
});
```

- [ ] **Step 2: Run the store integration test to verify it fails**

Run:

```bash
npx vitest run src/core/store/sqlite.test.ts
```

Expected: FAIL while opening SQLite or importing Node-specific `node:sqlite` types directly from `src/core/store/sqlite.ts`.

- [ ] **Step 3: Replace direct `node:sqlite` usage inside `VectorStore`**

Replace the top of `src/core/store/sqlite.ts` with the adapter imports and types below:

```ts
import type { MemoryRecord } from "../record/l1-writer.js";
import type { EmbeddingProviderInfo } from "./embedding.js";
import {
  loadSqliteVec,
  openSqliteDatabase,
  type SqliteDatabaseAdapter,
  type SqliteStatementAdapter,
} from "./sqlite-runtime.js";
import type {
  IMemoryStore,
  StoreCapabilities,
  L0Record,
  L1SearchResult,
  L1FtsResult,
  L0SearchResult,
  L0FtsResult,
} from "./types.js";
```

Update the database and statement fields to use the adapter types:

```ts
export class VectorStore implements IMemoryStore {
  private db: SqliteDatabaseAdapter;
  private readonly dimensions: number;
  private readonly logger?: Logger;

  private stmtUpsertMeta!: SqliteStatementAdapter;
  private stmtDeleteVec?: SqliteStatementAdapter;
  private stmtInsertVec?: SqliteStatementAdapter;
  private stmtDeleteMeta!: SqliteStatementAdapter;
  private stmtGetMeta!: SqliteStatementAdapter;
  private stmtSearchVec?: SqliteStatementAdapter;
  private stmtQueryBySessionId!: SqliteStatementAdapter;
  private stmtQueryBySessionIdSince!: SqliteStatementAdapter;
  private stmtQueryBySessionKey!: SqliteStatementAdapter;
  private stmtQueryBySessionKeySince!: SqliteStatementAdapter;
  private stmtQueryAll!: SqliteStatementAdapter;
  private stmtQueryAllSince!: SqliteStatementAdapter;
  private stmtL0UpsertMeta!: SqliteStatementAdapter;
  private stmtL0DeleteVec?: SqliteStatementAdapter;
  private stmtL0InsertVec?: SqliteStatementAdapter;
  private stmtL0DeleteMeta!: SqliteStatementAdapter;
  private stmtL0GetMeta!: SqliteStatementAdapter;
  private stmtL0SearchVec?: SqliteStatementAdapter;
  private stmtL0QueryAll!: SqliteStatementAdapter;
  private stmtL0QueryAfter!: SqliteStatementAdapter;
  private stmtL1QueryMigrationCursor!: SqliteStatementAdapter;
  private stmtL0QueryMigrationCursor!: SqliteStatementAdapter;
  private stmtL1FtsInsert!: SqliteStatementAdapter;
  private stmtL1FtsDelete!: SqliteStatementAdapter;
  private stmtL1FtsSearch!: SqliteStatementAdapter;
  private stmtL0FtsInsert!: SqliteStatementAdapter;
  private stmtL0FtsDelete!: SqliteStatementAdapter;
  private stmtL0FtsSearch!: SqliteStatementAdapter;
```

Update the constructor and extension-loading path:

```ts
constructor(dbPath: string, dimensions: number, logger?: Logger) {
  this.dimensions = dimensions;
  this.logger = logger;

  this.db = openSqliteDatabase(dbPath, {
    allowExtension: true,
    timeout: 5000,
  });

  this.db.exec("PRAGMA busy_timeout = 5000");
  this.db.exec("PRAGMA journal_mode = WAL");
  this.db.exec("PRAGMA cache_size = -65536");
  this.db.exec("PRAGMA mmap_size = 134217728");
  this.db.exec("PRAGMA wal_autocheckpoint = 1000");
}
```

```ts
init(providerInfo?: EmbeddingProviderInfo): VectorStoreInitResult {
  try {
    loadSqliteVec(this.db);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    this.logger?.error(
      `${TAG} Failed to load sqlite-vec extension: ${message}. ` +
      `VectorStore entering degraded mode — all operations will be no-ops.`,
    );
    this.degraded = true;
    return { needsReindex: false, reason: `sqlite-vec load failed: ${message}` };
  }

  try {
    return this.initSchema(providerInfo);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    this.logger?.error(
      `${TAG} Schema initialization failed: ${message}. ` +
      `VectorStore entering degraded mode.`,
    );
    this.degraded = true;
    return { needsReindex: false, reason: `schema init failed: ${message}` };
  }
}
```

Also update the file header comment to say the store supports `node:sqlite` under Node and `bun:sqlite` under Bun.

- [ ] **Step 4: Mark Bun builtins as external in the plugin build**

Update `tsdown.config.ts` so Bun builtins are not bundled:

```ts
export default defineConfig({
  entry: ["./index.ts"],
  outDir: "./dist",
  format: "esm",
  platform: "node",
  clean: true,
  fixedExtension: true,
  dts: false,
  sourcemap: false,
  deps: {
    neverBundle: (id) => {
      if (id === "openclaw" || id.startsWith("openclaw/")) return true;
      if (id.startsWith("node:") || id.startsWith("bun:")) return true;
      for (const dep of collectExternalDependencies()) {
        if (id === dep || id.startsWith(`${dep}/`)) return true;
      }
      return false;
    },
  },
});
```

- [ ] **Step 5: Run the adapter and store verification commands**

Run:

```bash
npx vitest run src/core/store/sqlite-runtime.test.ts src/core/store/sqlite.test.ts
npm run build:plugin
```

Expected:
- Vitest reports all adapter and store tests PASS
- `npm run build:plugin` exits with code 0

- [ ] **Step 6: Commit the store refactor**

```bash
git add src/core/store/sqlite.ts src/core/store/sqlite.test.ts tsdown.config.ts
git commit -m "refactor(store): support node and bun sqlite runtimes"
```

Expected: commit succeeds and includes only the store refactor and its test/build config changes.

## Task 3: Reuse the adapter in `read-local-memory` and add script contract tests

**Files:**
- Create: `src/package-scripts.test.ts`
- Modify: `scripts/read-local-memory/read-local-memory.ts`
- Modify: `scripts/read-local-memory/tsconfig.json`
- Modify: `bin/read-local-memory.mjs`
- Modify: `package.json`
- Modify: `bin/migrate-sqlite-to-tcvdb.mjs`
- Modify: `bin/export-tencent-vdb.mjs`

- [ ] **Step 1: Write the failing package-script contract test**

```ts
import fs from "node:fs";

import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const readLocalMemoryBin = fs.readFileSync(new URL("../bin/read-local-memory.mjs", import.meta.url), "utf8");

describe("package scripts", () => {
  it("keeps build scripts package-manager neutral", () => {
    expect(packageJson.scripts.build).not.toContain("npm run");
    expect(packageJson.scripts["build:scripts"]).not.toContain("npm run");
    expect(packageJson.scripts.prepack).not.toContain("npm run");
  });

  it("defines Bun aliases for the shipped runtime workflows", () => {
    expect(packageJson.scripts["bun:build"]).toBeTruthy();
    expect(packageJson.scripts["bun:test"]).toContain("--bun");
    expect(packageJson.scripts["bun:migrate-sqlite-to-tcvdb"]).toContain("./bin/migrate-sqlite-to-tcvdb.mjs");
    expect(packageJson.scripts["bun:export-tencent-vdb"]).toContain("./bin/export-tencent-vdb.mjs");
    expect(packageJson.scripts["bun:read-local-memory"]).toContain("./bin/read-local-memory.mjs");
  });

  it("points read-local-memory at the nested dist path", () => {
    expect(readLocalMemoryBin).toContain("../scripts/read-local-memory/dist/scripts/read-local-memory/read-local-memory.js");
  });
});
```

- [ ] **Step 2: Run the script contract test to verify it fails**

Run:

```bash
npx vitest run src/package-scripts.test.ts
```

Expected: FAIL because `package.json` still contains `npm run` chaining and the wrapper still points at the old build output path.

- [ ] **Step 3: Replace direct `node:sqlite` usage in `read-local-memory`**

Update the imports at the top of `scripts/read-local-memory/read-local-memory.ts`:

```ts
#!/usr/bin/env npx tsx
import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";

import {
  openSqliteDatabase,
  type SqliteDatabaseAdapter,
} from "../../src/core/store/sqlite-runtime.js";
```

Replace the direct Node-specific open helper and database types:

```ts
function openSqliteReadonly(dbPath: string): SqliteDatabaseAdapter {
  return openSqliteDatabase(dbPath, { readonly: true });
}
```

```ts
function querySqlite(db: SqliteDatabaseAdapter, level: "L0" | "L1", opts: CliOptions): SqlQueryResult {
  // existing SQL stays the same
}

function querySqliteLevel(db: SqliteDatabaseAdapter, opts: CliOptions, level: "L0" | "L1") {
  // existing SQL stays the same
}

function showOverview(db: SqliteDatabaseAdapter, opts: CliOptions) {
  // existing SQL stays the same
}

function tryOpenSqlite(dataDir: string): SqliteDatabaseAdapter | null {
  // existing filesystem logic stays the same
}
```

Keep the SQL text unchanged; only the database-opening path and the function signatures should change.

- [ ] **Step 4: Widen the script build root and fix the wrapper path**

Update `scripts/read-local-memory/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "../..",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "declaration": false,
    "sourceMap": false
  },
  "files": ["read-local-memory.ts"],
  "exclude": ["dist", "node_modules"]
}
```

Update `bin/read-local-memory.mjs` to match the nested output path and the new runtime-neutral build hint:

```js
#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const entryScript = path.resolve(thisDir, "../scripts/read-local-memory/dist/scripts/read-local-memory/read-local-memory.js");

if (!fs.existsSync(entryScript)) {
  console.error("❌  Precompiled artifact not found: " + entryScript);
  console.error("   Please run first: npm run build:read-local-memory or bun run build:read-local-memory");
  process.exit(1);
}

import(entryScript);
```

- [ ] **Step 5: Make package scripts package-manager neutral and add Bun aliases**

Update the `scripts` section in `package.json` to this shape:

```json
{
  "build": "tsdown && tsc -p scripts/migrate-sqlite-to-tcvdb/tsconfig.json --noEmitOnError false && tsc --project scripts/export-tencent-vdb/tsconfig.json && tsc --project scripts/read-local-memory/tsconfig.json",
  "build:plugin": "tsdown",
  "build:scripts": "tsc -p scripts/migrate-sqlite-to-tcvdb/tsconfig.json --noEmitOnError false && tsc --project scripts/export-tencent-vdb/tsconfig.json && tsc --project scripts/read-local-memory/tsconfig.json",
  "prepack": "tsdown && tsc -p scripts/migrate-sqlite-to-tcvdb/tsconfig.json --noEmitOnError false && tsc --project scripts/export-tencent-vdb/tsconfig.json && tsc --project scripts/read-local-memory/tsconfig.json",
  "build:migrate-sqlite-to-vdb": "tsc -p scripts/migrate-sqlite-to-tcvdb/tsconfig.json --noEmitOnError false",
  "migrate-sqlite-to-tcvdb": "node ./bin/migrate-sqlite-to-tcvdb.mjs",
  "build:export-tencent-vdb": "tsc --project scripts/export-tencent-vdb/tsconfig.json",
  "export-tencent-vdb": "node ./bin/export-tencent-vdb.mjs",
  "build:read-local-memory": "tsc --project scripts/read-local-memory/tsconfig.json",
  "read-local-memory": "node ./bin/read-local-memory.mjs",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "bun:build": "bun run build",
  "bun:test": "bun run --bun vitest run",
  "bun:test:watch": "bun run --bun vitest",
  "bun:test:coverage": "bun run --bun vitest run --coverage",
  "bun:migrate-sqlite-to-tcvdb": "bun run --bun ./bin/migrate-sqlite-to-tcvdb.mjs",
  "bun:export-tencent-vdb": "bun run --bun ./bin/export-tencent-vdb.mjs",
  "bun:read-local-memory": "bun run --bun ./bin/read-local-memory.mjs",
  "postinstall": "bash scripts/openclaw-after-tool-call-messages.patch.sh 2>/dev/null || true"
}
```

Update the two remaining bin wrappers so their build hints mention both ecosystems:

```js
// bin/migrate-sqlite-to-tcvdb.mjs
// Thin wrapper: runs the pre-compiled migration CLI entry.
// Build first: npm run build:migrate-sqlite-to-vdb or bun run build:migrate-sqlite-to-vdb
```

```js
// bin/export-tencent-vdb.mjs
// Thin launcher: loads the precompiled VDB export script.
// Build first: npm run build:export-tencent-vdb or bun run build:export-tencent-vdb
// Usage: npm run export-tencent-vdb -- [args]  or  bun run bun:export-tencent-vdb -- [args]
```

- [ ] **Step 6: Run the script, build, and CLI smoke checks**

Run:

```bash
npx vitest run src/package-scripts.test.ts
npm run build
npm test
node ./bin/read-local-memory.mjs --help
node ./bin/export-tencent-vdb.mjs --help
node ./bin/migrate-sqlite-to-tcvdb.mjs --help
bun run bun:build
bun run bun:test
bun run bun:read-local-memory -- --help
bun run bun:export-tencent-vdb -- --help
bun run bun:migrate-sqlite-to-tcvdb -- --help
```

Expected:
- Vitest reports the script contract test PASS
- `npm run build` and `npm test` exit with code 0
- each Node wrapper prints usage/help text instead of crashing on runtime resolution
- `bun run bun:build` and `bun run bun:test` exit with code 0
- each Bun alias prints usage/help text instead of crashing on runtime resolution

- [ ] **Step 7: Commit the script and package-manager work**

```bash
git add src/package-scripts.test.ts scripts/read-local-memory/read-local-memory.ts scripts/read-local-memory/tsconfig.json bin/read-local-memory.mjs package.json bin/migrate-sqlite-to-tcvdb.mjs bin/export-tencent-vdb.mjs
git commit -m "build(runtime): add bun commands and shared sqlite script support"
```

Expected: commit succeeds and contains only the script/package work.

## Task 4: Document Bun support and run the dual-runtime SQLite proof

**Files:**
- Modify: `README.md`
- Modify: `src/cli/README.md`
- Modify: `scripts/migrate-sqlite-to-tcvdb/README.md`

- [ ] **Step 1: Re-check the dirty docs before editing them**

Run:

```bash
git diff -- README.md src/cli/README.md scripts/migrate-sqlite-to-tcvdb/README.md
```

Expected: you understand which changes are already present in these files and whether you can safely layer the runtime docs on top.

If `README.md` or `scripts/migrate-sqlite-to-tcvdb/README.md` still contain unrelated edits you cannot confidently include, stop here and ask the user before staging them later.

- [ ] **Step 2: Update the documentation with exact Node and Bun workflows**

Add a Bun workflow block to `README.md` near the install/build/test instructions:

````md
### Bun

```bash
bun install
bun run build
bun run bun:test
bun run bun:read-local-memory -- --help
```

When the local memory backend is enabled, the plugin uses `node:sqlite` under Node 22 and `bun:sqlite` under Bun while keeping the same SQLite schema and `sqlite-vec` behavior.
````

Add a Bun note to `src/cli/README.md` near the top:

```md
## Runtime support

The offline CLI workflows in this repository are supported in both environments:

- Node 22 + npm
- latest Bun via the explicit `bun:*` package scripts
```

Fix the migration README command names and add Bun examples in `scripts/migrate-sqlite-to-tcvdb/README.md`:

````md
## Build

```bash
npm run build:migrate-sqlite-to-vdb
# or
bun run build:migrate-sqlite-to-vdb
```
````

````md
## Usage

```bash
npm run migrate-sqlite-to-tcvdb -- --dry-run ...
# or
bun run bun:migrate-sqlite-to-tcvdb -- --dry-run ...
```
````

Also replace every stale `npm run migrate:sqlite-to-tcvdb` example in that file with `npm run migrate-sqlite-to-tcvdb`.

- [ ] **Step 3: Run the real dual-runtime SQLite proof for `read-local-memory`**

Run:

```bash
TMP_DIR="$(node --input-type=module -e "import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { VectorStore } from './src/core/store/sqlite.js'; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-tdai-cli-')); const store = new VectorStore(path.join(dir, 'vectors.db'), 4, { info() {}, warn() {}, error() {}, debug() {} }); store.init({ provider: 'test', model: 'test-model' }); store.upsertL0({ id: 'l0-1', sessionKey: 'demo', sessionId: 's-1', role: 'user', messageText: 'hello bun', recordedAt: '2026-05-23T00:00:00.000Z', timestamp: 1747958400000 }, undefined); store.close(); console.log(dir);")"
node ./bin/read-local-memory.mjs -d "$TMP_DIR" -L L0 --format json
bun run bun:read-local-memory -- -d "$TMP_DIR" -L L0 --format json
```

Expected:
- both commands print JSON output instead of crashing
- both outputs contain `"sessionKey": "demo"`
- both outputs contain `"content": "hello bun"` or the equivalent mapped L0 text field

- [ ] **Step 4: Run the final repository verification sweep**

Run:

```bash
npx vitest run src/core/store/sqlite-runtime.test.ts src/core/store/sqlite.test.ts src/package-scripts.test.ts
npm run build
npm test
bun run bun:build
bun run bun:test
node ./bin/migrate-sqlite-to-tcvdb.mjs --help
node ./bin/export-tencent-vdb.mjs --help
node ./bin/read-local-memory.mjs --help
bun run bun:migrate-sqlite-to-tcvdb -- --help
bun run bun:export-tencent-vdb -- --help
bun run bun:read-local-memory -- --help
```

Expected:
- all targeted tests PASS
- Node build and test PASS
- Bun build and test PASS
- every shipped CLI entry point responds under both Node and Bun

- [ ] **Step 5: Commit the documentation and final verification changes**

If the docs files still contain unrelated edits you do not understand, stop and ask the user before running the commands below.

Otherwise run:

```bash
git add README.md src/cli/README.md scripts/migrate-sqlite-to-tcvdb/README.md
git commit -m "docs(runtime): document node and bun workflows"
```

Expected: commit succeeds and includes only the runtime docs updates.

## Spec Coverage Check

This plan covers every requirement from `docs/superpowers/specs/2026-05-23-node-bun-dual-runtime-design.md`:

- single shared store plus runtime adapter: Task 1 and Task 2
- lazy loading of `node:sqlite` vs `bun:sqlite`: Task 1
- keep `sqlite-vec` shared across runtimes: Task 1 and Task 2
- same local SQLite behavior under both runtimes: Task 2 and Task 4
- package-manager-neutral build scripts: Task 3
- explicit `bun:*` aliases: Task 3
- shipped CLI wrappers work in both ecosystems: Task 3 and Task 4
- docs present Bun as a supported workflow: Task 4
- verification under both Node and Bun: Task 4

## Placeholder Scan

This plan contains no unresolved placeholder markers or deferred implementation notes. Every task names exact files, exact commands, expected failures, expected passing conditions, and exact commit commands.

## Type Consistency Check

The same shared names are used throughout the plan:
- `SqliteDatabaseAdapter`
- `SqliteStatementAdapter`
- `openSqliteDatabase`
- `loadSqliteVec`
- `wrapNodeStatement`
- `wrapBunStatement`

Later tasks reuse those exact names instead of introducing alternate spellings or duplicate abstractions.