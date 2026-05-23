import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const tempDirs: string[] = [];

async function makeStore() {
  const { VectorStore } = await import("./sqlite.js");
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
  it("opens the database through the runtime adapter", async () => {
    vi.resetModules();
    const openSqliteDatabase = vi.fn(() => ({
      raw: {},
      exec: vi.fn(),
      prepare: vi.fn(),
      close: vi.fn(),
    }));

    vi.doMock("./sqlite-runtime.js", () => ({
      loadSqliteVec: vi.fn(),
      openSqliteDatabase,
    }));

    const { VectorStore } = await import("./sqlite.js");
    const store = new VectorStore("adapter-test.db", 4, {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    });

    expect(openSqliteDatabase).toHaveBeenCalledWith("adapter-test.db", {
      allowExtension: true,
      timeout: 5000,
    });

    store.close();
    vi.doUnmock("./sqlite-runtime.js");
    vi.resetModules();
  });

  it("initializes with the runtime adapter and starts empty", async () => {
    vi.doUnmock("./sqlite-runtime.js");
    vi.resetModules();
    const store = await makeStore();
    const result = store.init({ provider: "test", model: "test-model" });

    expect(result.needsReindex).toBe(false);
    expect(store.isDegraded()).toBe(false);
    expect(store.countL0()).toBe(0);
    expect(store.countL1()).toBe(0);

    store.close();
  });

  it("persists metadata-only L0 rows without a vector", async () => {
    vi.doUnmock("./sqlite-runtime.js");
    vi.resetModules();
    const store = await makeStore();
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
