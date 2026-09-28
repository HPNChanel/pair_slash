import {
  DOCTOR_CHECK_GROUPS,
  DOCTOR_CHECK_SEVERITIES,
  DOCTOR_CHECK_STATUSES,
  isOneOf,
  DOCTOR_REPORT_SCHEMA_VERSION,
  LINT_CHECK_RESULTS,
  LINT_REPORT_SCHEMA_VERSION,
  PACK_SIGNATURE_STATUSES,
  PACK_SUPPORT_LEVELS,
  PACK_TRUST_TIERS,
  REMEDIATION_ACTION_KINDS,
  REMEDIATION_DECISIONS,
  REMEDIATION_STATUSES,
  SUPPORTED_RUNTIMES,
  SUPPORTED_TARGETS,
  SUPPORT_VERDICTS,
  TELEMETRY_MODES,
  TRUST_SOURCE_CLASSES,
  TRUST_VERIFICATION_STATUSES,
  WORKFLOW_MATURITY_LEVELS,
} from "../../constants.ts";
import {
  isObject,
  validateLifecycleReasonCodes,
  validateNonEmptyString,
  validateRemediationActions,
} from "../primitives.ts";

function validateDoctorRemediation(record: any, errors: string[]) {
  if (!isObject(record)) {
    errors.push("remediation must be an object");
    return;
  }
  if (!isOneOf(record?.status, REMEDIATION_STATUSES)) {
    errors.push(`unsupported remediation.status: ${record?.status}`);
  }
  if (!Array.isArray(record?.commands)) {
    errors.push("remediation.commands must be a list");
  } else {
    for (const command of record.commands) {
      if (!isObject(command)) {
        errors.push("remediation.commands entries must be objects");
        continue;
      }
      validateNonEmptyString(command?.action_id, "remediation.commands[].action_id", errors, "DCR001");
      validateNonEmptyString(command?.summary, "remediation.commands[].summary", errors, "DCR001");
      validateNonEmptyString(command?.command, "remediation.commands[].command", errors, "DCR001");
      if (typeof command?.safe_without_write !== "boolean") {
        errors.push("remediation.commands[].safe_without_write must be boolean");
      }
      if (typeof command?.requires_preview !== "boolean") {
        errors.push("remediation.commands[].requires_preview must be boolean");
      }
      if (typeof command?.preferred !== "boolean") {
        errors.push("remediation.commands[].preferred must be boolean");
      }
      if (!Array.isArray(command?.applies_to_actions)) {
        errors.push("remediation.commands[].applies_to_actions must be a list");
      } else {
        for (const appliesToAction of command.applies_to_actions) {
          validateNonEmptyString(appliesToAction, "remediation.commands[].applies_to_actions[]", errors, "DCR001");
        }
      }
      validateLifecycleReasonCodes(command?.reason_codes, "remediation.commands[].reason_codes", errors, "DCR001");
      if (!isOneOf(command?.decision, REMEDIATION_DECISIONS)) {
        errors.push(`unsupported remediation.commands[].decision: ${command?.decision}`);
      }
    }
  }
  if (!Array.isArray(record?.actions)) {
    errors.push("remediation.actions must be a list");
  } else {
    for (const action of record.actions) {
      if (!isObject(action)) {
        errors.push("remediation.actions entries must be objects");
        continue;
      }
      validateNonEmptyString(action?.action_id, "remediation.actions[].action_id", errors, "DCR001");
      if (!isOneOf(action?.action_kind, REMEDIATION_ACTION_KINDS)) {
        errors.push(`remediation.actions[].action_kind must be one of ${REMEDIATION_ACTION_KINDS.join(", ")}`);
      }
      validateNonEmptyString(action?.summary, "remediation.actions[].summary", errors, "DCR001");
      if (action?.command !== null && typeof action?.command !== "string") {
        errors.push("remediation.actions[].command must be string or null");
      }
      if (action?.path !== null && typeof action?.path !== "string") {
        errors.push("remediation.actions[].path must be string or null");
      }
      if (typeof action?.safe_without_write !== "boolean") {
        errors.push("remediation.actions[].safe_without_write must be boolean");
      }
      if (typeof action?.requires_preview !== "boolean") {
        errors.push("remediation.actions[].requires_preview must be boolean");
      }
      if (typeof action?.preferred !== "boolean") {
        errors.push("remediation.actions[].preferred must be boolean");
      }
      if (!Array.isArray(action?.applies_to_actions)) {
        errors.push("remediation.actions[].applies_to_actions must be a list");
      } else {
        for (const appliesToAction of action.applies_to_actions) {
          validateNonEmptyString(appliesToAction, "remediation.actions[].applies_to_actions[]", errors, "DCR001");
        }
      }
      validateLifecycleReasonCodes(action?.reason_codes, "remediation.actions[].reason_codes", errors, "DCR001");
      if (!isOneOf(action?.decision, REMEDIATION_DECISIONS)) {
        errors.push(`unsupported remediation.actions[].decision: ${action?.decision}`);
      }
    }
  }
}

export function validateDoctorReport(record: any) {
  const errors: string[] = [];
  if (record?.kind !== "doctor-report") {
    errors.push("kind must be doctor-report");
  }
  if (record?.schema_version !== DOCTOR_REPORT_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${DOCTOR_REPORT_SCHEMA_VERSION}`);
  }
  if (!SUPPORTED_RUNTIMES.includes(record?.runtime)) {
    errors.push(`unsupported runtime: ${record?.runtime}`);
  }
  if (!SUPPORTED_TARGETS.includes(record?.target)) {
    errors.push(`unsupported target: ${record?.target}`);
  }
  if (!SUPPORT_VERDICTS.includes(record?.support_verdict)) {
    errors.push(`unsupported support_verdict: ${record?.support_verdict}`);
  }
  if (typeof record?.install_blocked !== "boolean") {
    errors.push("install_blocked must be boolean");
  }
  if (typeof record?.generated_at !== "string") {
    errors.push("generated_at must be string");
  }
  if (!isObject(record?.environment_summary)) {
    errors.push("environment_summary must be an object");
  } else {
    const summary = record.environment_summary;
    for (const field of [
      "os",
      "shell",
      "cwd",
      "repo_root",
      "config_home",
      "state_path",
    ]) {
      validateNonEmptyString(summary?.[field], `environment_summary.${field}`, errors, "DCR001");
    }
    // install_root is null when the emit mode has no placement root at this
    // scope (plugin emit is repo-scope only at user target).
    if (summary?.install_root !== null && typeof summary?.install_root !== "string") {
      errors.push("environment_summary.install_root must be string or null");
    }
    if (summary?.runtime_executable !== null && typeof summary?.runtime_executable !== "string") {
      errors.push("environment_summary.runtime_executable must be string or null");
    }
    if (summary?.runtime_version !== null && typeof summary?.runtime_version !== "string") {
      errors.push("environment_summary.runtime_version must be string or null");
    }
    if (typeof summary?.runtime_available !== "boolean") {
      errors.push("environment_summary.runtime_available must be boolean");
    }
    if (!Array.isArray(summary?.shell_profile_candidates)) {
      errors.push("environment_summary.shell_profile_candidates must be a list");
    } else {
      for (const candidate of summary.shell_profile_candidates) {
        if (typeof candidate !== "string" || candidate.trim() === "") {
          errors.push("environment_summary.shell_profile_candidates entries must be non-empty strings");
        }
      }
    }
  }
  if (!isObject(record?.scope_probes)) {
    errors.push("scope_probes must be an object");
  } else {
    for (const target of SUPPORTED_TARGETS) {
      const probe = record.scope_probes?.[target];
      if (!isObject(probe)) {
        errors.push(`scope_probes.${target} must be an object`);
        continue;
      }
      if (probe?.target !== target) {
        errors.push(`scope_probes.${target}.target must be ${target}`);
      }
      if (typeof probe?.selected !== "boolean") {
        errors.push(`scope_probes.${target}.selected must be boolean`);
      }
      for (const field of ["config_home", "state_path"]) {
        validateNonEmptyString(probe?.[field], `scope_probes.${target}.${field}`, errors, "DCR001");
      }
      if (probe?.install_root !== null && typeof probe?.install_root !== "string") {
        errors.push(`scope_probes.${target}.install_root must be string or null`);
      }
      for (const field of ["config_home_exists", "install_root_exists", "writable", "blocking_for_install"]) {
        if (typeof probe?.[field] !== "boolean") {
          errors.push(`scope_probes.${target}.${field} must be boolean`);
        }
      }
      if (!isOneOf(probe?.verdict, SUPPORT_VERDICTS)) {
        errors.push(`unsupported scope_probes.${target}.verdict: ${probe?.verdict}`);
      }
      if (!Array.isArray(probe?.issue_codes)) {
        errors.push(`scope_probes.${target}.issue_codes must be a list`);
      } else {
        for (const issueCode of probe.issue_codes) {
          validateNonEmptyString(issueCode, `scope_probes.${target}.issue_codes[]`, errors, "DCR001");
        }
      }
    }
  }
  if (!isObject(record?.support_lane)) {
    errors.push("support_lane must be an object");
  } else {
    const lane = record.support_lane;
    validateNonEmptyString(lane?.os, "support_lane.os", errors, "DCR001");
    if (!SUPPORTED_RUNTIMES.includes(lane?.runtime)) {
      errors.push(`unsupported support_lane.runtime: ${lane?.runtime}`);
    }
    if (!SUPPORTED_TARGETS.includes(lane?.target)) {
      errors.push(`unsupported support_lane.target: ${lane?.target}`);
    }
    if (!["supported", "unverified", "prep", "unsupported"].includes(lane?.lane_status)) {
      errors.push(`unsupported support_lane.lane_status: ${lane?.lane_status}`);
    }
    if (!["recorded", "unrecorded", "outside_recorded", "prep_lane", "unsupported"].includes(lane?.tested_range_status)) {
      errors.push(`unsupported support_lane.tested_range_status: ${lane?.tested_range_status}`);
    }
    if (lane?.tested_version_range !== null && typeof lane?.tested_version_range !== "string") {
      errors.push("support_lane.tested_version_range must be string or null");
    }
    validateNonEmptyString(lane?.evidence_source, "support_lane.evidence_source", errors, "DCR001");
    validateNonEmptyString(lane?.summary, "support_lane.summary", errors, "DCR001");
    if (typeof lane?.blocking_for_install !== "boolean") {
      errors.push("support_lane.blocking_for_install must be boolean");
    }
  }
  if (!isObject(record?.runtime_compatibility)) {
    errors.push("runtime_compatibility must be an object");
  } else {
    const compatibility = record.runtime_compatibility;
    if (!["supported", "mismatch", "unknown"].includes(compatibility?.requested_runtime_range_max_status)) {
      errors.push("runtime_compatibility.requested_runtime_range_max_status must be supported, mismatch, or unknown");
    }
    if (!Number.isInteger(compatibility?.selected_pack_count)) {
      errors.push("runtime_compatibility.selected_pack_count must be an integer");
    }
    if (!Number.isInteger(compatibility?.compatible_pack_count)) {
      errors.push("runtime_compatibility.compatible_pack_count must be an integer");
    }
    if (!Array.isArray(compatibility?.incompatible_pack_ids)) {
      errors.push("runtime_compatibility.incompatible_pack_ids must be a list");
    }
  }
  if ("recent_trace_summary" in record) {
    if (!isObject(record?.recent_trace_summary)) {
      errors.push("recent_trace_summary must be an object");
    } else {
      if (!TELEMETRY_MODES.includes(record.recent_trace_summary?.telemetry_mode)) {
        errors.push(`unsupported recent_trace_summary.telemetry_mode: ${record.recent_trace_summary?.telemetry_mode}`);
      }
      if (!Number.isInteger(record.recent_trace_summary?.session_count)) {
        errors.push("recent_trace_summary.session_count must be an integer");
      }
      for (const field of ["latest_session_id", "latest_outcome", "latest_failure_domain", "retention_last_pruned_at"]) {
        if (field in record.recent_trace_summary && record.recent_trace_summary?.[field] !== null && typeof record.recent_trace_summary?.[field] !== "string") {
          errors.push(`recent_trace_summary.${field} must be string or null`);
        }
      }
    }
  }
  if ("observability_health" in record) {
    if (!isObject(record?.observability_health)) {
      errors.push("observability_health must be an object");
    } else {
      for (const field of ["trace_root_exists", "trace_root_writable", "index_event_consistent"]) {
        if (typeof record.observability_health?.[field] !== "boolean") {
          errors.push(`observability_health.${field} must be boolean`);
        }
      }
      if (!Number.isInteger(record.observability_health?.missing_event_files)) {
        errors.push("observability_health.missing_event_files must be an integer");
      }
      if (
        "retention_last_pruned_at" in record.observability_health &&
        record.observability_health?.retention_last_pruned_at !== null &&
        typeof record.observability_health?.retention_last_pruned_at !== "string"
      ) {
        errors.push("observability_health.retention_last_pruned_at must be string or null");
      }
      if ("retention_policy" in record.observability_health) {
        const policy = record.observability_health?.retention_policy;
        if (!isObject(policy)) {
          errors.push("observability_health.retention_policy must be an object");
        } else {
          if (!Number.isInteger(policy?.max_days)) {
            errors.push("observability_health.retention_policy.max_days must be an integer");
          }
          if (!Number.isInteger(policy?.max_sessions)) {
            errors.push("observability_health.retention_policy.max_sessions must be an integer");
          }
          if (typeof policy?.preserve_exports !== "boolean") {
            errors.push("observability_health.retention_policy.preserve_exports must be boolean");
          }
          if (typeof policy?.preserve_bundles !== "boolean") {
            errors.push("observability_health.retention_policy.preserve_bundles must be boolean");
          }
        }
      }
    }
  }
  if ("reason_codes" in record) {
    validateLifecycleReasonCodes(record?.reason_codes, "reason_codes", errors, "DCR001");
  }
  if ("remediation" in record) {
    validateDoctorRemediation(record?.remediation, errors);
    if (record?.install_blocked === true && record?.remediation?.status !== "blocked") {
      errors.push("remediation.status must be blocked when install_blocked is true");
    }
  } else {
    errors.push("remediation must be an object");
  }
  if ("remediation_actions" in record) {
    validateRemediationActions(record?.remediation_actions, "remediation_actions", errors, "DCR001");
  }
  if (!Array.isArray(record?.checks)) {
    errors.push("checks must be a list");
  } else {
    for (const check of record.checks) {
      validateNonEmptyString(check?.id, "checks[].id", errors, "DCR002");
      if (!DOCTOR_CHECK_GROUPS.includes(check?.group)) {
        errors.push(`unsupported checks[].group: ${check?.group}`);
      }
      if (!DOCTOR_CHECK_SEVERITIES.includes(check?.severity)) {
        errors.push(`unsupported checks[].severity: ${check?.severity}`);
      }
      if (!DOCTOR_CHECK_STATUSES.includes(check?.status)) {
        errors.push(`unsupported checks[].status: ${check?.status}`);
      }
      if (!SUPPORTED_RUNTIMES.includes(check?.runtime)) {
        errors.push(`unsupported checks[].runtime: ${check?.runtime}`);
      }
      if (!SUPPORTED_TARGETS.includes(check?.target)) {
        errors.push(`unsupported checks[].target: ${check?.target}`);
      }
      validateNonEmptyString(check?.summary, "checks[].summary", errors, "DCR002");
      if (check?.remediation !== null && typeof check?.remediation !== "string") {
        errors.push("checks[].remediation must be string or null");
      }
      if (!isObject(check?.inputs)) {
        errors.push("checks[].inputs must be an object");
      }
      if (!isObject(check?.evidence)) {
        errors.push("checks[].evidence must be an object");
      }
      if (typeof check?.blocking_for_install !== "boolean") {
        errors.push("checks[].blocking_for_install must be boolean");
      }
      if ("reason_codes" in check) {
        validateLifecycleReasonCodes(check?.reason_codes, "checks[].reason_codes", errors, "DCR002");
      }
      if ("remediation_actions" in check) {
        validateRemediationActions(check?.remediation_actions, "checks[].remediation_actions", errors, "DCR002");
      }
    }
  }
  if (!Array.isArray(record?.issues)) {
    errors.push("issues must be a list");
  } else {
    for (const issue of record.issues) {
      validateNonEmptyString(issue?.code, "issues[].code", errors, "DCR003");
      if (!["warn", "degraded", "fail", "unsupported"].includes(issue?.verdict)) {
        errors.push(`unsupported issues[].verdict: ${issue?.verdict}`);
      }
      if (!["warn", "fail"].includes(issue?.severity)) {
        errors.push(`unsupported issues[].severity: ${issue?.severity}`);
      }
      validateNonEmptyString(issue?.check_id, "issues[].check_id", errors, "DCR003");
      validateNonEmptyString(issue?.summary, "issues[].summary", errors, "DCR003");
      if (!isObject(issue?.evidence)) {
        errors.push("issues[].evidence must be an object");
      }
      if (issue?.suggested_fix !== null && typeof issue?.suggested_fix !== "string") {
        errors.push("issues[].suggested_fix must be string or null");
      }
      if (typeof issue?.blocking_for_install !== "boolean") {
        errors.push("issues[].blocking_for_install must be boolean");
      }
      if ("message" in issue && issue?.message !== null && typeof issue?.message !== "string") {
        errors.push("issues[].message must be string or null");
      }
      if ("remediation" in issue && issue?.remediation !== null && typeof issue?.remediation !== "string") {
        errors.push("issues[].remediation must be string or null");
      }
      if ("reason_codes" in issue) {
        validateLifecycleReasonCodes(issue?.reason_codes, "issues[].reason_codes", errors, "DCR003");
      }
      if ("remediation_actions" in issue) {
        validateRemediationActions(issue?.remediation_actions, "issues[].remediation_actions", errors, "DCR003");
      }
    }
  }
  if (!Array.isArray(record?.next_actions)) {
    errors.push("next_actions must be a list");
  } else {
    for (const action of record.next_actions) {
      if (typeof action !== "string" || action.trim() === "") {
        errors.push("next_actions entries must be non-empty strings");
      }
    }
  }
  if (!isObject(record?.workflow_maturity)) {
    errors.push("workflow_maturity must be an object");
  } else {
    const workflow = record.workflow_maturity;
    if (!Number.isInteger(workflow?.selected_pack_count)) {
      errors.push("workflow_maturity.selected_pack_count must be an integer");
    }
    if (workflow?.recommended_pack_id !== null && typeof workflow?.recommended_pack_id !== "string") {
      errors.push("workflow_maturity.recommended_pack_id must be string or null");
    }
    if (
      workflow?.highest_effective_workflow_maturity !== null &&
      !WORKFLOW_MATURITY_LEVELS.includes(workflow?.highest_effective_workflow_maturity)
    ) {
      errors.push("workflow_maturity.highest_effective_workflow_maturity must be a legal maturity label or null");
    }
    if (!Number.isInteger(workflow?.contradictory_claim_count)) {
      errors.push("workflow_maturity.contradictory_claim_count must be an integer");
    }
    if (!Number.isInteger(workflow?.blocked_pack_count)) {
      errors.push("workflow_maturity.blocked_pack_count must be an integer");
    }
    validateNonEmptyString(workflow?.advanced_lane_fence, "workflow_maturity.advanced_lane_fence", errors, "DCR004");
    if (!Array.isArray(workflow?.selected_packs)) {
      errors.push("workflow_maturity.selected_packs must be a list");
    } else {
      for (const pack of workflow.selected_packs) {
        validateNonEmptyString(pack?.pack_id, "workflow_maturity.selected_packs[].pack_id", errors, "DCR004");
        if (!WORKFLOW_MATURITY_LEVELS.includes(pack?.workflow_maturity)) {
          errors.push(`unsupported workflow_maturity.selected_packs[].workflow_maturity: ${pack?.workflow_maturity}`);
        }
        if (!WORKFLOW_MATURITY_LEVELS.includes(pack?.effective_workflow_maturity)) {
          errors.push(
            `unsupported workflow_maturity.selected_packs[].effective_workflow_maturity: ${pack?.effective_workflow_maturity}`,
          );
        }
        if (typeof pack?.workflow_transition_legal !== "boolean") {
          errors.push("workflow_maturity.selected_packs[].workflow_transition_legal must be boolean");
        }
        if (typeof pack?.workflow_maturity_blocked !== "boolean") {
          errors.push("workflow_maturity.selected_packs[].workflow_maturity_blocked must be boolean");
        }
        if (!Array.isArray(pack?.workflow_maturity_blockers)) {
          errors.push("workflow_maturity.selected_packs[].workflow_maturity_blockers must be a list");
        }
        if (!Array.isArray(pack?.workflow_demotion_triggers_active)) {
          errors.push("workflow_maturity.selected_packs[].workflow_demotion_triggers_active must be a list");
        }
        if (typeof pack?.workflow_promotion_checklist_ready !== "boolean") {
          errors.push("workflow_maturity.selected_packs[].workflow_promotion_checklist_ready must be boolean");
        }
        if (pack?.runtime_support_status !== null && typeof pack?.runtime_support_status !== "string") {
          errors.push("workflow_maturity.selected_packs[].runtime_support_status must be string or null");
        }
        if (pack?.runtime_support_evidence_kind !== null && typeof pack?.runtime_support_evidence_kind !== "string") {
          errors.push("workflow_maturity.selected_packs[].runtime_support_evidence_kind must be string or null");
        }
        if (pack?.support_scope !== null && typeof pack?.support_scope !== "string") {
          errors.push("workflow_maturity.selected_packs[].support_scope must be string or null");
        }
        if (typeof pack?.default_recommendation !== "boolean") {
          errors.push("workflow_maturity.selected_packs[].default_recommendation must be boolean");
        }
        if (pack?.pack_manifest !== null && typeof pack?.pack_manifest !== "string") {
          errors.push("workflow_maturity.selected_packs[].pack_manifest must be string or null");
        }
        if (typeof pack?.demoted !== "boolean") {
          errors.push("workflow_maturity.selected_packs[].demoted must be boolean");
        }
      }
    }
  }
  if (!Array.isArray(record?.installed_packs)) {
    errors.push("installed_packs must be a list");
  } else {
    for (const pack of record.installed_packs) {
      validateNonEmptyString(pack?.id, "installed_packs[].id", errors, "DCR004");
      validateNonEmptyString(pack?.version, "installed_packs[].version", errors, "DCR004");
      validateNonEmptyString(pack?.install_dir, "installed_packs[].install_dir", errors, "DCR004");
      if (!Number.isInteger(pack?.local_overrides)) {
        errors.push("installed_packs[].local_overrides must be an integer");
      }
      if ("source_class" in pack && !TRUST_SOURCE_CLASSES.includes(pack?.source_class)) {
        errors.push(`unsupported installed_packs[].source_class: ${pack?.source_class}`);
      }
      if (
        "verification_status" in pack &&
        !TRUST_VERIFICATION_STATUSES.includes(pack?.verification_status)
      ) {
        errors.push(
          `unsupported installed_packs[].verification_status: ${pack?.verification_status}`,
        );
      }
      if ("trust_tier" in pack && !PACK_TRUST_TIERS.includes(pack?.trust_tier)) {
        errors.push(`unsupported installed_packs[].trust_tier: ${pack?.trust_tier}`);
      }
      if ("signature_status" in pack && !PACK_SIGNATURE_STATUSES.includes(pack?.signature_status)) {
        errors.push(`unsupported installed_packs[].signature_status: ${pack?.signature_status}`);
      }
      if ("support_level" in pack && !PACK_SUPPORT_LEVELS.includes(pack?.support_level)) {
        errors.push(`unsupported installed_packs[].support_level: ${pack?.support_level}`);
      }
    }
  }
  if (!isObject(record?.first_workflow_guidance)) {
    errors.push("first_workflow_guidance must be an object");
  } else {
    const guidance = record.first_workflow_guidance;
    if (typeof guidance?.ready !== "boolean") {
      errors.push("first_workflow_guidance.ready must be boolean");
    }
    if (guidance?.recommended_pack_id !== null && typeof guidance?.recommended_pack_id !== "string") {
      errors.push("first_workflow_guidance.recommended_pack_id must be string or null");
    }
    validateNonEmptyString(guidance?.rationale, "first_workflow_guidance.rationale", errors, "DCR005");
    if (!Array.isArray(guidance?.commands)) {
      errors.push("first_workflow_guidance.commands must be a list");
    } else {
      for (const command of guidance.commands) {
        if (typeof command !== "string" || command.trim() === "") {
          errors.push("first_workflow_guidance.commands entries must be non-empty strings");
        }
      }
    }
  }
  return errors;
}

export function validateLintReport(record: any) {
  const errors: string[] = [];
  if (record?.kind !== "lint-report") {
    errors.push("kind must be lint-report");
  }
  if (record?.schema_version !== LINT_REPORT_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${LINT_REPORT_SCHEMA_VERSION}`);
  }
  if (!["phase4-bridge", "phase5-contract-policy"].includes(record?.phase)) {
    errors.push("phase must be phase4-bridge or phase5-contract-policy");
  }
  if (typeof record?.generated_at !== "string") {
    errors.push("generated_at must be string");
  }
  if (typeof record?.ok !== "boolean") {
    errors.push("ok must be boolean");
  }
  if (!SUPPORTED_TARGETS.includes(record?.target)) {
    errors.push(`unsupported target: ${record?.target}`);
  }
  if (record?.runtime_scope !== "all" && !SUPPORTED_RUNTIMES.includes(record?.runtime_scope)) {
    errors.push(`unsupported runtime_scope: ${record?.runtime_scope}`);
  }
  if (!isObject(record?.summary)) {
    errors.push("summary must be an object");
  } else {
    for (const field of [
      "pack_count",
      "runtime_count",
      "check_count",
      "error_count",
      "warning_count",
      "note_count",
    ]) {
      if (!Number.isInteger(record.summary?.[field])) {
        errors.push(`summary.${field} must be an integer`);
      }
    }
  }
  if (!Array.isArray(record?.checks)) {
    errors.push("checks must be a list");
  } else {
    for (const check of record.checks) {
      validateNonEmptyString(check?.code, "checks[].code", errors, "LBR001");
      if (!LINT_CHECK_RESULTS.includes(check?.result)) {
        errors.push(`unsupported checks[].result: ${check?.result}`);
      }
      if (check?.pack_id !== null && typeof check?.pack_id !== "string") {
        errors.push("checks[].pack_id must be string or null");
      }
      if (check?.runtime !== "shared" && !SUPPORTED_RUNTIMES.includes(check?.runtime)) {
        errors.push(`unsupported checks[].runtime: ${check?.runtime}`);
      }
      if (!SUPPORTED_TARGETS.includes(check?.target)) {
        errors.push(`unsupported checks[].target: ${check?.target}`);
      }
      if (check?.path !== null && typeof check?.path !== "string") {
        errors.push("checks[].path must be string or null");
      }
      validateNonEmptyString(check?.message, "checks[].message", errors, "LBR001");
      if (check?.remediation !== null && typeof check?.remediation !== "string") {
        errors.push("checks[].remediation must be string or null");
      }
    }
  }
  if (!Array.isArray(record?.issues)) {
    errors.push("issues must be a list");
  } else {
    for (const issue of record.issues) {
      validateNonEmptyString(issue?.code, "issues[].code", errors, "LBR002");
      if (!["error", "warning", "note"].includes(issue?.result)) {
        errors.push(`issues[].result must be error, warning, or note: ${issue?.result}`);
      }
      if (issue?.pack_id !== null && typeof issue?.pack_id !== "string") {
        errors.push("issues[].pack_id must be string or null");
      }
      if (issue?.runtime !== "shared" && !SUPPORTED_RUNTIMES.includes(issue?.runtime)) {
        errors.push(`unsupported issues[].runtime: ${issue?.runtime}`);
      }
      if (!SUPPORTED_TARGETS.includes(issue?.target)) {
        errors.push(`unsupported issues[].target: ${issue?.target}`);
      }
      if (issue?.path !== null && typeof issue?.path !== "string") {
        errors.push("issues[].path must be string or null");
      }
      validateNonEmptyString(issue?.message, "issues[].message", errors, "LBR002");
      if (issue?.remediation !== null && typeof issue?.remediation !== "string") {
        errors.push("issues[].remediation must be string or null");
      }
    }
  }
  if (!Array.isArray(record?.blocking_errors)) {
    errors.push("blocking_errors must be a list");
  } else {
    for (const item of record.blocking_errors) {
      validateNonEmptyString(item?.code, "blocking_errors[].code", errors, "LBR003");
      if (item?.pack_id !== null && typeof item?.pack_id !== "string") {
        errors.push("blocking_errors[].pack_id must be string or null");
      }
      if (item?.runtime !== "shared" && !SUPPORTED_RUNTIMES.includes(item?.runtime)) {
        errors.push(`unsupported blocking_errors[].runtime: ${item?.runtime}`);
      }
      validateNonEmptyString(item?.message, "blocking_errors[].message", errors, "LBR003");
    }
  }
  if ("contract_schema_version" in record && typeof record?.contract_schema_version !== "string") {
    errors.push("contract_schema_version must be string");
  }
  if ("policy_schema_version" in record && typeof record?.policy_schema_version !== "string") {
    errors.push("policy_schema_version must be string");
  }
  if ("policy_verdicts" in record) {
    if (!Array.isArray(record.policy_verdicts)) {
      errors.push("policy_verdicts must be a list");
    } else {
      for (const verdict of record.policy_verdicts) {
        if (verdict?.pack_id !== null && typeof verdict?.pack_id !== "string") {
          errors.push("policy_verdicts[].pack_id must be string or null");
        }
        if (typeof verdict?.kind !== "string") {
          errors.push("policy_verdicts[].kind must be string");
        }
        if (typeof verdict?.overall_verdict !== "string") {
          errors.push("policy_verdicts[].overall_verdict must be string");
        }
        if (!Array.isArray(verdict?.reasons)) {
          errors.push("policy_verdicts[].reasons must be a list");
        }
      }
    }
  }
  if (!Array.isArray(record?.next_actions)) {
    errors.push("next_actions must be a list");
  } else {
    for (const action of record.next_actions) {
      if (typeof action !== "string" || action.trim() === "") {
        errors.push("next_actions entries must be non-empty strings");
      }
    }
  }
  return errors;
}
