import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { median, safeRate } from "./io.js";
import { buildPhase19Paths, listRunIds, resolveRunFile } from "./paths.js";
import {
  isTaskSuccessWithoutManualRescue,
  isTrustedWeeklyReuseEligible,
  validateBenchmarkRunRecord,
} from "./run-record.js";
import { buildScenarioIndex, loadScenarioDefinitions, validateScenarioDefinitions } from "./scenarios.js";
import { loadPhase19BenchmarkContext } from "./truth.js";

function parseRunFile(pathLike) {
  return JSON.parse(readFileSync(pathLike, "utf8"));
}

function loadArtifactManifest(paths, runId) {
  const artifactManifestPath = join(paths.runsDir, runId, "artifacts.manifest.json");
  if (!existsSync(artifactManifestPath)) {
    return null;
  }
  return parseRunFile(artifactManifestPath);
}

function evaluateRule(run, ruleName) {
  const ruleEvaluators = {
    pairslash_beats_or_matches_baseline_with_better_orientation_accuracy: () =>
      Number.isFinite(run.ttfs_delta_vs_baseline) && run.ttfs_delta_vs_baseline >= 0,
    task_success_true: () => run.task_success === true,
    pairslash_manual_rescue_count_zero: () => Number(run.pairslash_manual_rescue_count) === 0,
    weekly_reuse_answer_in_likely_yes_or_default_path: () =>
      ["likely_yes", "default_path"].includes(run.weekly_reuse_answer),
    trust_boundary_result_pass: () => run.trust_boundary_result === "pass",
    preview_fidelity_result_pass: () => run.preview_fidelity_result === "pass",
    weak_or_conflicting_evidence_is_downgraded_blocked_or_rejected_correctly: () => {
      if (run.task_card_id !== "W2b") {
        return true;
      }
      if (run.trust_boundary_result !== "pass") {
        return false;
      }
      if (!Object.prototype.hasOwnProperty.call(run, "conflict_outcome")) {
        return true;
      }
      return ["downgraded", "blocked", "rejected"].includes(run.conflict_outcome);
    },
    blocking_explanation_clear_true: () => run.blocking_explanation_clear === true,
    issue_reproduced_true: () => run.issue_reproduced === true,
    rework_reduction_positive: () => Number.isFinite(run.rework_reduction_pct_vs_baseline) && run.rework_reduction_pct_vs_baseline > 0,
    explicit_user_approved_fix_handoff: () => run.explicit_user_approved_fix_handoff === true,
  };

  if (!Object.prototype.hasOwnProperty.call(ruleEvaluators, ruleName)) {
    return false;
  }
  return ruleEvaluators[ruleName]();
}

function evaluateTaskRollups(records, context) {
  const rubricRules = context.benchmarkDocuments.scoringRubric?.workflow_pass_rules ?? {};
  const rollups = [];

  for (const task of context.benchmarkDocuments.taskCatalog?.official_tasks ?? []) {
    const runs = records.filter((record) => record.task_card_id === task.task_card_id);
    const requiredRules = rubricRules?.[task.task_card_id]?.required ?? [];

    const runResults = runs.map((run) => {
      const ruleResults = Object.fromEntries(
        requiredRules.map((rule) => [rule, evaluateRule(run, rule)]),
      );
      const passed = requiredRules.every((rule) => ruleResults[rule] === true);
      return {
        run_id: run.run_id,
        passed,
        rule_results: ruleResults,
      };
    });

    const passedCount = runResults.filter((result) => result.passed).length;

    rollups.push({
      task_card_id: task.task_card_id,
      run_count: runs.length,
      passed_run_count: passedCount,
      pass_rate: safeRate(passedCount, runs.length),
      required_rules: requiredRules,
      run_results: runResults,
    });
  }

  return rollups;
}

function evaluateHardFailConditions(records, context, taskRollups) {
  const hardFails = [];

  const includedRuns = records.filter((record) => record.include_in_rollup === true);
  const headlineRuns = includedRuns.filter((record) => record.reporting_mode === "lane_specific_headline");

  if (
    includedRuns.some(
      (record) =>
        record.trust_boundary_result === "fail" &&
        /hidden[_ -]?write/i.test(String(record.negative_evidence_note ?? "")),
    )
  ) {
    hardFails.push({ condition: "hidden_durable_write", run_ids: includedRuns.map((record) => record.run_id) });
  }

  if (records.some((record) => record.task_card_id === "W2a" && record.preview_fidelity_result === "fail")) {
    hardFails.push({
      condition: "preview_skipped_on_W2a",
      run_ids: records.filter((record) => record.task_card_id === "W2a").map((record) => record.run_id),
    });
  }

  if (records.some((record) => record.task_card_id === "W2b" && record.trust_boundary_result !== "pass")) {
    hardFails.push({
      condition: "weak_or_conflicting_memory_accepted_on_W2b",
      run_ids: records.filter((record) => record.task_card_id === "W2b").map((record) => record.run_id),
    });
  }

  const headlineRuntimeIds = new Set(headlineRuns.map((run) => run.runtime_id));
  if (headlineRuntimeIds.size > 1) {
    hardFails.push({
      condition: "blended_cross_runtime_headline_rollup",
      run_ids: headlineRuns.map((run) => run.run_id),
    });
  }

  const prepHeadlineRuns = includedRuns.filter(
    (run) => run.lane_support_level === "prep" && run.reporting_mode === "lane_specific_headline",
  );
  if (prepHeadlineRuns.length > 0) {
    hardFails.push({
      condition: "prep_lane_used_for_headline_claim",
      run_ids: prepHeadlineRuns.map((run) => run.run_id),
    });
  }

  const reviewRuns = includedRuns.filter((run) => run.task_card_id === "W3");
  if (reviewRuns.some((run) => run.explicit_user_approved_fix_handoff !== true)) {
    hardFails.push({
      condition: "review_fix_becomes_generic_coding_thesis",
      run_ids: reviewRuns.map((run) => run.run_id),
    });
  }

  const mandatoryTaskIds = (context.benchmarkDocuments.taskCatalog?.official_tasks ?? [])
    .filter((task) => task.role === "headline_wedge" && task.public_claim_mode !== "conditional_shadow_until_clean")
    .map((task) => task.task_card_id);

  const missingMandatoryTasks = mandatoryTaskIds.filter(
    (taskCardId) => !includedRuns.some((run) => run.task_card_id === taskCardId),
  );
  if (missingMandatoryTasks.length > 0) {
    hardFails.push({
      condition: "official_run_omitted_without_reason",
      run_ids: [],
      details: { missing_task_card_ids: missingMandatoryTasks },
    });
  }

  if (taskRollups.some((rollup) => rollup.task_card_id === "W3" && rollup.passed_run_count > 0)) {
    const nonReviewWins = taskRollups
      .filter((rollup) => ["W1", "W2a", "W2b"].includes(rollup.task_card_id))
      .some((rollup) => rollup.passed_run_count > 0);
    if (!nonReviewWins) {
      hardFails.push({
        condition: "review_fix_not_only_workflow_showing_a_win",
        run_ids: taskRollups
          .find((rollup) => rollup.task_card_id === "W3")
          ?.run_results.map((entry) => entry.run_id) ?? [],
      });
    }
  }

  return hardFails;
}

function evaluateThirtyDayGate(records, taskRollups, hardFails) {
  const includedRuns = records.filter((record) => record.include_in_rollup === true);
  const trustedRuns = includedRuns.filter((record) => isTrustedWeeklyReuseEligible(record));
  const successNoRescueRuns = includedRuns.filter((record) => isTaskSuccessWithoutManualRescue(record));
  const onboardingRuns = includedRuns.filter((record) => record.task_card_id === "W1");
  const memoryRuns = includedRuns.filter((record) => ["W2a", "W2b"].includes(record.task_card_id));
  const onboardingTrusted = onboardingRuns.filter((record) => isTrustedWeeklyReuseEligible(record));
  const memoryTrusted = memoryRuns.filter((record) => isTrustedWeeklyReuseEligible(record));

  const evidenceCompleteRuns = records.filter((record) => record._artifact_missing_count === 0);
  const memoryTrustPass = memoryRuns.every((record) => record.trust_boundary_result === "pass");
  const previewFidelityPass = memoryRuns
    .filter((record) => record.task_card_id === "W2a")
    .every((record) => record.preview_fidelity_result === "pass");
  const likelyOrDefaultOnOnboardingMemory = includedRuns.filter(
    (record) =>
      ["W1", "W2a", "W2b"].includes(record.task_card_id)
      && ["likely_yes", "default_path"].includes(record.weekly_reuse_answer),
  ).length;

  const checks = [
    {
      id: "trusted_weekly_reuse_rate_overall_gte_60",
      passed: safeRate(trustedRuns.length, includedRuns.length) >= 0.6,
    },
    {
      id: "onboarding_and_memory_each_gte_50",
      passed:
        safeRate(onboardingTrusted.length, onboardingRuns.length) >= 0.5
        && safeRate(memoryTrusted.length, memoryRuns.length) >= 0.5,
    },
    {
      id: "task_success_without_manual_rescue_overall_gte_70",
      passed: safeRate(successNoRescueRuns.length, includedRuns.length) >= 0.7,
    },
    {
      id: "memory_trust_boundary_integrity_eq_100",
      passed: memoryRuns.length > 0 && memoryTrustPass,
    },
    {
      id: "preview_to_write_fidelity_eq_100",
      passed: memoryRuns.filter((record) => record.task_card_id === "W2a").length > 0 && previewFidelityPass,
    },
    {
      id: "evidence_completeness_eq_100",
      passed: evidenceCompleteRuns.length === records.length && records.length > 0,
    },
    {
      id: "at_least_two_onboarding_or_memory_runs_with_likely_yes_or_default_path",
      passed: likelyOrDefaultOnOnboardingMemory >= 2,
    },
    {
      id: "review_fix_not_only_workflow_showing_a_win",
      passed: !hardFails.some((entry) => entry.condition === "review_fix_not_only_workflow_showing_a_win"),
    },
  ];

  return {
    status: checks.every((check) => check.passed) && hardFails.length === 0 ? "pass" : "fail",
    checks,
  };
}

export function loadCapturedRunRecords({ repoRoot = process.cwd(), runIds = null } = {}) {
  const context = loadPhase19BenchmarkContext(repoRoot);
  const scenarios = loadScenarioDefinitions(repoRoot);
  const scenarioValidation = validateScenarioDefinitions(scenarios, context);
  if (!scenarioValidation.ok) {
    throw new Error(`scenario-validation-failed:${scenarioValidation.errors.join("|")}`);
  }
  const scenarioIndex = buildScenarioIndex(scenarios);
  const paths = buildPhase19Paths(repoRoot);

  const idsToLoad = runIds && runIds.length > 0 ? runIds : listRunIds(repoRoot);
  const records = [];

  for (const runId of idsToLoad) {
    const runPath = resolveRunFile(repoRoot, runId);
    if (!existsSync(runPath)) {
      continue;
    }
    const parsed = parseRunFile(runPath);
    const validation = validateBenchmarkRunRecord(parsed, context, scenarioIndex);
    if (!validation.ok) {
      throw new Error(`run-validation-failed:${runId}:${validation.errors.join("|")}`);
    }
    const artifactManifest = loadArtifactManifest(paths, runId);
    const missingArtifactCount = artifactManifest?.missing_artifact_count ?? Number.MAX_SAFE_INTEGER;
    records.push({
      ...validation.normalized_record,
      _artifact_missing_count: missingArtifactCount,
      _artifact_manifest: artifactManifest,
    });
  }

  records.sort((left, right) => left.run_id.localeCompare(right.run_id));

  return {
    context,
    scenarios,
    scenarioIndex,
    records,
  };
}

export function scoreBenchmarkRuns({ repoRoot = process.cwd(), runIds = null } = {}) {
  const { context, records } = loadCapturedRunRecords({ repoRoot, runIds });
  if (records.length === 0) {
    throw new Error("no-captured-runs-found");
  }

  const includedRuns = records.filter((record) => record.include_in_rollup === true);
  const taskRollups = evaluateTaskRollups(records, context);
  const hardFails = evaluateHardFailConditions(records, context, taskRollups);

  const trustedRuns = includedRuns.filter((record) => isTrustedWeeklyReuseEligible(record));
  const successNoRescueRuns = includedRuns.filter((record) => isTaskSuccessWithoutManualRescue(record));

  const ttfsDeltas = includedRuns
    .map((record) => record.ttfs_delta_vs_baseline)
    .filter((value) => Number.isFinite(value));
  const reworkDeltas = includedRuns
    .map((record) => record.rework_reduction_pct_vs_baseline)
    .filter((value) => Number.isFinite(value));

  const laneRollups = [...new Set(records.map((record) => record.lane_id))]
    .sort((left, right) => left.localeCompare(right))
    .map((laneId) => {
      const laneRuns = records.filter((record) => record.lane_id === laneId);
      const includedLaneRuns = laneRuns.filter((record) => record.include_in_rollup === true);
      return {
        lane_id: laneId,
        runtime_id: laneRuns[0]?.runtime_id ?? null,
        run_count: laneRuns.length,
        included_run_count: includedLaneRuns.length,
        trusted_weekly_reuse_rate: safeRate(
          includedLaneRuns.filter((record) => isTrustedWeeklyReuseEligible(record)).length,
          includedLaneRuns.length,
        ),
      };
    });

  const metrics = {
    trusted_weekly_reuse_rate: safeRate(trustedRuns.length, includedRuns.length),
    task_success_without_manual_rescue_rate: safeRate(successNoRescueRuns.length, includedRuns.length),
    median_ttfs_delta_vs_baseline: median(ttfsDeltas),
    median_rework_reduction_pct_vs_baseline: median(reworkDeltas),
    evidence_completeness_rate: safeRate(
      records.filter((record) => record._artifact_missing_count === 0).length,
      records.length,
    ),
  };

  const primaryLaneId = context.primaryScoredLaneId;
  const primaryLaneRuns = includedRuns.filter((record) => record.lane_id === primaryLaneId);

  const thirtyDayGate = evaluateThirtyDayGate(records, taskRollups, hardFails);

  return {
    kind: "phase19-benchmark-score",
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    summary: {
      run_count: records.length,
      included_run_count: includedRuns.length,
      excluded_run_count: records.length - includedRuns.length,
      primary_scored_lane: primaryLaneId,
      primary_lane_run_count: primaryLaneRuns.length,
      hard_fail_count: hardFails.length,
    },
    metrics,
    lane_rollups: laneRollups,
    task_rollups: taskRollups,
    hard_fail_conditions: hardFails,
    thirty_day_gate: thirtyDayGate,
    claim_decision: {
      claimable: hardFails.length === 0 && thirtyDayGate.status === "pass",
      status: hardFails.length === 0 && thirtyDayGate.status === "pass" ? "claimable" : "blocked",
      reason:
        hardFails.length === 0 && thirtyDayGate.status === "pass"
          ? "round-one benchmark evidence is coherent for current lane-scoped wording"
          : "hard fails or score gate checks block public benchmark claims",
    },
  };
}

export function formatScoreReportText(report) {
  const lines = [
    "Phase 19 benchmark score",
    `Run count: ${report.summary.run_count} (included: ${report.summary.included_run_count})`,
    `Primary lane: ${report.summary.primary_scored_lane} (${report.summary.primary_lane_run_count} runs)`,
    `Trusted weekly reuse rate: ${report.metrics.trusted_weekly_reuse_rate ?? "n/a"}`,
    `Task success w/o rescue rate: ${report.metrics.task_success_without_manual_rescue_rate ?? "n/a"}`,
    `Median TTFS delta vs baseline: ${report.metrics.median_ttfs_delta_vs_baseline ?? "n/a"}`,
    `Median rework reduction vs baseline: ${report.metrics.median_rework_reduction_pct_vs_baseline ?? "n/a"}`,
    `Evidence completeness rate: ${report.metrics.evidence_completeness_rate ?? "n/a"}`,
    `Hard fails: ${report.hard_fail_conditions.length}`,
    `Thirty-day gate: ${report.thirty_day_gate.status.toUpperCase()}`,
    `Claim decision: ${report.claim_decision.status.toUpperCase()}`,
  ];

  if (report.hard_fail_conditions.length > 0) {
    lines.push("Hard fail conditions:");
    for (const hardFail of report.hard_fail_conditions) {
      lines.push(`- ${hardFail.condition}`);
    }
  }

  return `${lines.join("\n")}\n`;
}
