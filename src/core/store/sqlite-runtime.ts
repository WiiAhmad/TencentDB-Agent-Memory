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
  finalize?(): void;
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

interface NodeStatementLike {
  run: (...params: unknown[]) => SqliteRunResult;
  get: <T extends Record<string, unknown> = Record<string, unknown>>(...params: unknown[]) => T | undefined;
  all: <T extends Record<string, unknown> = Record<string, unknown>>(...params: unknown[]) => T[];
  finalize?: () => void;
}

interface BunStatementLike {
  run: (...params: unknown[]) => SqliteRunResult;
  get: <T extends Record<string, unknown> = Record<string, unknown>>(...params: unknown[]) => T | null;
  all: <T extends Record<string, unknown> = Record<string, unknown>>(...params: unknown[]) => T[];
  finalize: () => void;
}

interface NodeDatabaseLike {
  exec: (sql: string) => void;
  prepare: (sql: string) => NodeStatementLike;
  close: () => void;
}

interface BunDatabaseLike {
  exec: (sql: string) => void;
  prepare: (sql: string) => BunStatementLike;
  close: (throwOnError?: boolean) => void;
}

interface NodeSqliteModule {
  DatabaseSync: new (path: string, options?: {
    allowExtension?: boolean;
    readOnly?: boolean;
    timeout?: number;
  }) => NodeDatabaseLike;
}

interface BunSqliteModule {
  Database: new (filename: string, options?: {
    readonly?: boolean;
    create?: boolean;
    readwrite?: boolean;
    strict?: boolean;
  }) => BunDatabaseLike;
}

export function isBunRuntime(): boolean {
  return typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
}

export function wrapNodeStatement(statement: NodeStatementLike): SqliteStatementAdapter {
  return {
    run: (...params) => statement.run(...params),
    get: (...params) => statement.get(...params),
    all: (...params) => statement.all(...params),
    finalize: () => statement.finalize?.(),
  };
}

export function wrapBunStatement(statement: BunStatementLike): SqliteStatementAdapter {
  return {
    run: (...params) => statement.run(...params),
    get: (...params) => statement.get(...params) ?? undefined,
    all: (...params) => statement.all(...params),
    finalize: () => statement.finalize(),
  };
}

function wrapNodeDatabase(db: NodeDatabaseLike): SqliteDatabaseAdapter {
  const statements = new Set<SqliteStatementAdapter>();
  return {
    raw: db,
    exec: (sql) => db.exec(sql),
    prepare: (sql) => {
      const statement = wrapNodeStatement(db.prepare(sql));
      statements.add(statement);
      return statement;
    },
    close: () => {
      for (const statement of statements) {
        statement.finalize?.();
      }
      statements.clear();
      db.close();
    },
  };
}

function wrapBunDatabase(db: BunDatabaseLike): SqliteDatabaseAdapter {
  const statements = new Set<SqliteStatementAdapter>();
  return {
    raw: db,
    exec: (sql) => db.exec(sql),
    prepare: (sql) => {
      const statement = wrapBunStatement(db.prepare(sql));
      statements.add(statement);
      return statement;
    },
    close: () => {
      for (const statement of statements) {
        statement.finalize?.();
      }
      statements.clear();
      db.close(false);
    },
  };
}

export function openSqliteDatabase(dbPath: string, options: OpenSqliteOptions = {}): SqliteDatabaseAdapter {
  if (isBunRuntime()) {
    const { Database } = require("bun:sqlite") as BunSqliteModule;
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

  const { DatabaseSync } = require("node:sqlite") as NodeSqliteModule;
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
