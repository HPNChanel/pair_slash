#!/usr/bin/env node
// PairSlash fuzz harness — memory-engine conflict detection (T9-04).
//
// Property-based testing over the pure conflict/duplicate detectors in
// packages/core/memory-engine/src/conflict.ts. Nightly-only; never in PR
// gates. All runs are seeded and counterexamples persist under
// tests/fuzz/corpus/ so a finding is always replayable.
//
// Usage:
//   npm run test:fuzz                          # default seed + 200 runs
//   node tests/fuzz/run-fuzz.mjs --seed 1234 --runs 500
//   node tests/fuzz/run-fuzz.mjs --report-out artifacts/fuzz.json
//   node tests/fuzz/run-fuzz.mjs --corpus-only # replay committed corpus only

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import process from "node:process";

import fc from "fast-check";

import {
  collectRelatedRecords,
  detectConflicts,
  detectDuplicates,
  detectShadowWarnings,
  findCandidateConflicts,
  findSupersedeTarget,
} from "../../packages/core/memory-engine/src/conflict.ts";

const CORPUS_DIR = "tests/fuzz/corpus";
const DEFAULT_SEED = 20261001;
const DEFAULT_RUNS = 200;

// ---------- arbitraries ----------

// Adversarial scalar soup: unicode, huge strings, wrong types, nulls.
const arbScalar = fc.oneof(
  fc.string({ maxLength: 40 }),
  fc.string({ maxLength: 200 }),
  fc.constant(""),
  fc.constant("\u0000\u0000"),
  fc.constant("x".repeat(10000)),
  fc.integer(),
  fc.float(),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  fc.array(fc.string({ maxLength: 10 }), { maxLength: 5 }),
  fc.dictionary(fc.string({ maxLength: 8 }), fc.string({ maxLength: 12 })),
);

const arbKind = fc.oneof(
  fc.constantFrom("decision", "command", "glossary", "constraint", "ownership", "incident-lesson", "pattern"),
  arbScalar,
);

const arbScope = fc.oneof(
  fc.constantFrom("whole-project", "subsystem", "path-prefix"),
  arbScalar,
);

const arbRecord = fc.record(
  {
    kind: arbKind,
    title: arbScalar,
    statement: arbScalar,
    scope: arbScope,
    scope_detail: arbScalar,
    supersedes: arbScalar,
    confidence: fc.oneof(fc.constantFrom("low", "medium", "high"), arbScalar),
    action: fc.oneof(fc.constantFrom("append", "supersede", "reject-candidate-if-conflict"), arbScalar),
  },
  { requiredKeys: [] },
);

const arbLayer = fc.oneof(
  fc.constantFrom("global-project-memory", "task-memory"),
  fc.constantFrom("session-context", "candidate-memory"),
  arbScalar,
);

const arbEntry = fc.record(
  {
    layer: arbLayer,
    file: fc.string({ maxLength: 60 }),
    artifact_path: fc.oneof(arbScalar, fc.constant(undefined)),
    record: arbRecord,
  },
  { requiredKeys: ["layer", "record"] },
);

const arbExisting = fc.array(arbEntry, { maxLength: 12 });

// ---------- helpers ----------

function isNaNValue(value) {
  return typeof value === "number" && Number.isNaN(value);
}

function safeCall(fn, ...args) {
  try {
    return { ok: true, value: fn(...args) };
  } catch (error) {
    return { ok: false, error: String(error instanceof Error ? error.stack ?? error : error) };
  }
}

// ---------- properties ----------

const PROPERTIES = [
  {
    id: "detectors-never-throw",
    build: () =>
      fc.property(arbExisting, arbRecord, (existing, record) => {
        for (const detector of [
          detectDuplicates,
          detectConflicts,
          findCandidateConflicts,
          findSupersedeTarget,
          detectShadowWarnings,
          collectRelatedRecords,
        ]) {
          const result = safeCall(detector, existing, record);
          if (!result.ok) {
            return { fail: `threw:${result.error.split("\n")[0]}` };
          }
        }
        return true;
      }),
  },
  {
    id: "identical-record-is-duplicate",
    build: () =>
      fc.property(arbExisting, arbRecord, (existing, record) => {
        // Record equality in the detectors is `===`-based; NaN fields can
        // never equal themselves, so the duplicate invariant only applies to
        // records whose ===-compared fields are not NaN.
        fc.pre(!isNaNValue(record.kind) && !isNaNValue(record.scope));
        const entry = {
          layer: "global-project-memory",
          file: "fuzz-entry.yaml",
          record,
        };
        const result = safeCall(detectDuplicates, [...existing, entry], record);
        if (!result.ok) {
          return { fail: `threw:${result.error.split("\n")[0]}` };
        }
        // The identical entry must be detected whenever the detector can
        // evaluate it at all — a miss here is a real finding.
        if (result.value.every((e) => e !== entry)) {
          return { fail: "identical record not reported as duplicate" };
        }
        return true;
      }),
  },
  {
    id: "detectors-are-deterministic",
    build: () =>
      fc.property(arbExisting, arbRecord, (existing, record) => {
        for (const detector of [detectDuplicates, detectConflicts, findCandidateConflicts, collectRelatedRecords]) {
          const first = safeCall(detector, existing, record);
          const second = safeCall(detector, existing, record);
          if (first.ok !== second.ok) {
            return { fail: "nondeterministic throw behavior" };
          }
          if (first.ok && JSON.stringify(first.value) !== JSON.stringify(second.value)) {
            return { fail: "nondeterministic result" };
          }
        }
        return true;
      }),
  },
  {
    id: "supersede-target-never-orphans",
    build: () =>
      fc.property(arbExisting, arbRecord, (existing, record) => {
        const result = safeCall(findSupersedeTarget, existing, record);
        if (!result.ok) {
          return { fail: `threw:${result.error.split("\n")[0]}` };
        }
        const target = result.value;
        if (target !== undefined && !existing.includes(target)) {
          return { fail: "supersede target outside existing set" };
        }
        if (target !== undefined && target.layer !== "global-project-memory") {
          return { fail: "supersede target is not a global record" };
        }
        return true;
      }),
  },
];

// ---------- corpus ----------

function persistCounterexample(propertyId, error) {
  const dir = resolve(process.cwd(), CORPUS_DIR);
  mkdirSync(dir, { recursive: true });
  const seed = error?.seed ?? "unknown";
  const digest = createHash("sha256")
    .update(JSON.stringify(error?.counterexample ?? null))
    .digest("hex")
    .slice(0, 12);
  const file = join(dir, `${propertyId}-${seed}-${digest}.json`);
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        property: propertyId,
        seed: error?.seed ?? null,
        path: error?.path ?? null,
        counterexample: error?.counterexample ?? null,
        captured_at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
  return file;
}

function replayCorpus(repoRoot) {
  const dir = resolve(repoRoot, CORPUS_DIR);
  const failures = [];
  let files = [];
  try {
    files = readdirSync(dir).filter((name) => name.endsWith(".json"));
  } catch {
    return { replayed: 0, failures };
  }
  for (const name of files.sort()) {
    const corpus = JSON.parse(readFileSync(join(dir, name), "utf8"));
    const property = PROPERTIES.find((entry) => entry.id === corpus.property);
    if (!property || corpus.seed === null) {
      continue;
    }
    const outcome = fc.check(property.build(), {
      seed: corpus.seed,
      numRuns: 500,
      endOnFailure: true,
    });
    if (outcome.failed) {
      failures.push({ file: name, seed: corpus.seed });
    }
  }
  return { replayed: files.length, failures };
}

// ---------- runner ----------

export function runFuzzSuite({ repoRoot, seed = DEFAULT_SEED, runs = DEFAULT_RUNS, corpusOnly = false }) {
  const started = Date.now();
  const corpusResult = replayCorpus(repoRoot);
  const results = [];
  if (!corpusOnly) {
    for (const property of PROPERTIES) {
      const outcome = fc.check(property.build(), {
        seed,
        numRuns: runs,
        endOnFailure: true,
      });
      const entry = {
        property: property.id,
        runs: outcome.numRuns,
        failed: outcome.failed,
        seed,
      };
      if (outcome.failed) {
        entry.counterexample = outcome.counterexample;
        entry.corpus_file = persistCounterexample(property.id, outcome);
      }
      results.push(entry);
    }
  }
  return {
    kind: "pairslash-fuzz-report/v1",
    scope: "packages/core/memory-engine/src/conflict.ts",
    seed,
    runs,
    corpus_replayed: corpusResult.replayed,
    corpus_failures: corpusResult.failures,
    duration_ms: Date.now() - started,
    properties: results,
    failures: [
      ...results.filter((entry) => entry.failed).map((entry) => entry.property),
      ...corpusResult.failures.map((entry) => `corpus:${entry.file}`),
    ],
  };
}

function main(argv) {
  const readValue = (flag) => {
    const index = argv.indexOf(flag);
    return index === -1 ? null : argv[index + 1];
  };
  const seed = (() => {
    const raw = readValue("--seed");
    const value = raw === null ? DEFAULT_SEED : Number.parseInt(raw, 10);
    return Number.isFinite(value) ? value : DEFAULT_SEED;
  })();
  const runs = (() => {
    const raw = readValue("--runs");
    const value = raw === null ? DEFAULT_RUNS : Number.parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_RUNS;
  })();
  const repoRoot = resolve(process.cwd());
  const report = runFuzzSuite({
    repoRoot,
    seed,
    runs,
    corpusOnly: argv.includes("--corpus-only"),
  });
  const reportOut = readValue("--report-out");
  if (reportOut) {
    const absolute = resolve(reportOut);
    mkdirSync(resolve(absolute, ".."), { recursive: true });
    writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(
    `fuzz report (seed ${report.seed}, ${report.runs} runs/property, corpus replayed ${report.corpus_replayed})\n`,
  );
  for (const entry of report.properties) {
    process.stdout.write(
      `  ${entry.failed ? "FAIL" : "pass"}  ${entry.property}  (${entry.runs} runs)\n`,
    );
  }
  if (report.failures.length > 0) {
    process.stdout.write(
      `findings: ${report.failures.join(", ")} — counterexamples persisted under ${CORPUS_DIR}/\n`,
    );
    process.exit(1); // nightly-only lane: a finding must be visible, not silent
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url === new URL(`file:///${resolve(process.argv[1]).replace(/\\/g, "/")}`).href) {
  main(process.argv.slice(2));
}
