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
    expect(packageJson.scripts["bun:test"]).toBe("bun run test");
    expect(packageJson.scripts["bun:test"]).not.toContain("--bun");
    expect(packageJson.scripts["bun:migrate-sqlite-to-tcvdb"]).toContain("./bin/migrate-sqlite-to-tcvdb.mjs");
    expect(packageJson.scripts["bun:export-tencent-vdb"]).toContain("./bin/export-tencent-vdb.mjs");
    expect(packageJson.scripts["bun:read-local-memory"]).toContain("./bin/read-local-memory.mjs");
  });

  it("points read-local-memory at the nested dist path", () => {
    expect(readLocalMemoryBin).toContain("../scripts/read-local-memory/dist/scripts/read-local-memory/read-local-memory.js");
  });
});
