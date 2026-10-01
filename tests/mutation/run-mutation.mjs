#!/usr/bin/env node
// PairSlash mutation-testing pilot (nightly-only, report-only — T9-03).
//
// Scope: packages/core/memory-engine/src/** — the authoritative-write
// pipeline where weak tests are most dangerous. For each deterministic
// mutation site one operator is applied to the source file in place,
// `node --test` runs that package's test file, and the pristine source
// is restored immediately after (also on crash via an exit hook).
// Mutants are never committed.
//
// Tooling note: Stryker was evaluated first; this repo's file: workspace
// links + Node type-stripping make Stryker's sandbox model (copy project,
// no node_modules unless installed per sandbox) disproportionately heavy
// for a report-only pilot, and it has no first-class node:test runner.
// This in-repo runner is the minimal viable alternative the task allows.
//
// Usage:
//   node tests/mutation/run-mutation.mjs                 # full pilot
//   node tests/mutation/run-mutation.mjs --max-mutants 40
//   node tests/mutation/run-mutation.mjs --report-out <path>
//   node tests/mutation/run-mutation.mjs --list          # enumerate sites only

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative, resolve } from "node:path";
import process from "node:process";

const PACKAGE_DIR = "packages/core/memory-engine";
const SOURCE_GLOB_DIR = "src";
const TEST_FILE = "tests/memory-engine.test.js";
const MUTANT_TIMEOUT_MS = 90_000;
const DEFAULT_MAX_MUTANTS = 200;


// Each rule mutates the first match on a line. Order is deterministic.
const OPERATORS = [
  { name: "eq-to-neq", pattern: /===/, replace: "!==" },
  { name: "neq-to-eq", pattern: /!==/, replace: "===" },
  { name: "gt-to-gte", pattern: /(?<![-=])>(?![=>])/, replace: ">=" },
  { name: "lt-to-lte", pattern: /(?<![-=])<(?![-=])/, replace: "<=" },
  { name: "gte-to-gt", pattern: />=/, replace: ">" },
  { name: "lte-to-lt", pattern: /<=/, replace: "<" },
  { name: "and-to-or", pattern: /&&/, replace: "||" },
  { name: "or-to-and", pattern: /\|\|/, replace: "&&" },
  { name: "true-to-false", pattern: /\btrue\b/, replace: "false" },
  { name: "false-to-true", pattern: /\bfalse\b/, replace: "true" },
];

// Lines where a textual mutation is almost certainly type-level, comments,
// or syntax scaffolding — mutating them yields noise, not signal.
const SKIP_LINE = /^\s*(\/\/|\*|import\b|export\s+(type|interface)\b|interface\b|type\b)|:\s*[A-Z][A-Za-z]*[\[\]|]|case\s.*:$/;

export function enumerateMutationSites(sourceText, fileRel) {
  const sites = [];
  const lines = sourceText.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "" || SKIP_LINE.test(line)) {
      continue;
    }
    for (const op of OPERATORS) {
      if (op.pattern.test(line)) {
        sites.push({
          id: `${fileRel}:${index + 1}:${op.name}`,
          file: fileRel,
          line: index + 1,
          operator: op.name,
          from: line.trim().slice(0, 120),
        });
      }
    }
  }
  return sites;
}

function applyMutation(sourceText, site, operator) {
  const lines = sourceText.split("\n");
  const target = lines[site.line - 1];
  lines[site.line - 1] = target.replace(operator.pattern, operator.replace);
  return lines.join("\n");
}

export function planMutants(packageDir) {
  const srcDir = join(packageDir, SOURCE_GLOB_DIR);
  const sites = [];
  for (const entry of readdirSyncRecursive(srcDir)) {
    if (!entry.endsWith(".ts")) {
      continue;
    }
    const fileRel = relative(packageDir, entry).replace(/\\/g, "/");
    const text = readFileSync(entry, "utf8");
    sites.push(...enumerateMutationSites(text, fileRel));
  }
  sites.sort((left, right) => left.id.localeCompare(right.id));
  return sites;
}

function* readdirSyncRecursive(dir) {
  for (const entry of readdirSyncSafe(dir)) {
    const full = join(dir, entry);
    try {
      if (statSyncSafe(full)?.isDirectory()) {
        yield* readdirSyncRecursive(full);
      } else {
        yield full;
      }
    } catch {
      // unreadable entry — skip
    }
  }
}

function readdirSyncSafe(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
function statSyncSafe(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function runMutant(workDir, fileRel, mutantText) {
  const target = join(workDir, fileRel);
  writeFileSync(target, mutantText, "utf8");
  const start = Date.now();
  const result = spawnSync(
    process.execPath,
    ["--test", TEST_FILE],
    { cwd: workDir, timeout: MUTANT_TIMEOUT_MS, encoding: "utf8" },
  );
  const duration = Date.now() - start;
  if (result.error && result.error.code === "ETIMEDOUT") {
    return { status: "timeout", duration_ms: duration };
  }
  if (result.error) {
    return { status: "error", duration_ms: duration, detail: String(result.error) };
  }
  if (result.signal) {
    return { status: "timeout", duration_ms: duration, detail: `signal:${result.signal}` };
  }
  if (result.status === 0) {
    return { status: "survived", duration_ms: duration };
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (/SyntaxError|ERR_UNKNOWN|Cannot find/.test(output)) {
    return { status: "error", duration_ms: duration, detail: output.split("\n").find((l) => l.trim()) ?? "" };
  }
  return { status: "killed", duration_ms: duration };
}

export function runMutationPilot({
  repoRoot,
  maxMutants = DEFAULT_MAX_MUTANTS,
} = {}) {
  const packageDir = resolve(repoRoot, PACKAGE_DIR);
  const sites = planMutants(packageDir);
  const capped = sites.slice(0, maxMutants);
  const truncated = sites.length - capped.length;

  // Mutate in place: package tests resolve repo-level helpers via relative
  // paths, so a copied package cannot run. The original buffer is always
  // restored after each mutant — including on crash via the exit hook.
  let activeRestore = null;
  const restoreActive = () => {
    if (activeRestore !== null) {
      try {
        writeFileSync(activeRestore.path, activeRestore.contents, "utf8");
      } catch {
        // best-effort restore on crash
      }
      activeRestore = null;
    }
  };
  process.on("exit", restoreActive);

  const mutants = [];
  try {
    for (const site of capped) {
      const operator = OPERATORS.find((op) => op.name === site.operator);
      const absolute = join(packageDir, site.file);
      const original = readFileSync(absolute, "utf8");
      const mutated = applyMutation(original, site, operator);
      activeRestore = { path: absolute, contents: original };
      const outcome = runMutant(packageDir, site.file, mutated);
      mutants.push({ ...site, ...outcome });
      restoreActive();
    }
  } finally {
    restoreActive();
    process.removeListener("exit", restoreActive);
  }

  const totals = { killed: 0, survived: 0, timeout: 0, error: 0 };
  for (const mutant of mutants) {
    totals[mutant.status] += 1;
  }
  const denominator = mutants.length - totals.error;
  return {
    kind: "pairslash-mutation-report/v1",
    package: PACKAGE_DIR,
    measured_at: new Date().toISOString(),
    env: `${process.platform}-node${process.versions.node.split(".")[0]}`,
    site_count: sites.length,
    mutants_run: mutants.length,
    truncated_sites: truncated,
    totals,
    // Mutation score convention: killed / (all - errors). Timeouts count as
    // killed (the suite did terminate them) — honest accounting per T9-03.
    score: denominator === 0
      ? null
      : Math.round(((totals.killed + totals.timeout) / denominator) * 1000) / 1000,
    mutants,
  };
}

function main(argv) {
  const repoRoot = resolve(process.cwd());
  const readValue = (flag) => {
    const index = argv.indexOf(flag);
    return index === -1 ? null : argv[index + 1];
  };
  const maxMutants = (() => {
    const raw = readValue("--max-mutants");
    const value = raw === null ? DEFAULT_MAX_MUTANTS : Number.parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_MUTANTS;
  })();
  const packageDir = resolve(repoRoot, PACKAGE_DIR);

  if (argv.includes("--list")) {
    const sites = planMutants(packageDir);
    for (const site of sites) {
      process.stdout.write(`${site.id}  ${site.from}\n`);
    }
    process.stdout.write(`${sites.length} mutation sites\n`);
    return;
  }

  const report = runMutationPilot({ repoRoot, maxMutants });
  const reportOut = readValue("--report-out");
  if (reportOut) {
    const absolute = resolve(reportOut);
    mkdirSync(resolve(absolute, ".."), { recursive: true });
    writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(
    `mutation report (${report.package}, env ${report.env})\n` +
      `  sites: ${report.site_count} (ran ${report.mutants_run}${report.truncated_sites > 0 ? `, ${report.truncated_sites} truncated` : ""})\n` +
      `  killed ${report.totals.killed} · survived ${report.totals.survived} · timeout ${report.totals.timeout} · error ${report.totals.error}\n` +
      `  score: ${report.score === null ? "n/a" : report.score}\n`,
  );
  for (const survivor of report.mutants.filter((m) => m.status === "survived")) {
    process.stdout.write(`  survivor ${survivor.id}  ${survivor.from}\n`);
  }
  process.exit(0); // report-only: never fails the lane
}

if (process.argv[1] && import.meta.url === new URL(`file:///${resolve(process.argv[1]).replace(/\\/g, "/")}`).href) {
  main(process.argv.slice(2));
}
