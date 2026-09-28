import {
  CONTEXT_EXPLANATION_SCHEMA_VERSION,
  DEBUG_REPORT_SCHEMA_VERSION,
  POLICY_DECISIONS,
  POLICY_EXPLANATION_SCHEMA_VERSION,
  SUPPORTED_RUNTIMES,
  SUPPORTED_TARGETS,
  TELEMETRY_MODES,
  TRACE_EVENT_TYPES,
  TRACE_FAILURE_DOMAINS,
  TRACE_OUTCOMES,
  TRACE_SEVERITIES,
} from "../../constants.ts";
import {
  isObject,
  validateBoolean,
  validateNonEmptyString,
  validateStringArray,
} from "../primitives.ts";

export function validateContextExplanation(record) {
  const errors = [];
  if (record?.kind !== "context-explanation") {
    errors.push("kind must be context-explanation");
  }
  if (record?.schema_version !== CONTEXT_EXPLANATION_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${CONTEXT_EXPLANATION_SCHEMA_VERSION}`);
  }
  validateNonEmptyString(record?.generated_at, "generated_at", errors, "CTX001");
  if (!SUPPORTED_RUNTIMES.includes(record?.runtime)) {
    errors.push(`unsupported runtime: ${record?.runtime}`);
  }
  if (!SUPPORTED_TARGETS.includes(record?.target)) {
    errors.push(`unsupported target: ${record?.target}`);
  }
  for (const field of [
    "canonical_entrypoint",
    "config_home",
    "install_root",
    "state_path",
    "trace_root",
    "cwd",
    "repo_root",
    "os",
    "shell",
  ]) {
    validateNonEmptyString(record?.[field], field, errors, "CTX001");
  }
  if (record?.direct_invocation !== null && typeof record?.direct_invocation !== "string") {
    errors.push("direct_invocation must be string or null");
  }
  if (record?.manifest_path !== null && typeof record?.manifest_path !== "string") {
    errors.push("manifest_path must be string or null");
  }
  if (record?.pack_id !== null && typeof record?.pack_id !== "string") {
    errors.push("pack_id must be string or null");
  }
  if (record?.runtime_executable !== null && typeof record?.runtime_executable !== "string") {
    errors.push("runtime_executable must be string or null");
  }
  if (record?.runtime_version !== null && typeof record?.runtime_version !== "string") {
    errors.push("runtime_version must be string or null");
  }
  if (typeof record?.runtime_available !== "boolean") {
    errors.push("runtime_available must be boolean");
  }
  if (!Array.isArray(record?.supported_trigger_surfaces)) {
    errors.push("supported_trigger_surfaces must be a list");
  } else {
    for (const item of record.supported_trigger_surfaces) {
      validateNonEmptyString(item, "supported_trigger_surfaces[]", errors, "CTX001");
    }
  }
  if (!TELEMETRY_MODES.includes(record?.telemetry_mode)) {
    errors.push(`unsupported telemetry_mode: ${record?.telemetry_mode}`);
  }
  if ("tool_availability" in record) {
    if (!Array.isArray(record.tool_availability)) {
      errors.push("tool_availability must be a list");
    } else {
      for (const tool of record.tool_availability) {
        if (!isObject(tool)) {
          errors.push("tool_availability[] must be an object");
          continue;
        }
        validateNonEmptyString(tool?.id, "tool_availability[].id", errors, "CTX001");
        if (typeof tool?.available !== "boolean") {
          errors.push("tool_availability[].available must be boolean");
        }
      }
    }
  }
  if (!isObject(record?.memory_reads)) {
    errors.push("memory_reads must be an object");
  } else {
    for (const field of ["global_project_memory", "task_memory", "session_artifacts"]) {
      if (!Array.isArray(record.memory_reads?.[field])) {
        errors.push(`memory_reads.${field} must be a list`);
        continue;
      }
      for (const item of record.memory_reads[field]) {
        validateNonEmptyString(item, `memory_reads.${field}[]`, errors, "CTX001");
      }
    }
  }
  if (!isObject(record?.memory_resolution)) {
    errors.push("memory_resolution must be an object");
  } else {
    const validAuthorities = ["authoritative", "supporting"];
    const validResolutionModes = ["explicit-paths", "project-memory-index", "filesystem-scan"];
    const validResolutionStatuses = ["resolved", "partial", "missing"];
    validateNonEmptyString(record.memory_resolution?.profile_id, "memory_resolution.profile_id", errors, "CTX001");
    validateBoolean(record.memory_resolution?.uses_shared_loader, "memory_resolution.uses_shared_loader", errors, "CTX001");
    validateStringArray(
      record.memory_resolution?.authoritative_sources,
      "memory_resolution.authoritative_sources",
      errors,
      "CTX001",
      { allowEmpty: true },
    );
    validateStringArray(
      record.memory_resolution?.missing_paths,
      "memory_resolution.missing_paths",
      errors,
      "CTX001",
      { allowEmpty: true },
    );
    validateStringArray(
      record.memory_resolution?.warnings,
      "memory_resolution.warnings",
      errors,
      "CTX001",
      { allowEmpty: true },
    );
    if (!isObject(record.memory_resolution?.record_resolution)) {
      errors.push("memory_resolution.record_resolution must be an object");
    } else {
      const validResolutionTypes = ["authoritative-selected", "supporting-gap-fill"];
      const validShadowReasons = [
        "shadowed-by-authoritative",
        "shadowed-by-authoritative-conflict",
        "shadowed-by-lower-authority-fill",
        "shadowed-by-lower-authority-fill-conflict",
      ];
      validateStringArray(
        record.memory_resolution.record_resolution?.precedence_rule,
        "memory_resolution.record_resolution.precedence_rule",
        errors,
        "CTX001",
        { allowEmpty: false },
      );
      if (!Array.isArray(record.memory_resolution.record_resolution?.resolved_claims)) {
        errors.push("memory_resolution.record_resolution.resolved_claims must be a list");
      } else {
        for (const claim of record.memory_resolution.record_resolution.resolved_claims) {
          if (!isObject(claim)) {
            errors.push("memory_resolution.record_resolution.resolved_claims[] must be an object");
            continue;
          }
          validateNonEmptyString(
            claim?.claim_key,
            "memory_resolution.record_resolution.resolved_claims[].claim_key",
            errors,
            "CTX001",
          );
          validateNonEmptyString(
            claim?.kind,
            "memory_resolution.record_resolution.resolved_claims[].kind",
            errors,
            "CTX001",
          );
          validateNonEmptyString(
            claim?.title,
            "memory_resolution.record_resolution.resolved_claims[].title",
            errors,
            "CTX001",
          );
          if (claim?.scope !== null && "scope" in claim && typeof claim?.scope !== "string") {
            errors.push("memory_resolution.record_resolution.resolved_claims[].scope must be string or null");
          }
          if (
            claim?.scope_detail !== null &&
            "scope_detail" in claim &&
            typeof claim?.scope_detail !== "string"
          ) {
            errors.push(
              "memory_resolution.record_resolution.resolved_claims[].scope_detail must be string or null",
            );
          }
          if (!isObject(claim?.selected)) {
            errors.push("memory_resolution.record_resolution.resolved_claims[].selected must be an object");
          } else {
            validateNonEmptyString(
              claim.selected?.layer,
              "memory_resolution.record_resolution.resolved_claims[].selected.layer",
              errors,
              "CTX001",
            );
            if (!validAuthorities.includes(claim.selected?.authority)) {
              errors.push(
                `memory_resolution.record_resolution.resolved_claims[].selected.authority must be one of ${validAuthorities.join(", ")}`,
              );
            }
            validateNonEmptyString(
              claim.selected?.file,
              "memory_resolution.record_resolution.resolved_claims[].selected.file",
              errors,
              "CTX001",
            );
          }
          if (!validResolutionTypes.includes(claim?.resolution_type)) {
            errors.push(
              `memory_resolution.record_resolution.resolved_claims[].resolution_type must be one of ${validResolutionTypes.join(", ")}`,
            );
          }
          if (!Array.isArray(claim?.shadowed)) {
            errors.push("memory_resolution.record_resolution.resolved_claims[].shadowed must be a list");
          } else {
            for (const shadowedEntry of claim.shadowed) {
              if (!isObject(shadowedEntry)) {
                errors.push(
                  "memory_resolution.record_resolution.resolved_claims[].shadowed[] must be an object",
                );
                continue;
              }
              validateNonEmptyString(
                shadowedEntry?.layer,
                "memory_resolution.record_resolution.resolved_claims[].shadowed[].layer",
                errors,
                "CTX001",
              );
              if (!validAuthorities.includes(shadowedEntry?.authority)) {
                errors.push(
                  `memory_resolution.record_resolution.resolved_claims[].shadowed[].authority must be one of ${validAuthorities.join(", ")}`,
                );
              }
              validateNonEmptyString(
                shadowedEntry?.file,
                "memory_resolution.record_resolution.resolved_claims[].shadowed[].file",
                errors,
                "CTX001",
              );
              if (!validShadowReasons.includes(shadowedEntry?.reason)) {
                errors.push(
                  `memory_resolution.record_resolution.resolved_claims[].shadowed[].reason must be one of ${validShadowReasons.join(", ")}`,
                );
              }
            }
          }
        }
      }
      if (!Array.isArray(record.memory_resolution.record_resolution?.conflicts)) {
        errors.push("memory_resolution.record_resolution.conflicts must be a list");
      } else {
        for (const conflict of record.memory_resolution.record_resolution.conflicts) {
          if (!isObject(conflict)) {
            errors.push("memory_resolution.record_resolution.conflicts[] must be an object");
            continue;
          }
          validateNonEmptyString(
            conflict?.claim_key,
            "memory_resolution.record_resolution.conflicts[].claim_key",
            errors,
            "CTX001",
          );
          validateNonEmptyString(
            conflict?.selected_layer,
            "memory_resolution.record_resolution.conflicts[].selected_layer",
            errors,
            "CTX001",
          );
          if (!validAuthorities.includes(conflict?.selected_authority)) {
            errors.push(
              `memory_resolution.record_resolution.conflicts[].selected_authority must be one of ${validAuthorities.join(", ")}`,
            );
          }
          validateNonEmptyString(
            conflict?.selected_file,
            "memory_resolution.record_resolution.conflicts[].selected_file",
            errors,
            "CTX001",
          );
          validateNonEmptyString(
            conflict?.shadowed_layer,
            "memory_resolution.record_resolution.conflicts[].shadowed_layer",
            errors,
            "CTX001",
          );
          if (!validAuthorities.includes(conflict?.shadowed_authority)) {
            errors.push(
              `memory_resolution.record_resolution.conflicts[].shadowed_authority must be one of ${validAuthorities.join(", ")}`,
            );
          }
          validateNonEmptyString(
            conflict?.shadowed_file,
            "memory_resolution.record_resolution.conflicts[].shadowed_file",
            errors,
            "CTX001",
          );
          if (!validShadowReasons.includes(conflict?.reason)) {
            errors.push(
              `memory_resolution.record_resolution.conflicts[].reason must be one of ${validShadowReasons.join(", ")}`,
            );
          }
        }
      }
      if (!Array.isArray(record.memory_resolution.record_resolution?.gap_fills)) {
        errors.push("memory_resolution.record_resolution.gap_fills must be a list");
      } else {
        for (const gapFill of record.memory_resolution.record_resolution.gap_fills) {
          if (!isObject(gapFill)) {
            errors.push("memory_resolution.record_resolution.gap_fills[] must be an object");
            continue;
          }
          validateNonEmptyString(
            gapFill?.claim_key,
            "memory_resolution.record_resolution.gap_fills[].claim_key",
            errors,
            "CTX001",
          );
          validateNonEmptyString(
            gapFill?.kind,
            "memory_resolution.record_resolution.gap_fills[].kind",
            errors,
            "CTX001",
          );
          validateNonEmptyString(
            gapFill?.title,
            "memory_resolution.record_resolution.gap_fills[].title",
            errors,
            "CTX001",
          );
          validateNonEmptyString(
            gapFill?.selected_layer,
            "memory_resolution.record_resolution.gap_fills[].selected_layer",
            errors,
            "CTX001",
          );
          validateNonEmptyString(
            gapFill?.selected_file,
            "memory_resolution.record_resolution.gap_fills[].selected_file",
            errors,
            "CTX001",
          );
        }
      }
    }
    if (!Array.isArray(record.memory_resolution?.layers) || record.memory_resolution.layers.length === 0) {
      errors.push("memory_resolution.layers must be a non-empty list");
    } else {
      for (const layer of record.memory_resolution.layers) {
        if (!isObject(layer)) {
          errors.push("memory_resolution.layers[] must be an object");
          continue;
        }
        validateNonEmptyString(layer?.layer, "memory_resolution.layers[].layer", errors, "CTX001");
        validateNonEmptyString(layer?.label, "memory_resolution.layers[].label", errors, "CTX001");
        if (!Number.isInteger(layer?.precedence) || layer.precedence < 1) {
          errors.push("memory_resolution.layers[].precedence must be a positive integer");
        }
        if (!validAuthorities.includes(layer?.authority)) {
          errors.push(
            `memory_resolution.layers[].authority must be one of ${validAuthorities.join(", ")}`,
          );
        }
        if (!validResolutionModes.includes(layer?.resolution_mode)) {
          errors.push(
            `memory_resolution.layers[].resolution_mode must be one of ${validResolutionModes.join(", ")}`,
          );
        }
        if (!validResolutionStatuses.includes(layer?.resolution_status)) {
          errors.push(
            `memory_resolution.layers[].resolution_status must be one of ${validResolutionStatuses.join(", ")}`,
          );
        }
        validateStringArray(
          layer?.configured_paths,
          "memory_resolution.layers[].configured_paths",
          errors,
          "CTX001",
          { allowEmpty: true },
        );
        validateStringArray(
          layer?.resolved_paths,
          "memory_resolution.layers[].resolved_paths",
          errors,
          "CTX001",
          { allowEmpty: true },
        );
        validateStringArray(
          layer?.missing_paths,
          "memory_resolution.layers[].missing_paths",
          errors,
          "CTX001",
          { allowEmpty: true },
        );
        validateStringArray(
          layer?.warnings,
          "memory_resolution.layers[].warnings",
          errors,
          "CTX001",
          { allowEmpty: true },
        );
        if (!Array.isArray(layer?.resolved_records)) {
          errors.push("memory_resolution.layers[].resolved_records must be a list");
          continue;
        }
        for (const resolvedRecord of layer.resolved_records) {
          if (!isObject(resolvedRecord)) {
            errors.push("memory_resolution.layers[].resolved_records[] must be an object");
            continue;
          }
          validateNonEmptyString(
            resolvedRecord?.file,
            "memory_resolution.layers[].resolved_records[].file",
            errors,
            "CTX001",
          );
          if (resolvedRecord?.kind !== null && typeof resolvedRecord?.kind !== "string") {
            errors.push("memory_resolution.layers[].resolved_records[].kind must be string or null");
          }
          if (resolvedRecord?.title !== null && typeof resolvedRecord?.title !== "string") {
            errors.push("memory_resolution.layers[].resolved_records[].title must be string or null");
          }
          if (resolvedRecord?.status !== null && typeof resolvedRecord?.status !== "string") {
            errors.push("memory_resolution.layers[].resolved_records[].status must be string or null");
          }
          if (resolvedRecord?.scope !== null && typeof resolvedRecord?.scope !== "string") {
            errors.push("memory_resolution.layers[].resolved_records[].scope must be string or null");
          }
          if (
            "scope_detail" in resolvedRecord &&
            resolvedRecord?.scope_detail !== null &&
            typeof resolvedRecord?.scope_detail !== "string"
          ) {
            errors.push("memory_resolution.layers[].resolved_records[].scope_detail must be string or null");
          }
        }
      }
    }
  }
  return errors;
}

export function validatePolicyExplanation(record) {
  const errors = [];
  if (record?.kind !== "policy-explanation") {
    errors.push("kind must be policy-explanation");
  }
  if (record?.schema_version !== POLICY_EXPLANATION_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${POLICY_EXPLANATION_SCHEMA_VERSION}`);
  }
  validateNonEmptyString(record?.generated_at, "generated_at", errors, "POLX001");
  if (!SUPPORTED_RUNTIMES.includes(record?.runtime)) {
    errors.push(`unsupported runtime: ${record?.runtime}`);
  }
  if (!SUPPORTED_TARGETS.includes(record?.target)) {
    errors.push(`unsupported target: ${record?.target}`);
  }
  validateNonEmptyString(record?.action, "action", errors, "POLX001");
  validateNonEmptyString(record?.overall_verdict, "overall_verdict", errors, "POLX001");
  if (!POLICY_DECISIONS.includes(record?.overall_verdict)) {
    errors.push(`unsupported overall_verdict: ${record?.overall_verdict}`);
  }
  if (record?.contract_id !== null && typeof record?.contract_id !== "string") {
    errors.push("contract_id must be string or null");
  }
  validateNonEmptyString(record?.summary, "summary", errors, "POLX001");
  for (const field of [
    "decisive_reason_codes",
    "decisive_contract_fields",
    "decisive_runtime_factors",
    "allowed_operations",
    "blocked_operations",
  ]) {
    if (!Array.isArray(record?.[field])) {
      errors.push(`${field} must be a list`);
      continue;
    }
    for (const item of record[field]) {
      validateNonEmptyString(item, `${field}[]`, errors, "POLX001");
    }
  }
  if (typeof record?.preview_required !== "boolean") {
    errors.push("preview_required must be boolean");
  }
  if (typeof record?.approval_required !== "boolean") {
    errors.push("approval_required must be boolean");
  }
  if (typeof record?.no_silent_fallback !== "boolean") {
    errors.push("no_silent_fallback must be boolean");
  }
  if (!Array.isArray(record?.reasons)) {
    errors.push("reasons must be a list");
  }
  if (!Array.isArray(record?.capability_negotiation)) {
    errors.push("capability_negotiation must be a list");
  }
  return errors;
}

export function validateDebugReport(record) {
  const errors = [];
  if (record?.kind !== "debug-report") {
    errors.push("kind must be debug-report");
  }
  if (record?.schema_version !== DEBUG_REPORT_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${DEBUG_REPORT_SCHEMA_VERSION}`);
  }
  validateNonEmptyString(record?.generated_at, "generated_at", errors, "DBG001");
  if (!isObject(record?.selector)) {
    errors.push("selector must be an object");
  }
  validateNonEmptyString(record?.session_id, "session_id", errors, "DBG001");
  if (record?.workflow_id !== null && typeof record?.workflow_id !== "string") {
    errors.push("workflow_id must be string or null");
  }
  if (record?.correlation_id !== null && typeof record?.correlation_id !== "string") {
    errors.push("correlation_id must be string or null");
  }
  if (record?.runtime !== null && !SUPPORTED_RUNTIMES.includes(record?.runtime)) {
    errors.push(`unsupported runtime: ${record?.runtime}`);
  }
  if (record?.target !== null && !SUPPORTED_TARGETS.includes(record?.target)) {
    errors.push(`unsupported target: ${record?.target}`);
  }
  validateNonEmptyString(record?.command_name, "command_name", errors, "DBG001");
  validateNonEmptyString(record?.outcome, "outcome", errors, "DBG001");
  if (!TRACE_OUTCOMES.includes(record?.outcome)) {
    errors.push(`unsupported outcome: ${record?.outcome}`);
  }
  if (!TRACE_FAILURE_DOMAINS.includes(record?.decisive_failure_domain)) {
    errors.push(`unsupported decisive_failure_domain: ${record?.decisive_failure_domain}`);
  }
  validateNonEmptyString(record?.decisive_reason, "decisive_reason", errors, "DBG001");
  if (!Array.isArray(record?.timeline)) {
    errors.push("timeline must be a list");
  } else {
    for (const event of record.timeline) {
      if (!isObject(event)) {
        errors.push("timeline[] must be an object");
        continue;
      }
      validateNonEmptyString(event?.timestamp, "timeline[].timestamp", errors, "DBG001");
      validateNonEmptyString(event?.event_type, "timeline[].event_type", errors, "DBG001");
      if (!TRACE_EVENT_TYPES.includes(event?.event_type)) {
        errors.push(`unsupported timeline[].event_type: ${event?.event_type}`);
      }
      if (!TRACE_SEVERITIES.includes(event?.severity)) {
        errors.push(`unsupported timeline[].severity: ${event?.severity}`);
      }
      if (!TRACE_FAILURE_DOMAINS.includes(event?.failure_domain)) {
        errors.push(`unsupported timeline[].failure_domain: ${event?.failure_domain}`);
      }
      validateNonEmptyString(event?.outcome, "timeline[].outcome", errors, "DBG001");
      if (!TRACE_OUTCOMES.includes(event?.outcome)) {
        errors.push(`unsupported timeline[].outcome: ${event?.outcome}`);
      }
      validateNonEmptyString(event?.summary, "timeline[].summary", errors, "DBG001");
    }
  }
  for (const field of ["related_artifacts", "repro_steps"]) {
    if (!Array.isArray(record?.[field])) {
      errors.push(`${field} must be a list`);
      continue;
    }
    for (const item of record[field]) {
      validateNonEmptyString(item, `${field}[]`, errors, "DBG001");
    }
  }
  return errors;
}
