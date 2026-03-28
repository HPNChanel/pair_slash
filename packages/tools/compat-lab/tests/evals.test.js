import test from "node:test";
import assert from "node:assert/strict";

import {
  formatCompatBehaviorEvalsText,
  runCompatBehaviorEvals,
} from "@pairslash/compat-lab";

import { repoRoot } from "../../../../tests/compat-lab-helpers.js";

test("compat behavior eval suite covers all Phase 6 categories", () => {
  const report = runCompatBehaviorEvals({
    repoRoot,
  });
  assert.equal(report.kind, "compat-behavior-eval-suite");
  assert.equal(report.status, "pass");
  assert.equal(report.summary.total, 6);
  assert.equal(report.summary.failed, 0);
  assert.deepEqual(
    report.results.map((result) => result.category),
    [
      "workflow_selection",
      "policy_gates",
      "compatibility_errors",
      "preview_behavior",
      "degraded_lane_handling",
      "no_silent_fallback",
    ],
  );
  const text = formatCompatBehaviorEvalsText(report);
  assert.match(text, /Compat behavior eval suite/);
  assert.match(text, /workflow-selection\.node-service\.codex/);
  assert.match(text, /no-silent-fallback\.unsafe-repo\.codex/);
});
