import {
  stableYaml,
} from "../utils.ts";
import {
  resolve,
} from "node:path";
import {
  ALLOWED_EVIDENCE_VERDICTS,
  ALLOWED_FRESHNESS_STATES,
  ALLOWED_LIVE_EVIDENCE_CLASSES,
  ALLOWED_PUBLIC_SUPPORT_LEVELS,
  LIVE_RUNTIME_LANE_RECORD_KIND,
  LIVE_RUNTIME_LANE_RECORD_SCHEMA_REF,
  LIVE_RUNTIME_LANE_RECORD_SCHEMA_VERSION,
  isObject,
  laneEvidenceDataRef,
  readYamlFile,
  validateEvidenceRefCollection,
  validateEvidenceRefExists,
  validateIsoTimestamp,
  validateStringArray,
} from "./helpers.ts";
import {
  validateEvidenceRefCollectionsMatch,
} from "./workflow-maturity.ts";

export function validateRunbookPolicy(value: unknown, errorKey: any) {
  if (!isObject(value)) {
    throw new Error(`public-support-snapshot-invalid:${errorKey}`);
  }
  validateStringArray(value.smoke_boundary?.counts_as, `${errorKey}.smoke_boundary.counts_as`);
  validateStringArray(
    value.smoke_boundary?.never_sufficient_for,
    `${errorKey}.smoke_boundary.never_sufficient_for`,
  );
  validateStringArray(
    value.live_verification_boundary?.required_for_public_lane_claim,
    `${errorKey}.live_verification_boundary.required_for_public_lane_claim`,
  );
  validateStringArray(
    value.live_verification_boundary?.repeated_live_verification_requires,
    `${errorKey}.live_verification_boundary.repeated_live_verification_requires`,
  );
  validateStringArray(
    value.manual_vs_scripted_boundary?.scripted_steps_allowed,
    `${errorKey}.manual_vs_scripted_boundary.scripted_steps_allowed`,
  );
  validateStringArray(
    value.manual_vs_scripted_boundary?.manual_steps_required,
    `${errorKey}.manual_vs_scripted_boundary.manual_steps_required`,
  );
  validateStringArray(
    value.manual_vs_scripted_boundary?.forbidden_substitutions,
    `${errorKey}.manual_vs_scripted_boundary.forbidden_substitutions`,
  );
  validateStringArray(value.host_profile_required_fields, `${errorKey}.host_profile_required_fields`);
  validateStringArray(
    value.command_capture_requirements?.required_artifacts,
    `${errorKey}.command_capture_requirements.required_artifacts`,
  );
  if (!isObject(value.runtime_runbooks)) {
    throw new Error(`public-support-snapshot-invalid:${errorKey}.runtime_runbooks`);
  }
  for (const runtimeId of ["codex_cli", "copilot_cli"]) {
    const runbook = value.runtime_runbooks[runtimeId];
    if (!isObject(runbook)) {
      throw new Error(`public-support-snapshot-invalid:${errorKey}.runtime_runbooks.${runtimeId}`);
    }
    if (typeof runbook.default_target !== "string" || runbook.default_target.trim() === "") {
      throw new Error(`public-support-snapshot-invalid:${errorKey}.runtime_runbooks.${runtimeId}.default_target`);
    }
    validateStringArray(
      runbook.required_tool_presence,
      `${errorKey}.runtime_runbooks.${runtimeId}.required_tool_presence`,
    );
    validateStringArray(
      runbook.required_commands,
      `${errorKey}.runtime_runbooks.${runtimeId}.required_commands`,
    );
    validateStringArray(
      runbook.minimum_capabilities_for_preview_lane,
      `${errorKey}.runtime_runbooks.${runtimeId}.minimum_capabilities_for_preview_lane`,
    );
    if (!isObject(runbook.direct_invocation)) {
      throw new Error(`public-support-snapshot-invalid:${errorKey}.runtime_runbooks.${runtimeId}.direct_invocation`);
    }
    if (
      typeof runbook.direct_invocation.public_claim !== "string" ||
      runbook.direct_invocation.public_claim.trim() === ""
    ) {
      throw new Error(
        `public-support-snapshot-invalid:${errorKey}.runtime_runbooks.${runtimeId}.direct_invocation.public_claim`,
      );
    }
    if (typeof runbook.direct_invocation.promotion_requires_canonical_picker !== "boolean") {
      throw new Error(
        `public-support-snapshot-invalid:${errorKey}.runtime_runbooks.${runtimeId}.direct_invocation.promotion_requires_canonical_picker`,
      );
    }
    if (
      runtimeId === "codex_cli" &&
      runbook.direct_invocation.codex_exec_max_evidence_class !== "live_smoke"
    ) {
      throw new Error(
        `public-support-snapshot-invalid:${errorKey}.runtime_runbooks.${runtimeId}.direct_invocation.codex_exec_max_evidence_class`,
      );
    }
  }
  validateStringArray(value.windows_promotion_gate?.requires, `${errorKey}.windows_promotion_gate.requires`);
  if (value.windows_promotion_gate?.doctor_and_preview_never_enough !== true) {
    throw new Error(`public-support-snapshot-invalid:${errorKey}.windows_promotion_gate.doctor_and_preview_never_enough`);
  }
}

export function validateLiveLaneRecordCollection(repoRoot: string, value: unknown, errorKey: any, lane: any = null) {
  if (!Array.isArray(value)) {
    throw new Error(`public-support-snapshot-invalid:${errorKey}`);
  }
  const isNegativeCollection = errorKey.endsWith("negative_live_records");
  for (const [index, record] of value.entries()) {
    if (!isObject(record)) {
      throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}]`);
    }
    for (const field of [
      "evidence_id",
      "captured_at",
      "owner_id",
      "host_profile_id",
      "runtime_id",
      "target",
      "os_lane",
      "entrypoint_path_used",
      "command",
      "summary",
      "verdict",
      "stale_at",
      "expire_at",
    ]) {
      if (typeof record[field] !== "string" || record[field].trim() === "") {
        throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].${field}`);
      }
    }
    if (lane) {
      if (record.runtime_id !== lane.runtime_id) {
        throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].runtime_id`);
      }
      if (record.target !== lane.target) {
        throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].target`);
      }
      if (record.os_lane !== lane.os_lane) {
        throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].os_lane`);
      }
      if (
        ["preview", "stable-tested"].includes(lane.support_level) &&
        record.entrypoint_path_used !== lane.canonical_entrypoint
      ) {
        throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].entrypoint_path_used`);
      }
    }
    validateIsoTimestamp(record.captured_at, `${errorKey}[${index}].captured_at`);
    validateIsoTimestamp(record.stale_at, `${errorKey}[${index}].stale_at`);
    validateIsoTimestamp(record.expire_at, `${errorKey}[${index}].expire_at`);
    if (Date.parse(record.stale_at) > Date.parse(record.expire_at)) {
      throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].stale_expiry_order`);
    }
    validateStringArray(record.pack_scope, `${errorKey}[${index}].pack_scope`);
    validateStringArray(record.workflow_scope, `${errorKey}[${index}].workflow_scope`);
    validateStringArray(record.capability_scope, `${errorKey}[${index}].capability_scope`);
    validateEvidenceRefCollection(repoRoot, record.artifact_paths, `${errorKey}[${index}].artifact_paths`);
    const evidenceClassField = "evidence_class" in record ? "evidence_class" : null;
    if (evidenceClassField && !ALLOWED_LIVE_EVIDENCE_CLASSES.has(record.evidence_class)) {
      throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].evidence_class`);
    }
    if (!ALLOWED_EVIDENCE_VERDICTS.has(record.verdict)) {
      throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].verdict`);
    }
    if (!ALLOWED_FRESHNESS_STATES.has(record.freshness_state)) {
      throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].freshness_state`);
    }
    if (isNegativeCollection) {
      if (typeof record.failure_type !== "string" || record.failure_type.trim() === "") {
        throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].failure_type`);
      }
    }
    if ("command_capture_refs" in record) {
      validateEvidenceRefCollection(repoRoot, record.command_capture_refs, `${errorKey}[${index}].command_capture_refs`);
    }
    if ("refs" in record) {
      validateEvidenceRefCollection(repoRoot, record.refs, `${errorKey}[${index}].refs`);
    }
  }
}

export function validateLiveRuntimeLaneRecord(repoRoot: string, lane: any, index: number) {
  const evidenceDataRef = laneEvidenceDataRef(lane);
  if (typeof evidenceDataRef !== "string" || evidenceDataRef.trim() === "") {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_data_ref`);
  }
  validateEvidenceRefExists(repoRoot, evidenceDataRef, `runtime_lanes[${index}].evidence_data_ref`);
  const record = readYamlFile(resolve(repoRoot, evidenceDataRef));
  if (!isObject(record)) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record`);
  }
  if (record.kind !== LIVE_RUNTIME_LANE_RECORD_KIND) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.kind`);
  }
  if (record.schema_version !== LIVE_RUNTIME_LANE_RECORD_SCHEMA_VERSION) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.schema_version`);
  }
  if (record.registry_schema_ref !== LIVE_RUNTIME_LANE_RECORD_SCHEMA_REF) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.registry_schema_ref`);
  }
  validateEvidenceRefExists(
    repoRoot,
    record.registry_schema_ref,
    `runtime_lanes[${index}].evidence_record.registry_schema_ref`,
  );
  const expectedLaneId = lane?.lane_id;
  if (typeof expectedLaneId !== "string" || expectedLaneId.trim() === "") {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].lane_id`);
  }
  if (record.lane_id !== expectedLaneId) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.lane_id`);
  }
  if (record.runtime_id !== lane.runtime_id) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.runtime_id`);
  }
  if (record.target !== lane.target) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.target`);
  }
  if (record.os_lane !== lane.os_lane) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.os_lane`);
  }
  if (record.canonical_entrypoint !== "/skills" || lane.canonical_entrypoint !== "/skills") {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].canonical_entrypoint`);
  }
  if (!ALLOWED_PUBLIC_SUPPORT_LEVELS.has(lane.support_level)) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].support_level`);
  }
  if (record.current_public_support_level !== lane.support_level) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.current_public_support_level`);
  }
  if (!ALLOWED_LIVE_EVIDENCE_CLASSES.has(record.required_evidence_class)) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.required_evidence_class`);
  }
  if (lane.required_evidence_class !== record.required_evidence_class) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].required_evidence_class`);
  }
  if (
    record.best_live_evidence_class !== null &&
    !ALLOWED_LIVE_EVIDENCE_CLASSES.has(record.best_live_evidence_class)
  ) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.best_live_evidence_class`);
  }
  if (lane.actual_evidence_class !== record.best_live_evidence_class) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].actual_evidence_class`);
  }
  if (!ALLOWED_FRESHNESS_STATES.has(record.freshness_state) || lane.freshness_state !== record.freshness_state) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].freshness_state`);
  }
  if (!Number.isInteger(record.host_profile_count) || record.host_profile_count < 0) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.host_profile_count`);
  }
  if (lane.host_profile_count !== record.host_profile_count) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].host_profile_count`);
  }
  if (lane.owner_id !== record.owner_id) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].owner_id`);
  }
  if (!isObject(record.surface_verdicts) || !isObject(lane.surface_verdicts)) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].surface_verdicts`);
  }
  if (stableYaml(record.surface_verdicts) !== stableYaml(lane.surface_verdicts)) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].surface_verdicts`);
  }
  if (typeof record.caveat_summary !== "string" || record.caveat_summary.trim() === "") {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.caveat_summary`);
  }
  validateStringArray(record.pack_scope, `runtime_lanes[${index}].evidence_record.pack_scope`);
  validateStringArray(record.workflow_scope, `runtime_lanes[${index}].evidence_record.workflow_scope`);
  validateStringArray(record.capability_scope, `runtime_lanes[${index}].evidence_record.capability_scope`);
  if (!Number.isInteger(record.stale_after_days) || record.stale_after_days < 0) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.stale_after_days`);
  }
  if (!Number.isInteger(record.expire_after_days) || record.expire_after_days < record.stale_after_days) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.expire_after_days`);
  }
  validateEvidenceRefCollection(
    repoRoot,
    record.deterministic_evidence_refs,
    `runtime_lanes[${index}].evidence_record.deterministic_evidence_refs`,
  );
  validateEvidenceRefCollection(
    repoRoot,
    record.fake_acceptance_evidence_refs,
    `runtime_lanes[${index}].evidence_record.fake_acceptance_evidence_refs`,
  );
  validateEvidenceRefCollection(
    repoRoot,
    record.shim_acceptance_evidence_refs,
    `runtime_lanes[${index}].evidence_record.shim_acceptance_evidence_refs`,
  );
  validateEvidenceRefCollection(
    repoRoot,
    record.live_evidence_refs,
    `runtime_lanes[${index}].evidence_record.live_evidence_refs`,
  );
  validateEvidenceRefCollection(
    repoRoot,
    record.negative_evidence_refs,
    `runtime_lanes[${index}].evidence_record.negative_evidence_refs`,
  );
  validateEvidenceRefCollection(
    repoRoot,
    record.claim_guard_refs,
    `runtime_lanes[${index}].evidence_record.claim_guard_refs`,
  );
  validateEvidenceRefCollectionsMatch(
    lane.deterministic_evidence_refs,
    record.deterministic_evidence_refs,
    `runtime_lanes[${index}].deterministic_evidence_refs`,
  );
  validateEvidenceRefCollectionsMatch(
    lane.fake_evidence_refs,
    record.fake_acceptance_evidence_refs,
    `runtime_lanes[${index}].fake_evidence_refs`,
  );
  validateEvidenceRefCollectionsMatch(
    lane.shim_evidence_refs,
    record.shim_acceptance_evidence_refs,
    `runtime_lanes[${index}].shim_evidence_refs`,
  );
  validateEvidenceRefCollectionsMatch(
    lane.live_evidence_refs,
    record.live_evidence_refs,
    `runtime_lanes[${index}].live_evidence_refs`,
  );
  validateEvidenceRefCollectionsMatch(
    lane.negative_evidence_refs,
    record.negative_evidence_refs,
    `runtime_lanes[${index}].negative_evidence_refs`,
  );
  validateEvidenceRefCollectionsMatch(
    lane.claim_guard_refs,
    record.claim_guard_refs,
    `runtime_lanes[${index}].claim_guard_refs`,
  );
  validateLiveLaneRecordCollection(
    repoRoot,
    record.live_records ?? [],
    `runtime_lanes[${index}].evidence_record.live_records`,
    lane,
  );
  validateLiveLaneRecordCollection(
    repoRoot,
    record.negative_live_records ?? [],
    `runtime_lanes[${index}].evidence_record.negative_live_records`,
    lane,
  );
  if (
    lane.support_level === "stable-tested" &&
    (record.best_live_evidence_class !== "repeated_live_verification" ||
      record.host_profile_count < 2 ||
      record.freshness_state !== "fresh")
  ) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].stable_tested_policy`);
  }
  if (
    lane.support_level === "preview" &&
    (!["live_verification", "repeated_live_verification"].includes(record.best_live_evidence_class) ||
      record.surface_verdicts.canonical_picker !== "pass" ||
      record.freshness_state !== "fresh")
  ) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].preview_policy`);
  }
  if (
    lane.support_level === "degraded" &&
    !["live_smoke", "live_verification", "repeated_live_verification"].includes(record.best_live_evidence_class)
  ) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].degraded_policy`);
  }
  if (
    lane.support_level === "prep" &&
    ["live_verification", "repeated_live_verification"].includes(record.best_live_evidence_class)
  ) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].prep_policy`);
  }
  if (lane.support_level === "blocked" && (record.negative_live_records?.length ?? 0) === 0) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].blocked_policy`);
  }
  return record;
}
