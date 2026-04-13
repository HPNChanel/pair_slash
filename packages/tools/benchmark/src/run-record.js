import { LANE_SUPPORT_LEVEL_ALIASES, PRIMARY_TEXT_FIELDS_FOR_WORDING_CHECK } from "./constants.js";
import { hasOwnValue, matchesCondition } from "./io.js";

function pushError(errors, code, message) {
  errors.push(`${code} ${message}`);
}

export function normalizeLaneSupportLevel(value) {
  if (typeof value !== "string") {
    return value;
  }
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return LANE_SUPPORT_LEVEL_ALIASES[normalized] ?? normalized;
}

export function normalizeWorkflowMaturity(value) {
  if (typeof value !== "string") {
    return value;
  }
  return value.trim().toLowerCase();
}

function toFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function computeDelta(base, candidate) {
  const baseline = toFiniteNumber(base);
  const variant = toFiniteNumber(candidate);
  if (!Number.isFinite(baseline) || !Number.isFinite(variant) || baseline <= 0) {
    return null;
  }
  return Number(((baseline - variant) / baseline).toFixed(4));
}

function computeDerivedMetrics(record) {
  const taskSuccessWithoutRescue = record.task_success === true && Number(record.pairslash_manual_rescue_count) === 0;
  const trustedWeeklyReuseEligible =
    record.include_in_rollup === true &&
    taskSuccessWithoutRescue &&
    record.trust_boundary_result === "pass" &&
    ["likely_yes", "default_path"].includes(record.weekly_reuse_answer);

  return {
    ttfs_delta_vs_baseline: computeDelta(record.baseline_ttfs_seconds, record.pairslash_ttfs_seconds),
    rework_reduction_pct_vs_baseline: computeDelta(record.baseline_rework_units, record.pairslash_rework_units),
    pairslash_task_success_without_manual_rescue: taskSuccessWithoutRescue,
    trusted_weekly_reuse_eligible: trustedWeeklyReuseEligible,
  };
}

function collectWordingViolations(record, context) {
  const bannedPhrases = context.benchmarkDocuments.laneWording?.banned_phrases ?? [];
  const payload = PRIMARY_TEXT_FIELDS_FOR_WORDING_CHECK
    .map((field) => String(record[field] ?? ""))
    .join("\n")
    .toLowerCase();

  return bannedPhrases.filter((phrase) => payload.includes(String(phrase).toLowerCase()));
}

function validateConditionalFields(normalizedRecord, logSchema, errors) {
  for (const conditionalField of logSchema?.conditional_fields ?? []) {
    const fieldName = conditionalField?.field;
    const requiredWhen = conditionalField?.required_when ?? {};
    if (!fieldName || typeof requiredWhen !== "object") {
      continue;
    }
    if (matchesCondition(normalizedRecord, requiredWhen) && !hasOwnValue(normalizedRecord, fieldName)) {
      pushError(
        errors,
        "P19-RUN-007",
        `field ${fieldName} is required when ${JSON.stringify(requiredWhen)}`,
      );
    }
  }
}

function validateEnumFields(normalizedRecord, logSchema, errors) {
  for (const [field, allowedValues] of Object.entries(logSchema?.enums ?? {})) {
    if (!hasOwnValue(normalizedRecord, field)) {
      continue;
    }
    const actual = field === "lane_support_level"
      ? normalizeLaneSupportLevel(normalizedRecord[field])
      : normalizedRecord[field];
    if (!Array.isArray(allowedValues) || !allowedValues.includes(actual)) {
      pushError(
        errors,
        "P19-RUN-006",
        `field ${field}=${JSON.stringify(normalizedRecord[field])} is not in enum ${JSON.stringify(allowedValues)}`,
      );
    }
  }
}

function validateTaskAndScenario(normalizedRecord, context, scenarioIndex, errors) {
  const task = context.taskById.get(normalizedRecord.task_card_id);
  if (!task) {
    pushError(errors, "P19-RUN-008", `unknown task_card_id ${normalizedRecord.task_card_id}`);
    return;
  }

  if (task.workflow_id !== normalizedRecord.workflow_id) {
    pushError(
      errors,
      "P19-RUN-009",
      `workflow_id ${normalizedRecord.workflow_id} does not match task workflow ${task.workflow_id}`,
    );
  }

  if (Array.isArray(task.required_runtime_ids) && !task.required_runtime_ids.includes(normalizedRecord.runtime_id)) {
    pushError(
      errors,
      "P19-RUN-010",
      `runtime ${normalizedRecord.runtime_id} is not allowed for task ${normalizedRecord.task_card_id}`,
    );
  }

  if (task.claim_status && normalizedRecord.claim_status !== task.claim_status) {
    pushError(
      errors,
      "P19-RUN-011",
      `claim_status ${normalizedRecord.claim_status} must match task claim_status ${task.claim_status}`,
    );
  }

  if (task.role === "calibration_control" && normalizedRecord.reporting_mode !== "internal_control") {
    pushError(errors, "P19-RUN-012", "C1/control tasks must use reporting_mode=internal_control");
  }

  if (normalizedRecord.task_card_id === "C1" && normalizedRecord.include_in_rollup !== false) {
    pushError(errors, "P19-RUN-013", "C1/control tasks must not be included in rollup");
  }

  if (normalizedRecord.task_card_id === "W3" && normalizedRecord.reporting_mode === "lane_specific_headline") {
    pushError(
      errors,
      "P19-RUN-014",
      "W3 must stay conditional_shadow_until_clean and cannot use lane_specific_headline",
    );
  }

  const scenario = scenarioIndex.get(normalizedRecord.scenario_id);
  if (!scenario) {
    pushError(errors, "P19-RUN-015", `unknown scenario_id ${normalizedRecord.scenario_id}`);
    return;
  }

  if (scenario.task_card_id !== normalizedRecord.task_card_id) {
    pushError(
      errors,
      "P19-RUN-016",
      `scenario ${normalizedRecord.scenario_id} does not match task_card_id ${normalizedRecord.task_card_id}`,
    );
  }

  if (scenario.workflow_id !== normalizedRecord.workflow_id) {
    pushError(
      errors,
      "P19-RUN-017",
      `scenario ${normalizedRecord.scenario_id} does not match workflow_id ${normalizedRecord.workflow_id}`,
    );
  }
}

function validateLaneAndRuntime(normalizedRecord, context, errors) {
  const lane = context.laneById.get(normalizedRecord.lane_id);
  if (!lane) {
    pushError(errors, "P19-RUN-018", `unknown lane_id ${normalizedRecord.lane_id}`);
    return null;
  }

  if (lane.runtime_id !== normalizedRecord.runtime_id) {
    pushError(
      errors,
      "P19-RUN-019",
      `lane ${normalizedRecord.lane_id} runtime ${lane.runtime_id} does not match run runtime ${normalizedRecord.runtime_id}`,
    );
  }

  const expectedSupportLevel = normalizeLaneSupportLevel(lane.support_level);
  const reportedSupportLevel = normalizeLaneSupportLevel(normalizedRecord.lane_support_level);
  normalizedRecord.lane_support_level = reportedSupportLevel;

  if (expectedSupportLevel !== reportedSupportLevel) {
    pushError(
      errors,
      "P19-RUN-020",
      `lane_support_level ${reportedSupportLevel} must match runtime surface matrix support level ${expectedSupportLevel}`,
    );
  }

  if (reportedSupportLevel === "prep" && normalizedRecord.reporting_mode === "lane_specific_headline") {
    pushError(errors, "P19-RUN-021", "prep lanes must remain shadow-only for headline reporting");
  }

  return lane;
}

function validateWorkflowMaturity(normalizedRecord, context, errors) {
  const catalogRecord = context.catalogByWorkflowId.get(normalizedRecord.workflow_id);
  if (!catalogRecord) {
    return null;
  }
  const expectedMaturity = normalizeWorkflowMaturity(
    catalogRecord.effective_workflow_maturity ?? catalogRecord.workflow_maturity,
  );
  const reportedMaturity = normalizeWorkflowMaturity(normalizedRecord.workflow_maturity);
  normalizedRecord.workflow_maturity = reportedMaturity;

  if (reportedMaturity !== expectedMaturity) {
    pushError(
      errors,
      "P19-RUN-022",
      `workflow_maturity ${reportedMaturity} must match catalog effective maturity ${expectedMaturity}`,
    );
  }
  return catalogRecord;
}

export function validateBenchmarkRunRecord(runRecord, context, scenarioIndex) {
  const errors = [];
  const warnings = [];
  const normalizedRecord = structuredClone(runRecord);
  const logSchema = context.benchmarkDocuments.logSchema ?? {};

  for (const requiredField of logSchema.required_fields ?? []) {
    if (!hasOwnValue(normalizedRecord, requiredField)) {
      pushError(errors, "P19-RUN-001", `missing required field ${requiredField}`);
    }
  }

  if (!Array.isArray(normalizedRecord.success_criteria) || normalizedRecord.success_criteria.length === 0) {
    pushError(errors, "P19-RUN-002", "success_criteria must be a non-empty list");
  }

  if (!Array.isArray(normalizedRecord.artifact_refs) || normalizedRecord.artifact_refs.length === 0) {
    pushError(errors, "P19-RUN-003", "artifact_refs must be a non-empty list");
  }

  if (!["AB", "BA"].includes(normalizedRecord.arm_order)) {
    pushError(errors, "P19-RUN-004", "arm_order must be AB or BA");
  }

  if (normalizedRecord.pairslash_method?.includes("/skills") !== true) {
    pushError(errors, "P19-RUN-005", "pairslash_method must reference /skills entrypoint");
  }

  validateEnumFields(normalizedRecord, logSchema, errors);
  validateConditionalFields(normalizedRecord, logSchema, errors);
  validateTaskAndScenario(normalizedRecord, context, scenarioIndex, errors);
  const lane = validateLaneAndRuntime(normalizedRecord, context, errors);
  const catalogRecord = validateWorkflowMaturity(normalizedRecord, context, errors);

  const wordingViolations = collectWordingViolations(normalizedRecord, context);
  if (wordingViolations.length > 0) {
    pushError(
      errors,
      "P19-RUN-023",
      `record contains banned wording phrases: ${wordingViolations.join(", ")}`,
    );
  }

  const derivedMetrics = computeDerivedMetrics(normalizedRecord);
  normalizedRecord.ttfs_delta_vs_baseline = derivedMetrics.ttfs_delta_vs_baseline;
  normalizedRecord.rework_reduction_pct_vs_baseline = derivedMetrics.rework_reduction_pct_vs_baseline;
  normalizedRecord.derived_metrics = derivedMetrics;
  normalizedRecord.validation_timestamp = new Date().toISOString();

  if (derivedMetrics.ttfs_delta_vs_baseline === null) {
    warnings.push("P19-RUN-W01 ttfs delta is null because baseline_ttfs_seconds was missing or <= 0");
  }
  if (derivedMetrics.rework_reduction_pct_vs_baseline === null) {
    warnings.push("P19-RUN-W02 rework reduction is null because baseline_rework_units was missing or <= 0");
  }

  normalizedRecord.lane_truth = lane
    ? {
        lane_id: lane.lane_id,
        runtime_id: lane.runtime_id,
        target: lane.target,
        os_lane: lane.os_lane,
        support_level: normalizeLaneSupportLevel(lane.support_level),
      }
    : null;

  normalizedRecord.workflow_truth = catalogRecord
    ? {
        workflow_id: catalogRecord.id,
        workflow_maturity: normalizeWorkflowMaturity(catalogRecord.workflow_maturity),
        effective_workflow_maturity: normalizeWorkflowMaturity(catalogRecord.effective_workflow_maturity),
      }
    : null;

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    normalized_record: normalizedRecord,
  };
}

export function isTrustedWeeklyReuseEligible(record) {
  return record?.derived_metrics?.trusted_weekly_reuse_eligible === true;
}

export function isTaskSuccessWithoutManualRescue(record) {
  return record?.derived_metrics?.pairslash_task_success_without_manual_rescue === true;
}
