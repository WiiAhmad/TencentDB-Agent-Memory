#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const entryScript = path.resolve(thisDir, "../scripts/read-local-memory/dist/scripts/read-local-memory/read-local-memory.js");

if (!fs.existsSync(entryScript)) {
  console.error("❌  Precompiled artifact not found: " + entryScript);
  console.error("   Please run first: npm run build:read-local-memory or bun run build:read-local-memory");
  process.exit(1);
}

import(pathToFileURL(entryScript).href);
