import { relative } from "node:path";

import { listScenarioFiles } from "./paths.js";
import { parseStructuredFile } from "./io.js";

const REQUIRED_SCENARIO_FIELDS = [
  "scenario_id",
  "scenario_title",
  "task_card_id",
  "workflow_id",
  "workflow_chain",
  "benchmark_shape",
  "advanced_surface",
  "include_in_round_one",
  "include_in_rollup",
  "public_claim_mode",
  "required_runtime_ids",
  "repo_profile_id",
  "user_situation",
  "repo_condition",
  "input_package",
  "entrypoint",
  "baseline_method",
  "pairslash_path",
  "expected_failure_boundaries",
  "fairness_rule",
  "disallowed_handholding",
  "before_after_comparison_method",
  "scoring_notes",
  "claimability_notes",
  "success_criteria",
  "artifact_requirements",
];

function pushError(errors, code, message) {
  errors.push(`${code} ${message}`);
}

function hasNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateNonEmptyStringField(errors, code, scenario, fieldName) {
  if (!hasNonEmptyString(scenario[fieldName])) {
    pushError(
      errors,
      code,
      `${scenario.source_path} field ${fieldName} must be a non-empty string`,
    );
  }
}

function validateNonEmptyArrayField(errors, code, scenario, fieldName) {
  const values = scenario[fieldName];
  if (!Array.isArray(values) || values.length === 0) {
    pushError(
      errors,
      code,
      `${scenario.source_path} field ${fieldName} must be a non-empty list`,
    );
    return;
  }
  if (!values.every((entry) => hasNonEmptyString(entry))) {
    pushError(
      errors,
      code,
      `${scenario.source_path} field ${fieldName} entries must be non-empty strings`,
    );
  }
}

export function loadScenarioDefinitions(repoRoot = process.cwd()) {
  const scenarioFiles = listScenarioFiles(repoRoot);
  const scenarios = scenarioFiles.map((scenarioPath) => {
    const parsed = parseStructuredFile(scenarioPath);
    return {
      ...parsed,
      source_path: relative(repoRoot, scenarioPath).replaceAll("\\", "/"),
    };
  });

  scenarios.sort((left, right) =>
    `${left.task_card_id ?? ""}\u0000${left.scenario_id ?? ""}`.localeCompare(
      `${right.task_card_id ?? ""}\u0000${right.scenario_id ?? ""}`,
    ));
  return scenarios;
}

export function buildScenarioIndex(scenarios) {
  return new Map(scenarios.map((scenario) => [scenario.scenario_id, scenario]));
}

export function validateScenarioDefinitions(scenarios, context) {
  const errors = [];
  const warnings = [];
  const scenarioIndex = buildScenarioIndex(scenarios);

  if (scenarios.length === 0) {
    pushError(errors, "P19-SCN-000", "no scenario files found under docs-private/validation/phase-3-5/scenarios");
  }

  if (scenarioIndex.size !== scenarios.length) {
    pushError(errors, "P19-SCN-001", "scenario_id values must be unique");
  }

  for (const scenario of scenarios) {
    for (const field of REQUIRED_SCENARIO_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(scenario, field)) {
        pushError(
          errors,
          "P19-SCN-002",
          `${scenario.source_path} is missing required field ${field}`,
        );
      }
    }

    if (scenario.entrypoint !== "/skills") {
      pushError(errors, "P19-SCN-003", `${scenario.source_path} must keep entrypoint=/skills`);
    }
    if (scenario.advanced_surface !== false) {
      pushError(errors, "P19-SCN-004", `${scenario.source_path} must keep advanced_surface=false`);
    }

    const task = context.taskById.get(scenario.task_card_id);
    if (!task) {
      pushError(errors, "P19-SCN-005", `${scenario.source_path} references unknown task_card_id ${scenario.task_card_id}`);
      continue;
    }

    if (task.workflow_id !== scenario.workflow_id) {
      pushError(
        errors,
        "P19-SCN-006",
        `${scenario.source_path} workflow_id=${scenario.workflow_id} must match task workflow ${task.workflow_id}`,
      );
    }

    if (task.public_claim_mode !== scenario.public_claim_mode) {
      pushError(
        errors,
        "P19-SCN-015",
        `${scenario.source_path} public_claim_mode=${scenario.public_claim_mode} must match task public_claim_mode ${task.public_claim_mode}`,
      );
    }

    if (!Array.isArray(scenario.workflow_chain) || scenario.workflow_chain.length === 0) {
      pushError(errors, "P19-SCN-007", `${scenario.source_path} workflow_chain must be a non-empty list`);
    }

    const supportedRuntimes = context.benchmarkDocuments.benchmarkTruth?.fixed_boundary?.supported_runtimes ?? [];
    const runtimeIds = Array.isArray(scenario.required_runtime_ids) ? scenario.required_runtime_ids : [];
    if (runtimeIds.length === 0) {
      pushError(errors, "P19-SCN-008", `${scenario.source_path} requires at least one runtime id`);
    }
    for (const runtimeId of runtimeIds) {
      if (!supportedRuntimes.includes(runtimeId)) {
        pushError(errors, "P19-SCN-009", `${scenario.source_path} references unsupported runtime ${runtimeId}`);
      }
    }

    if (!Array.isArray(scenario.success_criteria) || scenario.success_criteria.length === 0) {
      pushError(errors, "P19-SCN-010", `${scenario.source_path} success_criteria must be a non-empty list`);
    }

    if (!Array.isArray(scenario.artifact_requirements) || scenario.artifact_requirements.length === 0) {
      pushError(errors, "P19-SCN-011", `${scenario.source_path} artifact_requirements must be a non-empty list`);
    }

    validateNonEmptyStringField(errors, "P19-SCN-016", scenario, "repo_profile_id");
    validateNonEmptyStringField(errors, "P19-SCN-017", scenario, "user_situation");
    validateNonEmptyStringField(errors, "P19-SCN-018", scenario, "repo_condition");
    validateNonEmptyStringField(errors, "P19-SCN-019", scenario, "fairness_rule");
    validateNonEmptyStringField(errors, "P19-SCN-020", scenario, "before_after_comparison_method");

    validateNonEmptyArrayField(errors, "P19-SCN-021", scenario, "input_package");
    validateNonEmptyArrayField(errors, "P19-SCN-022", scenario, "expected_failure_boundaries");
    validateNonEmptyArrayField(errors, "P19-SCN-023", scenario, "disallowed_handholding");
    validateNonEmptyArrayField(errors, "P19-SCN-024", scenario, "scoring_notes");
    validateNonEmptyArrayField(errors, "P19-SCN-025", scenario, "claimability_notes");

    if (
      scenario.task_card_id === "W3" &&
      scenario.public_claim_mode !== "conditional_shadow_until_clean"
    ) {
      pushError(
        errors,
        "P19-SCN-012",
        `${scenario.source_path} must keep W3 as conditional_shadow_until_clean`,
      );
    }

    if (scenario.task_card_id === "C1" && scenario.include_in_rollup !== false) {
      pushError(errors, "P19-SCN-013", `${scenario.source_path} must keep C1 out of rollup`);
    }

    if (task.role === "headline_wedge" && scenario.include_in_round_one !== true) {
      warnings.push(`${scenario.source_path} is a headline wedge but include_in_round_one is not true`);
    }
  }

  for (const taskId of context.benchmarkDocuments.taskCatalog?.execution_order ?? []) {
    if (!scenarioIndexHasTaskId(scenarios, taskId)) {
      pushError(errors, "P19-SCN-014", `missing scenario for task_card_id ${taskId}`);
    }
  }

  return {
    kind: "phase19-scenario-validation",
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      scenario_count: scenarios.length,
      task_count: context.taskById.size,
    },
    scenarios,
  };
}

function scenarioIndexHasTaskId(scenarios, taskId) {
  return scenarios.some((scenario) => scenario.task_card_id === taskId);
}
