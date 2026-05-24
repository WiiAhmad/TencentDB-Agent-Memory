/**
 * Local declarations for optional runtime modules used by script builds.
 *
 * These keep the standalone script tsconfigs independent from optional peer
 * packages and Bun type packages while runtime loading remains lazy.
 */
declare module "bun:sqlite" {
  export class Database {
    constructor(filename: string, options?: {
      readonly?: boolean;
      create?: boolean;
      readwrite?: boolean;
      strict?: boolean;
    });
    exec(sql: string): void;
    prepare(sql: string): {
      run(...params: unknown[]): { changes: number | bigint; lastInsertRowid?: number | bigint };
      get<T extends Record<string, unknown> = Record<string, unknown>>(...params: unknown[]): T | null;
      all<T extends Record<string, unknown> = Record<string, unknown>>(...params: unknown[]): T[];
      finalize(): void;
    };
    close(throwOnError?: boolean): void;
  }
}

declare module "node-llama-cpp" {
  const module: any;
  export = module;
}
