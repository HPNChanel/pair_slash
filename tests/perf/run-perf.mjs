#!/usr/bin/env node
// PairSlash perf regression suite (nightly-only, informational).
//
// Measures a small set of deterministic operations and compares medians
// against the committed baseline for the current environment class
// (os + node major). Regressions are reported as warnings — they are
// signals for review, never automatic failures (T9-02).
//
// Usage:
//   node tests/perf/run-perf.mjs                    # measure + compare
//   node tests/perf/run-perf.mjs --update-baseline  # record this env's baseline
//   node tests/perf/run-perf.mjs --report-out <p>   # also write JSON report
//   node tests/perf/run-perf.mjs --runs 9 --warmup 3

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";

import { compileCodexPack } from "@pairslash/compiler-codex";
import { compileCopilotPack } from "@pairslash/compiler-copilot";
import { previewMemoryWrite } from "@pairslash/memory-engine";
import { discoverPackManifestPaths, loadPublicSupportSnapshot } from "@pairslash/spec-core";
import { planInstall } from "@pairslash/installer";

import { createTempRepo } from "../phase4-helpers.js";

const BASELINE_PATH = "tests/perf/baseline.json";
const REGRESSION_FACTOR = 2.0;
const IMPROVEMENT_FACTOR = 0.5;

const WARMUP_DEFAULT = 2;
const RUNS_DEFAULT = 7;

function envKey() {
  return `${process.platform}-node${process.versions.node.split(".")[0]}`;
}

function median(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function buildCases(tempRoot) {
  const manifestPath = discoverPackManifestPaths(tempRoot)
    .find((candidate) => candidate.includes("pairslash-plan"));
  if (!manifestPath) {
    throw new Error("perf: pairslash-plan manifest not found in fixture repo");
  }
  const memoryRequest = {
    kind: "pattern",
    title: "perf baseline probe",
    statement: "Perf suite probe record; never applied.",
    evidence: "tests/perf/run-perf.mjs",
    scope: "whole-project",
    confidence: "medium",
    action: "append",
    updated_by: "perf-suite",
  };
  return [
    {
      id: "catalog-snapshot-load",
      run: () => loadPublicSupportSnapshot(tempRoot),
    },
    {
      id: "compile-codex-pairslash-plan",
      run: () => compileCodexPack({ repoRoot: tempRoot, manifestPath }),
    },
    {
      id: "compile-copilot-pairslash-plan",
      run: () => compileCopilotPack({ repoRoot: tempRoot, manifestPath }),
    },
    {
      id: "install-preview-codex",
      run: () =>
        planInstall({
          repoRoot: tempRoot,
          runtime: "codex_cli",
          target: "repo",
          packs: ["pairslash-plan"],
        }),
    },
    {
      id: "memory-write-preview",
      run: () =>
        previewMemoryWrite({
          repoRoot: tempRoot,
          request: memoryRequest,
          runtime: "codex_cli",
          target: "repo",
        }),
    },
  ];
}

function measure(fn, { warmup, runs }) {
  for (let index = 0; index < warmup; index += 1) {
    fn();
  }
  const samples = [];
  for (let index = 0; index < runs; index += 1) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  return { samples, median_ms: median(samples) };
}

function loadBaseline(repoRoot) {
  const absolute = resolve(repoRoot, BASELINE_PATH);
  if (!existsSync(absolute)) {
    return { version: 1, environments: {} };
  }
  return JSON.parse(readFileSync(absolute, "utf8"));
}

export function runPerfSuite({ repoRoot, warmup = WARMUP_DEFAULT, runs = RUNS_DEFAULT }) {
  const fixture = createTempRepo({ packs: ["pairslash-plan", "pairslash-memory-write-global"] });
  try {
    const cases = buildCases(fixture.tempRoot);
    const env = envKey();
    const baseline = loadBaseline(repoRoot);
    const envBaseline = baseline.environments?.[env]?.cases ?? {};
    const results = [];
    for (const testCase of cases) {
      const { samples, median_ms } = measure(testCase.run, { warmup, runs });
      const expected = envBaseline[testCase.id]?.median_ms ?? null;
      let status = "no-baseline";
      let ratio = null;
      if (typeof expected === "number" && expected > 0) {
        ratio = median_ms / expected;
        if (ratio > REGRESSION_FACTOR) {
          status = "regression";
        } else if (ratio < IMPROVEMENT_FACTOR) {
          status = "suspiciously-fast";
        } else {
          status = "ok";
        }
      }
      results.push({
        case: testCase.id,
        median_ms: Math.round(median_ms * 1000) / 1000,
        baseline_ms: expected,
        ratio: ratio === null ? null : Math.round(ratio * 100) / 100,
        samples: samples.map((sample) => Math.round(sample * 1000) / 1000),
        runs,
        warmup,
        status,
      });
    }
    return {
      kind: "pairslash-perf-report/v1",
      env,
      node: process.versions.node,
      platform: process.platform,
      measured_at: new Date().toISOString(),
      runs,
      warmup,
      regression_factor: REGRESSION_FACTOR,
      results,
      regressions: results.filter((entry) => entry.status === "regression").map((entry) => entry.case),
    };
  } finally {
    fixture.cleanup();
  }
}

function writeBaseline(repoRoot, report) {
  const baseline = loadBaseline(repoRoot);
  baseline.environments = baseline.environments ?? {};
  baseline.environments[report.env] = {
    node: report.node,
    platform: report.platform,
    recorded_at: report.measured_at,
    runs: report.runs,
    warmup: report.warmup,
    cases: Object.fromEntries(
      report.results.map((entry) => [entry.case, { median_ms: entry.median_ms }]),
    ),
  };
  const absolute = resolve(repoRoot, BASELINE_PATH);
  mkdirSync(resolve(absolute, ".."), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(baseline, null, 2)}\n`);
  return absolute;
}

function main(argv) {
  const updateBaseline = argv.includes("--update-baseline");
  const reportOutIndex = argv.indexOf("--report-out");
  const reportOut = reportOutIndex === -1 ? null : argv[reportOutIndex + 1];
  const readNumber = (flag, fallback) => {
    const index = argv.indexOf(flag);
    if (index === -1) {
      return fallback;
    }
    const value = Number.parseInt(argv[index + 1] ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  const repoRoot = resolve(process.cwd());
  const report = runPerfSuite({
    repoRoot,
    warmup: readNumber("--warmup", WARMUP_DEFAULT),
    runs: readNumber("--runs", RUNS_DEFAULT),
  });
  if (updateBaseline) {
    const path = writeBaseline(repoRoot, report);
    process.stdout.write(`baseline updated: ${path}\n`);
  }
  if (reportOut) {
    mkdirSync(resolve(reportOut, ".."), { recursive: true });
    writeFileSync(resolve(reportOut), `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(`perf report (env ${report.env}, ${report.runs} runs + ${report.warmup} warmup):\n`);
  for (const entry of report.results) {
    const baselineText = entry.baseline_ms === null ? "no baseline" : `${entry.baseline_ms}ms (x${entry.ratio})`;
    process.stdout.write(
      `  ${entry.status.padEnd(18)} ${entry.case.padEnd(32)} median ${entry.median_ms}ms vs ${baselineText}\n`,
    );
  }
  if (report.regressions.length > 0) {
    process.stdout.write(
      `warning: ${report.regressions.length} case(s) regressed beyond ${REGRESSION_FACTOR}x — review signal, not a failure.\n`,
    );
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url === new URL(`file:///${resolve(process.argv[1]).replace(/\\/g, "/")}`).href) {
  main(process.argv.slice(2));
}
