import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import YAML from "yaml";

import { planTruthSync, applyTruthSync } from "../src/truth-sync.ts";
import { loadPublicSupportSnapshot } from "@pairslash/spec-core";
import { createTempRepo } from "../../../../tests/phase4-helpers.js";

const LANE_ID = "codex-cli-repo-windows";
const LANE_RECORD = "docs/evidence/live-runtime/codex-cli-repo-windows.yaml";

function liveVerificationRecord(overrides = {}) {
  return {
    evidence_id: "live-codex-repo-windows-20261001-t9",
    evidence_class: "live_verification",
    captured_at: "2026-10-01T00:00:00Z",
    stale_at: "2027-01-01T00:00:00Z",
    expire_at: "2027-04-01T00:00:00Z",
    owner_id: "test",
    runtime_id: "codex_cli",
    target: "repo",
    os_lane: "Windows",
    host_profile_id: "windows-test",
    pack_scope: ["pairslash-plan"],
    workflow_scope: ["install"],
    capability_scope: ["repo_write"],
    entrypoint_path_used: "/skills",
    command: "pairslash install --preview",
    runtime_version: "0.153.4",
    verdict: "pass",
    summary: "test live verification record",
    freshness_state: "fresh",
    ...overrides,
  };
}

function previewPromotionInput(extra = {}) {
  return {
    laneId: LANE_ID,
    bumpEvidence: "live_verification",
    supportLevel: "preview",
    record: liveVerificationRecord(),
    surfaceVerdicts: { canonical_picker: "pass" },
    liveRefs: [LANE_RECORD],
    at: "2026-10-01T00:00:00Z",
    actor: "test-suite",
    ...extra,
  };
}

test("sync-truth plan is preview-only and leaves every file untouched", () => {
  const { tempRoot, cleanup } = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    const before = readFileSync(join(tempRoot, LANE_RECORD), "utf8");
    const plan = planTruthSync({ repoRoot: tempRoot, input: previewPromotionInput() });
    assert.equal(plan.ok, true);
    assert.equal(plan.kind, "sync-truth-plan");
    assert.equal(plan.from_level, "prep");
    assert.equal(plan.to_level, "preview");
    assert.ok(plan.diffs.length > 0);
    assert.ok(plan.ops.some((op) => op.path === LANE_RECORD));
    assert.ok(plan.ops.some((op) => op.path === "docs/compatibility/runtime-surface-matrix.yaml"));
    assert.ok(plan.ops.some((op) => op.path === "docs/compatibility/compatibility-matrix.md"));
    assert.ok(plan.ops.some((op) => op.path.startsWith(".pairslash/audit-log/")));
    assert.equal(readFileSync(join(tempRoot, LANE_RECORD), "utf8"), before);
  } finally {
    cleanup();
  }
});

test("sync-truth rejects unknown evidence classes", () => {
  const { tempRoot, cleanup } = createTempRepo({});
  try {
    const plan = planTruthSync({
      repoRoot: tempRoot,
      input: { laneId: LANE_ID, bumpEvidence: "fabricated" },
    });
    assert.equal(plan.ok, false);
    assert.ok(plan.errors.some((error) => error.includes("invalid-evidence-class")));
  } finally {
    cleanup();
  }
});

test("sync-truth denies evidence downgrade below recorded floor", () => {
  const { tempRoot, cleanup } = createTempRepo({});
  try {
    // Lane currently records live_smoke; pushing "deterministic" is rejected
    // outright, and any class below the recorded floor is denied.
    const plan = planTruthSync({
      repoRoot: tempRoot,
      input: {
        laneId: LANE_ID,
        bumpEvidence: "live_smoke",
        record: liveVerificationRecord({ evidence_class: "live_verification" }),
      },
    });
    assert.equal(plan.ok, false);
    assert.ok(
      plan.errors.some((error) => error.includes("evidence-downgrade-denied"))
        || plan.errors.some((error) => error.includes("policy:")),
    );
  } finally {
    cleanup();
  }
});

test("sync-truth rejects support-level ladder skips", () => {
  const { tempRoot, cleanup } = createTempRepo({});
  try {
    const plan = planTruthSync({
      repoRoot: tempRoot,
      input: previewPromotionInput({
        supportLevel: "stable-tested",
        bumpEvidence: "repeated_live_verification",
      }),
    });
    assert.equal(plan.ok, false);
    assert.ok(plan.errors.some((error) => error.includes("ladder-skip")));
  } finally {
    cleanup();
  }
});

test("sync-truth enforces promotion policy (canonical picker required for preview)", () => {
  const { tempRoot, cleanup } = createTempRepo({});
  try {
    const plan = planTruthSync({
      repoRoot: tempRoot,
      input: previewPromotionInput({ surfaceVerdicts: undefined }),
    });
    assert.equal(plan.ok, false);
    assert.ok(plan.errors.some((error) => error.includes("canonical")));
  } finally {
    cleanup();
  }
});

test("sync-truth rejects lane records that mismatch the lane identity", () => {
  const { tempRoot, cleanup } = createTempRepo({});
  try {
    const plan = planTruthSync({
      repoRoot: tempRoot,
      input: previewPromotionInput({
        record: liveVerificationRecord({ os_lane: "macOS" }),
      }),
    });
    assert.equal(plan.ok, false);
    assert.ok(plan.errors.some((error) => error.includes("record-lane-mismatch:os_lane")));
  } finally {
    cleanup();
  }
});

test("sync-truth apply commits atomically with journal, audit, and post-validation", () => {
  const { tempRoot, cleanup } = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    const plan = planTruthSync({ repoRoot: tempRoot, input: previewPromotionInput() });
    assert.equal(plan.ok, true);
    const result = applyTruthSync({ repoRoot: tempRoot, plan });
    assert.equal(result.ok, true);
    assert.equal(result.status, "committed");
    assert.ok(result.written.includes(LANE_RECORD));
    assert.ok(result.journal !== null);

    const laneYaml = YAML.parse(readFileSync(join(tempRoot, LANE_RECORD), "utf8"));
    assert.equal(laneYaml.current_public_support_level, "preview");
    assert.equal(laneYaml.best_live_evidence_class, "live_verification");
    assert.ok(
      laneYaml.live_records.some((entry) => entry.evidence_id === "live-codex-repo-windows-20261001-t9"),
    );

    const matrix = YAML.parse(
      readFileSync(join(tempRoot, "docs/compatibility/runtime-surface-matrix.yaml"), "utf8"),
    );
    const lane = matrix.runtime_lanes.find((entry) => entry.lane_id === LANE_ID);
    assert.equal(lane.support_level, "preview");
    assert.equal(lane.actual_evidence_class, "live_verification");

    const journal = JSON.parse(readFileSync(join(tempRoot, result.journal), "utf8"));
    assert.equal(journal.kind, "sync-truth-journal");
    assert.equal(journal.status, "committed");
    assert.equal(journal.lane_id, LANE_ID);

    const auditDir = join(tempRoot, ".pairslash", "audit-log");
    assert.ok(existsSync(auditDir));
    const verification = readFileSync(
      join(tempRoot, "docs/compatibility/runtime-verification.md"),
      "utf8",
    );
    assert.ok(verification.includes("sync-truth"));
    assert.ok(verification.includes(LANE_ID));

    // Post-validation: the committed state must reload cleanly.
    const snapshot = loadPublicSupportSnapshot(tempRoot);
    const snapped = snapshot.runtime_lanes.find((entry) => entry.lane_id === LANE_ID);
    assert.equal(snapped.support_level, "preview");
  } finally {
    cleanup();
  }
});

test("sync-truth apply rolls back every write when a later op fails", () => {
  const { tempRoot, cleanup } = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    const plan = planTruthSync({ repoRoot: tempRoot, input: previewPromotionInput() });
    assert.equal(plan.ok, true);
    const laneBefore = readFileSync(join(tempRoot, LANE_RECORD), "utf8");
    const matrixBefore = readFileSync(
      join(tempRoot, "docs/compatibility/runtime-surface-matrix.yaml"),
      "utf8",
    );
    // Inject a write that fails after earlier ops have been applied.
    plan.ops.push({ path: "../escape/sync-truth.txt", before: "", after: "x\n" });
    const result = applyTruthSync({ repoRoot: tempRoot, plan });
    assert.equal(result.ok, false);
    assert.equal(result.status, "rolled-back");
    assert.equal(result.written.length, 0);
    assert.equal(readFileSync(join(tempRoot, LANE_RECORD), "utf8"), laneBefore);
    assert.equal(
      readFileSync(join(tempRoot, "docs/compatibility/runtime-surface-matrix.yaml"), "utf8"),
      matrixBefore,
    );
    // Audit entry created during the failed apply must be removed, not left empty.
    const journal = JSON.parse(readFileSync(join(tempRoot, result.journal), "utf8"));
    assert.equal(journal.status, "rolled-back");
  } finally {
    cleanup();
  }
});

test("sync-truth apply refuses plans that did not validate", () => {
  const { tempRoot, cleanup } = createTempRepo({});
  try {
    const result = applyTruthSync({
      repoRoot: tempRoot,
      plan: { kind: "sync-truth-plan", ok: false },
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, "refused");
  } finally {
    cleanup();
  }
});
