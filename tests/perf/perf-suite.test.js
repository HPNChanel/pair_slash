import test from "node:test";
import assert from "node:assert/strict";

import { runPerfSuite } from "./run-perf.mjs";
import { repoRoot } from "../phase4-helpers.js";

test("perf suite produces an honest report shape for all pinned cases", () => {
  const report = runPerfSuite({ repoRoot, warmup: 0, runs: 1 });
  assert.equal(report.kind, "pairslash-perf-report/v1");
  assert.equal(report.results.length, 5);
  for (const entry of report.results) {
    assert.ok(entry.median_ms > 0, `${entry.case} median must be positive`);
    assert.equal(entry.samples.length, 1);
    assert.ok(
      ["ok", "regression", "suspiciously-fast", "no-baseline"].includes(entry.status),
      `${entry.case} status must be a known verdict`,
    );
  }
});
