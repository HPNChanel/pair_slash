import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  captureBenchmarkRun,
  formatScoreReportText,
  renderCaseStudyArtifacts,
  replayBenchmarkRun,
  runPhase19RoundOne,
  scoreBenchmarkRuns,
  validatePhase19BenchmarkConfig,
} from "../src/index.js";

import { createTempRepo, repoRoot } from "../../../../tests/phase4-helpers.js";

const serial = { concurrency: false };

function copyPhase19BenchmarkDocs(tempRoot) {
  const docsValidationSource = join(repoRoot, "docs", "validation");
  if (existsSync(docsValidationSource)) {
    cpSync(docsValidationSource, join(tempRoot, "docs", "validation"), { recursive: true });
  } else {
    mkdirSync(join(tempRoot, "docs", "validation", "phase-3-5"), { recursive: true });
  }

  const docsPrivateSource = join(repoRoot, "docs-private", "validation", "phase-3-5");
  cpSync(docsPrivateSource, join(tempRoot, "docs-private", "validation", "phase-3-5"), {
    recursive: true,
  });
}

function createBenchmarkTempRepo() {
  const fixture = createTempRepo({
    packs: [
      "pairslash-plan",
      "pairslash-onboard-repo",
      "pairslash-memory-candidate",
      "pairslash-memory-write-global",
      "pairslash-review",
    ],
  });
  copyPhase19BenchmarkDocs(fixture.tempRoot);
  return fixture;
}

function createArtifacts(tempRoot, runId) {
  const artifactRoot = join(tempRoot, "docs-private", "validation", "phase-3-5", "runs", "input", runId);
  mkdirSync(artifactRoot, { recursive: true });

  const refs = [
    `docs-private/validation/phase-3-5/runs/input/${runId}/baseline.txt`,
    `docs-private/validation/phase-3-5/runs/input/${runId}/pairslash.txt`,
    `docs-private/validation/phase-3-5/runs/input/${runId}/evaluator-notes.txt`,
  ];

  writeFileSync(join(artifactRoot, "baseline.txt"), "baseline evidence\n");
  writeFileSync(join(artifactRoot, "pairslash.txt"), "pairslash evidence\n");
  writeFileSync(join(artifactRoot, "evaluator-notes.txt"), "evaluator notes\n");

  return refs;
}

function createBaseRunRecord({
  runId,
  taskCardId,
  workflowId,
  scenarioId,
  baselineMethod,
  pairslashMethod,
  artifactRefs,
  extras = {},
}) {
  return {
    run_id: runId,
    paired_group_id: `${runId}-group`,
    task_card_id: taskCardId,
    workflow_id: workflowId,
    scenario_id: scenarioId,
    runtime_id: "codex_cli",
    lane_id: "codex-cli-repo-macos",
    lane_support_level: "degraded",
    workflow_maturity: "canary",
    claim_status: "not_acceptable_for_claims",
    reporting_mode: "lane_specific_headline",
    repo_snapshot_ref: "commit:abc1234",
    task_statement: "Run benchmark task using canonical /skills workflow.",
    success_criteria: [
      "Task success is true",
      "Trust boundary remains pass",
      "No manual rescue needed for PairSlash arm",
    ],
    arm_order: "AB",
    baseline_method: baselineMethod,
    pairslash_method: pairslashMethod,
    baseline_ttfs_seconds: 510,
    pairslash_ttfs_seconds: 420,
    ttfs_delta_vs_baseline: 0,
    baseline_manual_rescue_count: 1,
    pairslash_manual_rescue_count: 0,
    baseline_rework_units: 4,
    pairslash_rework_units: 1,
    rework_reduction_pct_vs_baseline: 0,
    task_success: true,
    trust_boundary_result: "pass",
    weekly_reuse_answer: "likely_yes",
    weekly_reuse_reason: "Workflow stays inside trust boundary and reduces rework.",
    artifact_refs: artifactRefs,
    include_in_rollup: true,
    negative_evidence_note: "Baseline required one redirect to authoritative files.",
    ...extras,
  };
}

test("phase19 benchmark validation passes on freshly copied scenario bundle", serial, () => {
  const fixture = createBenchmarkTempRepo();
  try {
    const report = validatePhase19BenchmarkConfig({ repoRoot: fixture.tempRoot });
    assert.equal(report.ok, true);
    assert.equal(report.summary.scenario_count >= 5, true);
    assert.equal(report.errors.length, 0);
  } finally {
    fixture.cleanup();
  }
});

test("phase19 benchmark capture writes run, artifact, and replay manifests", serial, () => {
  const fixture = createBenchmarkTempRepo();
  try {
    const runId = "2026-04-13-w1-codex-01";
    const record = createBaseRunRecord({
      runId,
      taskCardId: "W1",
      workflowId: "pairslash-onboard-repo",
      scenarioId: "w1-onboard-repo-paired",
      baselineMethod: "raw_cli_repo_orientation",
      pairslashMethod: "/skills -> pairslash-onboard-repo",
      artifactRefs: createArtifacts(fixture.tempRoot, runId),
    });

    const capture = captureBenchmarkRun({
      repoRoot: fixture.tempRoot,
      runRecord: record,
    });

    assert.equal(capture.ok, true);
    assert.equal(capture.missing_artifact_count, 0);

    const replay = replayBenchmarkRun({
      repoRoot: fixture.tempRoot,
      runId,
    });
    assert.equal(replay.ok, true);
    assert.equal(replay.drift_count, 0);
  } finally {
    fixture.cleanup();
  }
});

test("phase19 score, case-study rendering, and round1 pipeline run end-to-end", serial, () => {
  const fixture = createBenchmarkTempRepo();
  try {
    const runs = [
      createBaseRunRecord({
        runId: "2026-04-13-w1-codex-01",
        taskCardId: "W1",
        workflowId: "pairslash-onboard-repo",
        scenarioId: "w1-onboard-repo-paired",
        baselineMethod: "raw_cli_repo_orientation",
        pairslashMethod: "/skills -> pairslash-onboard-repo",
        artifactRefs: createArtifacts(fixture.tempRoot, "2026-04-13-w1-codex-01"),
      }),
      createBaseRunRecord({
        runId: "2026-04-13-w2a-codex-01",
        taskCardId: "W2a",
        workflowId: "pairslash-memory-write-global",
        scenarioId: "w2a-memory-happy-path",
        baselineMethod: "raw_cli_with_manual_memory_drafting",
        pairslashMethod: "/skills -> pairslash-memory-candidate -> pairslash-memory-write-global",
        artifactRefs: createArtifacts(fixture.tempRoot, "2026-04-13-w2a-codex-01"),
        extras: {
          preview_fidelity_result: "pass",
        },
      }),
      createBaseRunRecord({
        runId: "2026-04-13-w2b-codex-01",
        taskCardId: "W2b",
        workflowId: "pairslash-memory-write-global",
        scenarioId: "w2b-memory-rejection-path",
        baselineMethod: "raw_cli_with_manual_conflict_checking",
        pairslashMethod: "/skills -> pairslash-memory-candidate -> pairslash-memory-write-global",
        artifactRefs: createArtifacts(fixture.tempRoot, "2026-04-13-w2b-codex-01"),
        extras: {
          blocking_explanation_clear: true,
          conflict_outcome: "rejected",
        },
      }),
    ];

    for (const run of runs) {
      const report = captureBenchmarkRun({ repoRoot: fixture.tempRoot, runRecord: run });
      assert.equal(report.ok, true);
    }

    const score = scoreBenchmarkRuns({ repoRoot: fixture.tempRoot });
    assert.equal(score.claim_decision.claimable, true);
    assert.equal(score.hard_fail_conditions.length, 0);
    assert.equal(score.metrics.trusted_weekly_reuse_rate, 1);
    assert.match(formatScoreReportText(score), /Phase 19 benchmark score/);

    const caseReport = renderCaseStudyArtifacts({ repoRoot: fixture.tempRoot });
    assert.equal(caseReport.output_count, 3);

    const caseStudyPath = join(
      fixture.tempRoot,
      "docs-private",
      "validation",
      "phase-3-5",
      "case-studies",
      "2026-04-13-w1-codex-01.md",
    );
    const caseStudyContents = readFileSync(caseStudyPath, "utf8");
    assert.match(
      caseStudyContents,
      /Results are lane-specific to the documented Codex CLI repo macOS lane\./,
    );

    const round1Report = runPhase19RoundOne({ repoRoot: fixture.tempRoot });
    assert.equal(round1Report.status, "pass");
  } finally {
    fixture.cleanup();
  }
});

test("capture fails closed when prep lane is used as headline reporting", serial, () => {
  const fixture = createBenchmarkTempRepo();
  try {
    const runId = "2026-04-13-w1-copilot-prep-01";
    const record = createBaseRunRecord({
      runId,
      taskCardId: "W1",
      workflowId: "pairslash-onboard-repo",
      scenarioId: "w1-onboard-repo-paired",
      baselineMethod: "raw_cli_repo_orientation",
      pairslashMethod: "/skills -> pairslash-onboard-repo",
      artifactRefs: createArtifacts(fixture.tempRoot, runId),
      extras: {
        runtime_id: "copilot_cli",
        lane_id: "copilot-cli-user-linux",
        lane_support_level: "prep",
        reporting_mode: "lane_specific_headline",
      },
    });

    assert.throws(
      () => captureBenchmarkRun({ repoRoot: fixture.tempRoot, runRecord: record }),
      /P19-RUN-021/,
    );
  } finally {
    fixture.cleanup();
  }
});
