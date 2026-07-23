#!/usr/bin/env node
// PairSlash typecheck runner.
//
// Phase M1 (modernization foundation): no package source has been converted
// to TypeScript yet. `tsc --noEmit -p tsconfig.json` fails closed when there
// are zero `.ts` inputs, which would block CI on a no-op gate. This wrapper
// preserves the "no-op pass on day one" contract from the upgrade roadmap.
//
// Phase M3 (progressive strictness): a dual-config pipeline runs two tsc
// passes — first the relaxed root config (`tsconfig.json`), then the strict
// config (`tsconfig.strict.json`) for packages that have graduated. The
// strict pass is skipped when its `include` array is empty.
//
// This script does not weaken type safety: once any `.ts` source exists, the
// real `tsc` runs and its exit code is forwarded unchanged.

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
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
    "typecheck: no TypeScript source found under packages/ (Phase M1 no-op pass).\n" +
      "TypeScript migration begins in Phase M2; until then this gate is intentionally inert.\n",
  );
  process.exit(0);
}

const result = spawnSync("tsc", ["--noEmit", "-p", "tsconfig.json"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

// Phase M3: run strict config if it has any include entries.
let strictInclude = [];
try {
  const raw = JSON.parse(readFileSync(join(ROOT, "tsconfig.strict.json"), "utf-8"));
  strictInclude = Array.isArray(raw.include) ? raw.include : [];
} catch {
  // No strict config — skip silently.
}

if (strictInclude.length > 0) {
  const strictResult = spawnSync("tsc", ["--noEmit", "-p", "tsconfig.strict.json"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  process.exit(strictResult.status ?? 1);
}

process.exit(0);
