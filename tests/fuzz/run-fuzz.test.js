import test from "node:test";
import assert from "node:assert/strict";

import { runFuzzSuite } from "./run-fuzz.mjs";

// Bounded shape smoke only — the full seeded exploration runs nightly (T9-04).

test("fuzz suite produces report-only output with deterministic seed accounting", () => {
  const report = runFuzzSuite({ repoRoot: process.cwd(), seed: 1, runs: 10, corpusOnly: false });
  assert.equal(report.kind, "pairslash-fuzz-report/v1");
  assert.equal(report.scope, "packages/core/memory-engine/src/conflict.ts");
  assert.equal(report.properties.length, 4);
  assert.ok(report.properties.every((entry) => typeof entry.runs === "number"));
  assert.ok(Array.isArray(report.failures));
});

test("fuzz corpus replay does not fail on the committed seed history", () => {
  const report = runFuzzSuite({ repoRoot: process.cwd(), corpusOnly: true });
  assert.deepEqual(report.corpus_failures, []);
});
