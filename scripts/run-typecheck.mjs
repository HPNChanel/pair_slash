#!/usr/bin/env node
// PairSlash typecheck runner.
//
// Phase M3 complete: the root tsconfig.json is the single strict config.
// All packages under packages/**/*.ts are checked under strict mode and this
// gate is wired into CI via `npm run typecheck`.
//
// This script does not weaken type safety: the real `tsc` runs and its exit
// code is forwarded unchanged.

import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SOURCE_ROOTS = ["packages"];
const IGNORE_DIRS = new Set(["node_modules", "dist", "artifacts"]);

function walkTs(rootDir) {
  let stack;
  try {
    stack = readdirSync(rootDir).map((entry) => join(rootDir, entry));
  } catch {
    return false;
  }
  while (stack.length > 0) {
    const current = stack.pop();
    let stats;
    try {
      stats = statSync(current);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      const base = current.split(/[\\/]/).pop();
      if (IGNORE_DIRS.has(base)) {
        continue;
      }
      try {
        for (const entry of readdirSync(current)) {
          stack.push(join(current, entry));
        }
      } catch {
        continue;
      }
    } else if (stats.isFile() && current.endsWith(".ts") && !current.endsWith(".d.ts")) {
      return true;
    }
  }
  return false;
}

const hasTsSource = SOURCE_ROOTS.some((root) => walkTs(join(ROOT, root)));

if (!hasTsSource) {
  process.stdout.write(
    "typecheck: no TypeScript source found under packages/.\n" +
      "This gate is intentionally inert until TypeScript source exists.\n",
  );
  process.exit(0);
}

const result = spawnSync("tsc", ["--noEmit", "-p", "tsconfig.json"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
