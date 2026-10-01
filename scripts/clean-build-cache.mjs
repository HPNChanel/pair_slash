#!/usr/bin/env node
// PairSlash build-cache cleanup.
//
// Removes PairSlash-owned, regenerable build/test caches so large local builds
// and test runs do not silently fill the machine's disk. Everything this tool
// deletes is reproducible output; authoritative memory (.pairslash/project-memory,
// .pairslash/audit-log, .pairslash/staging) and user/system caches outside the
// repo are never touched.
//
// Usage:
//   node scripts/clean-build-cache.mjs            # dry-run preview
//   node scripts/clean-build-cache.mjs --apply    # delete caches
//   node scripts/clean-build-cache.mjs --json     # machine-readable report
//   npm run clean:cache                           # apply via npm script

import {
  existsSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

export const CACHE_TARGETS = Object.freeze({
  // Repo-relative directories whose contents are pure cache.
  repoDirs: [
    ".pairslash/tmp",
    "coverage",
    "node_modules/.cache",
  ],
  // Repo-relative directory basenames removed wherever they appear under
  // packages/ (build output caches).
  packageDirNames: ["dist", ".cache", "coverage"],
  // File suffixes treated as incremental-build caches.
  fileSuffixes: [".tsbuildinfo", ".eslintcache"],
  // Prefix of scratch directories PairSlash test helpers create under the OS
  // temp dir; only entries older than staleMs are touched so a concurrent run
  // is never swept from underneath itself.
  tempPrefixes: ["pairslash-"],
});

const STALE_MS = 60 * 60 * 1000; // 1 hour

function dirSize(target) {
  let bytes = 0;
  let stack = [target];
  while (stack.length > 0) {
    const current = stack.pop();
    let stats;
    try {
      stats = statSync(current);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      try {
        for (const entry of readdirSync(current)) {
          stack.push(join(current, entry));
        }
      } catch {
        // unreadable directory — skip
      }
    } else {
      bytes += stats.size;
    }
  }
  return bytes;
}

function* walkDirs(rootDir, { skipNodeModules = true } = {}) {
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (skipNodeModules && entry.name === "node_modules") {
          continue;
        }
        yield full;
        stack.push(full);
      }
    }
  }
}

function* walkFiles(rootDir) {
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") {
          continue;
        }
        stack.push(full);
      } else {
        yield full;
      }
    }
  }
}

export function planCacheClean(repoRoot, { now = Date.now() } = {}) {
  const targets = [];
  const add = (path, reason) => {
    if (existsSync(path)) {
      targets.push({ path, reason, bytes: dirSize(path) });
    }
  };

  for (const rel of CACHE_TARGETS.repoDirs) {
    add(join(repoRoot, rel), `repo-cache:${rel}`);
  }

  const packagesRoot = join(repoRoot, "packages");
  if (existsSync(packagesRoot)) {
    for (const dir of walkDirs(packagesRoot)) {
      const base = dir.split(/[\\/]/).pop();
      if (CACHE_TARGETS.packageDirNames.includes(base)) {
        targets.push({ path: dir, reason: `package-cache:${base}`, bytes: dirSize(dir) });
      }
    }
    for (const file of walkFiles(packagesRoot)) {
      if (CACHE_TARGETS.fileSuffixes.some((suffix) => file.endsWith(suffix))) {
        targets.push({ path: file, reason: "incremental-cache", bytes: statSync(file).size });
      }
    }
  }

  // Stale PairSlash scratch dirs under the OS temp dir.
  const systemTemp = tmpdir();
  try {
    for (const entry of readdirSync(systemTemp, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (!CACHE_TARGETS.tempPrefixes.some((prefix) => entry.name.startsWith(prefix))) {
        continue;
      }
      const full = join(systemTemp, entry.name);
      let stats;
      try {
        stats = statSync(full);
      } catch {
        continue;
      }
      if (now - stats.mtimeMs < STALE_MS) {
        continue; // fresh — possibly owned by a concurrent run
      }
      targets.push({ path: full, reason: "stale-test-temp", bytes: dirSize(full) });
    }
  } catch {
    // temp dir unreadable — nothing to sweep
  }

  targets.sort((left, right) => left.path.localeCompare(right.path));
  return targets;
}

export function cleanBuildCaches(repoRoot, { apply = false, now = Date.now() } = {}) {
  const targets = planCacheClean(repoRoot, { now });
  const removed = [];
  const errors = [];
  if (apply) {
    for (const target of targets) {
      try {
        rmSync(target.path, { recursive: true, force: true });
        removed.push(target.path);
      } catch (error) {
        errors.push(`${target.path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return {
    kind: "build-cache-clean",
    apply,
    freed_bytes: targets.reduce((sum, target) => sum + target.bytes, 0),
    targets,
    removed,
    errors,
  };
}

function main(argv) {
  const apply = argv.includes("--apply");
  const asJson = argv.includes("--json");
  const repoRoot = resolve(process.cwd());
  const report = cleanBuildCaches(repoRoot, { apply });
  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    const mode = apply ? "removed" : "would remove (dry-run — pass --apply)";
    process.stdout.write(`build-cache-clean: ${mode} ${report.targets.length} target(s), ` +
      `${(report.freed_bytes / (1024 * 1024)).toFixed(1)} MiB\n`);
    for (const target of report.targets) {
      process.stdout.write(`  ${target.reason}  ${target.path}\n`);
    }
    for (const error of report.errors) {
      process.stderr.write(`  error: ${error}\n`);
    }
  }
  process.exit(report.errors.length > 0 ? 1 : 0);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2));
}
