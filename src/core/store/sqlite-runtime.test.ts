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
      finalize: vi.fn(),
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

  it("detects the current runtime from globalThis.Bun", () => {
    expect(isBunRuntime()).toBe(typeof (globalThis as { Bun?: unknown }).Bun !== "undefined");
  });
});
