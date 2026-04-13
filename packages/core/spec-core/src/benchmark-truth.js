import { resolve } from "node:path";
import YAML from "yaml";

import { exists, readFileNormalized } from "./utils.js";

export const BENCHMARK_TRUTH_FILES = Object.freeze({
  benchmarkTruth: "docs/validation/phase-3-5/benchmark-truth.yaml",
  taskCatalog: "docs/validation/phase-3-5/benchmark-task-catalog.yaml",
  logSchema: "docs/validation/phase-3-5/benchmark-log-schema.yaml",
  scoringRubric: "docs/validation/phase-3-5/benchmark-scoring-rubric.yaml",
  laneWording: "docs/validation/phase-3-5/benchmark-lane-wording.yaml",
});

function readYamlDocument(repoRoot, relativePath) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (!exists(absolutePath)) {
    throw new Error(`benchmark-truth-missing:${relativePath}`);
  }
  return YAML.parse(readFileNormalized(absolutePath));
}

function recordError(errors, code, message) {
  errors.push(`${code} ${message}`);
}

function ensure(errors, condition, code, message) {
  if (!condition) {
    recordError(errors, code, message);
  }
}

function exactSetMatch(values, expected) {
  if (!Array.isArray(values) || values.length !== expected.length) {
    return false;
  }
  const actualSet = new Set(values);
  return expected.every((value) => actualSet.has(value));
}

function buildTaskMap(taskCatalog) {
  const map = new Map();
  for (const task of taskCatalog?.official_tasks ?? []) {
    map.set(task.task_card_id, task);
  }
  return map;
}

function unique(values) {
  return new Set(values).size === values.length;
}

export function validateBenchmarkTruth(documents, { throwOnError = false } = {}) {
  const errors = [];
  const { benchmarkTruth, taskCatalog, logSchema, scoringRubric, laneWording } = documents;
  const supportedRuntimes = benchmarkTruth?.fixed_boundary?.supported_runtimes ?? [];
  const headlineWedges = benchmarkTruth?.round_one_policy?.headline_wedges ?? [];
  const calibrationControls = benchmarkTruth?.round_one_policy?.calibration_controls ?? [];
  const requiredHeadlineIds = ["W1", "W2a", "W2b", "W3"];
  const requiredTaskIds = [...requiredHeadlineIds, "C1"];
  const taskMap = buildTaskMap(taskCatalog);
  const taskIds = [...taskMap.keys()];
  const logRequiredFields = new Set(logSchema?.required_fields ?? []);
  const scoringRules = scoringRubric?.workflow_pass_rules ?? {};
  const roundOneLaneTemplates = laneWording?.round_one_lane_templates ?? [];
  const bannedPhrases = laneWording?.banned_phrases ?? [];

  ensure(
    errors,
    benchmarkTruth?.fixed_boundary?.canonical_entrypoint === "/skills",
    "PBT001",
    "fixed_boundary.canonical_entrypoint must stay /skills",
  );
  ensure(
    errors,
    exactSetMatch(supportedRuntimes, ["codex_cli", "copilot_cli"]),
    "PBT002",
    "fixed_boundary.supported_runtimes must be exactly codex_cli and copilot_cli",
  );
  ensure(
    errors,
    benchmarkTruth?.fixed_boundary?.advanced_lanes?.benchmarkable === false,
    "PBT003",
    "advanced lanes must stay non-benchmarkable in round one",
  );
  ensure(
    errors,
    exactSetMatch(headlineWedges, requiredHeadlineIds),
    "PBT004",
    "round_one_policy.headline_wedges must be W1, W2a, W2b, and W3",
  );
  ensure(
    errors,
    calibrationControls.includes("C1"),
    "PBT005",
    "round_one_policy.calibration_controls must include C1",
  );
  ensure(errors, unique(taskIds), "PBT006", "benchmark task_card_id values must be unique");

  for (const taskId of requiredTaskIds) {
    ensure(errors, taskMap.has(taskId), "PBT007", `official_tasks must include ${taskId}`);
  }

  for (const task of taskCatalog?.official_tasks ?? []) {
    ensure(
      errors,
      task.advanced_surface === false,
      "PBT008",
      `task ${task.task_card_id} must keep advanced_surface=false`,
    );
    ensure(
      errors,
      (task.required_runtime_ids ?? []).every((runtimeId) => supportedRuntimes.includes(runtimeId)),
      "PBT009",
      `task ${task.task_card_id} references an unsupported runtime`,
    );
  }

  const reviewTask = taskMap.get("W3");
  ensure(
    errors,
    reviewTask?.public_claim_mode === "conditional_shadow_until_clean",
    "PBT010",
    "W3 must stay conditional_shadow_until_clean to avoid generic coding overclaim",
  );

  const planControl = taskMap.get("C1");
  ensure(
    errors,
    planControl?.role === "calibration_control" && planControl?.public_claim_mode === "internal_only",
    "PBT011",
    "C1 must stay an internal calibration control",
  );

  for (const field of [
    "task_card_id",
    "workflow_id",
    "runtime_id",
    "lane_id",
    "lane_support_level",
    "workflow_maturity",
    "claim_status",
    "reporting_mode",
  ]) {
    ensure(errors, logRequiredFields.has(field), "PBT012", `benchmark log schema must require ${field}`);
  }

  ensure(
    errors,
    exactSetMatch(logSchema?.enums?.claim_status ?? [], benchmarkTruth?.classification_legend ?? []),
    "PBT013",
    "benchmark log schema claim_status enum must match classification_legend",
  );

  for (const taskId of requiredHeadlineIds) {
    ensure(errors, taskId in scoringRules, "PBT014", `scoring rubric must define workflow pass rules for ${taskId}`);
  }

  ensure(
    errors,
    scoringRubric?.round_one_rollup_rules?.primary_scored_lane === "codex-cli-repo-macos",
    "PBT015",
    "round one primary scored lane must stay codex-cli-repo-macos until broader lane evidence exists",
  );
  ensure(
    errors,
    scoringRubric?.round_one_rollup_rules?.prep_lanes_shadow_only === true,
    "PBT016",
    "prep lanes must remain shadow-only in round one rollups",
  );
  ensure(
    errors,
    laneWording?.aggregate_rules?.blended_cross_runtime_score === "forbidden",
    "PBT017",
    "lane wording must forbid blended cross-runtime scores",
  );
  ensure(
    errors,
    laneWording?.aggregate_rules?.prep_lane_headline_reporting === "forbidden",
    "PBT018",
    "lane wording must forbid prep-lane headline reporting",
  );
  ensure(
    errors,
    roundOneLaneTemplates.some((lane) => lane.lane_id === "codex-cli-repo-macos" && lane.reporting_mode === "lane_specific_headline"),
    "PBT019",
    "lane wording must keep codex-cli-repo-macos as the lane-specific headline template",
  );
  for (const phrase of ["broad parity", "validated product pull", "production ready", "benchmark ready"]) {
    ensure(
      errors,
      bannedPhrases.includes(phrase),
      "PBT020",
      `lane wording must explicitly ban the phrase \"${phrase}\"`,
    );
  }

  if (throwOnError && errors.length > 0) {
    throw new Error(`benchmark-truth-invalid:${errors.join("|")}`);
  }

  return errors;
}

export function loadBenchmarkTruth(repoRoot = process.cwd()) {
  const documents = {
    benchmarkTruth: readYamlDocument(repoRoot, BENCHMARK_TRUTH_FILES.benchmarkTruth),
    taskCatalog: readYamlDocument(repoRoot, BENCHMARK_TRUTH_FILES.taskCatalog),
    logSchema: readYamlDocument(repoRoot, BENCHMARK_TRUTH_FILES.logSchema),
    scoringRubric: readYamlDocument(repoRoot, BENCHMARK_TRUTH_FILES.scoringRubric),
    laneWording: readYamlDocument(repoRoot, BENCHMARK_TRUTH_FILES.laneWording),
  };

  validateBenchmarkTruth(documents, { throwOnError: true });
  return documents;
}
