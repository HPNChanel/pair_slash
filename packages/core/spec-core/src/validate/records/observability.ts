import {
  SUPPORTED_RUNTIMES,
  SUPPORTED_TARGETS,
  SUPPORT_BUNDLE_SCHEMA_VERSION,
  TELEMETRY_MODES,
  TELEMETRY_SUMMARY_SCHEMA_VERSION,
  TRACE_EVENT_SCHEMA_VERSION,
  TRACE_EVENT_TYPES,
  TRACE_EXPORT_SCHEMA_VERSION,
  TRACE_FAILURE_DOMAINS,
  TRACE_OUTCOMES,
  TRACE_SEVERITIES,
} from "../../constants.ts";
import {
  isObject,
  validateNonEmptyString,
} from "../primitives.ts";

export function validateTraceEvent(record) {
  const errors = [];
  if (record?.kind !== "pairslash-trace-event") {
    errors.push("kind must be pairslash-trace-event");
  }
  if (record?.schema_version !== TRACE_EVENT_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${TRACE_EVENT_SCHEMA_VERSION}`);
  }
  for (const field of [
    "event_id",
    "event_type",
    "timestamp",
    "session_id",
    "workflow_id",
    "correlation_id",
    "severity",
    "failure_domain",
    "command_name",
    "actor",
    "source_package",
    "source_module",
    "outcome",
  ]) {
    validateNonEmptyString(record?.[field], field, errors, "TRC001");
  }
  if (record?.runtime !== null && !SUPPORTED_RUNTIMES.includes(record?.runtime)) {
    errors.push(`unsupported runtime: ${record?.runtime}`);
  }
  if (record?.target !== null && !SUPPORTED_TARGETS.includes(record?.target)) {
    errors.push(`unsupported target: ${record?.target}`);
  }
  if (!TRACE_EVENT_TYPES.includes(record?.event_type)) {
    errors.push(`unsupported event_type: ${record?.event_type}`);
  }
  if (!TRACE_SEVERITIES.includes(record?.severity)) {
    errors.push(`unsupported severity: ${record?.severity}`);
  }
  if (!TRACE_FAILURE_DOMAINS.includes(record?.failure_domain)) {
    errors.push(`unsupported failure_domain: ${record?.failure_domain}`);
  }
  if (!TRACE_OUTCOMES.includes(record?.outcome)) {
    errors.push(`unsupported outcome: ${record?.outcome}`);
  }
  if (!Array.isArray(record?.redaction_tags)) {
    errors.push("redaction_tags must be a list");
  } else {
    for (const tag of record.redaction_tags) {
      validateNonEmptyString(tag, "redaction_tags[]", errors, "TRC001");
    }
  }
  if (typeof record?.telemetry_eligible !== "boolean") {
    errors.push("telemetry_eligible must be boolean");
  }
  if (!isObject(record?.payload)) {
    errors.push("payload must be an object");
  }
  if ("pack_id" in record && record?.pack_id !== null && typeof record?.pack_id !== "string") {
    errors.push("pack_id must be string or null");
  }
  if ("contract_id" in record && record?.contract_id !== null && typeof record?.contract_id !== "string") {
    errors.push("contract_id must be string or null");
  }
  if ("error_code" in record && record?.error_code !== null && typeof record?.error_code !== "string") {
    errors.push("error_code must be string or null");
  }
  if ("summary" in record && record?.summary !== null && typeof record?.summary !== "string") {
    errors.push("summary must be string or null");
  }
  if ("artifact_paths" in record) {
    if (!Array.isArray(record.artifact_paths)) {
      errors.push("artifact_paths must be a list");
    } else {
      for (const path of record.artifact_paths) {
        validateNonEmptyString(path, "artifact_paths[]", errors, "TRC001");
      }
    }
  }
  return errors;
}

function validateRedactionReport(report, errors, prefix) {
  if (!isObject(report)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  if (!Number.isInteger(report.redacted_fields)) {
    errors.push(`${prefix}.redacted_fields must be an integer`);
  }
  if (!Number.isInteger(report.redacted_events)) {
    errors.push(`${prefix}.redacted_events must be an integer`);
  }
  if (!Number.isInteger(report.unknown_sensitive_hits)) {
    errors.push(`${prefix}.unknown_sensitive_hits must be an integer`);
  }
  if (!Array.isArray(report.rules_triggered)) {
    errors.push(`${prefix}.rules_triggered must be a list`);
  } else {
    for (const rule of report.rules_triggered) {
      validateNonEmptyString(rule, `${prefix}.rules_triggered[]`, errors, "TRE001");
    }
  }
  validateNonEmptyString(report.redaction_state, `${prefix}.redaction_state`, errors, "TRE001");
  for (const field of ["secrets_removed", "hashed_values", "config_fingerprints", "normalized_paths"]) {
    if (!Number.isInteger(report?.[field])) {
      errors.push(`${prefix}.${field} must be an integer`);
    }
  }
}

export function validateTraceExport(record) {
  const errors = [];
  if (record?.kind !== "trace-export") {
    errors.push("kind must be trace-export");
  }
  if (record?.schema_version !== TRACE_EXPORT_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${TRACE_EXPORT_SCHEMA_VERSION}`);
  }
  validateNonEmptyString(record?.generated_at, "generated_at", errors, "TRE001");
  validateNonEmptyString(record?.output_dir, "output_dir", errors, "TRE001");
  if (!Number.isInteger(record?.session_count)) {
    errors.push("session_count must be an integer");
  }
  if (!Number.isInteger(record?.event_count)) {
    errors.push("event_count must be an integer");
  }
  if (!isObject(record?.selector)) {
    errors.push("selector must be an object");
  }
  validateRedactionReport(record?.redaction_report, errors, "redaction_report");
  if (!Array.isArray(record?.files)) {
    errors.push("files must be a list");
  } else {
    for (const file of record.files) {
      validateNonEmptyString(file?.id, "files[].id", errors, "TRE001");
      validateNonEmptyString(file?.path, "files[].path", errors, "TRE001");
      if (!Number.isInteger(file?.size_bytes)) {
        errors.push("files[].size_bytes must be an integer");
      }
    }
  }
  if ("summary" in record && !isObject(record?.summary)) {
    errors.push("summary must be an object");
  }
  return errors;
}

export function validateSupportBundle(record) {
  const errors = [];
  if (record?.kind !== "support-bundle") {
    errors.push("kind must be support-bundle");
  }
  if (record?.schema_version !== SUPPORT_BUNDLE_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${SUPPORT_BUNDLE_SCHEMA_VERSION}`);
  }
  validateNonEmptyString(record?.generated_at, "generated_at", errors, "SUP001");
  validateNonEmptyString(record?.bundle_id, "bundle_id", errors, "SUP001");
  validateNonEmptyString(record?.output_dir, "output_dir", errors, "SUP001");
  if (typeof record?.safe_to_share !== "boolean") {
    errors.push("safe_to_share must be boolean");
  }
  if (!isObject(record?.trace_locator)) {
    errors.push("trace_locator must be an object");
  } else {
    validateNonEmptyString(record.trace_locator?.session_id, "trace_locator.session_id", errors, "SUP001");
    validateNonEmptyString(record.trace_locator?.command_name, "trace_locator.command_name", errors, "SUP001");
    if (record.trace_locator?.workflow_id !== null && typeof record.trace_locator?.workflow_id !== "string") {
      errors.push("trace_locator.workflow_id must be string or null");
    }
    if (!TRACE_FAILURE_DOMAINS.includes(record.trace_locator?.decisive_failure_domain)) {
      errors.push(`unsupported trace_locator.decisive_failure_domain: ${record.trace_locator?.decisive_failure_domain}`);
    }
    if ("decisive_reason" in record.trace_locator && record.trace_locator?.decisive_reason !== null && typeof record.trace_locator?.decisive_reason !== "string") {
      errors.push("trace_locator.decisive_reason must be string or null");
    }
  }
  if (!isObject(record?.runtime_descriptor)) {
    errors.push("runtime_descriptor must be an object");
  } else {
    if (record.runtime_descriptor?.runtime !== null && !SUPPORTED_RUNTIMES.includes(record.runtime_descriptor?.runtime)) {
      errors.push(`unsupported runtime_descriptor.runtime: ${record.runtime_descriptor?.runtime}`);
    }
    if (record.runtime_descriptor?.target !== null && !SUPPORTED_TARGETS.includes(record.runtime_descriptor?.target)) {
      errors.push(`unsupported runtime_descriptor.target: ${record.runtime_descriptor?.target}`);
    }
    validateNonEmptyString(record.runtime_descriptor?.os, "runtime_descriptor.os", errors, "SUP001");
    validateNonEmptyString(record.runtime_descriptor?.shell, "runtime_descriptor.shell", errors, "SUP001");
    if (record.runtime_descriptor?.runtime_version !== null && typeof record.runtime_descriptor?.runtime_version !== "string") {
      errors.push("runtime_descriptor.runtime_version must be string or null");
    }
  }
  if (!isObject(record?.privacy_descriptor)) {
    errors.push("privacy_descriptor must be an object");
  } else {
    validateNonEmptyString(record.privacy_descriptor?.redaction_state, "privacy_descriptor.redaction_state", errors, "SUP001");
    if (typeof record.privacy_descriptor?.consent_required !== "boolean") {
      errors.push("privacy_descriptor.consent_required must be boolean");
    }
    if (typeof record.privacy_descriptor?.local_only_by_default !== "boolean") {
      errors.push("privacy_descriptor.local_only_by_default must be boolean");
    }
    validateNonEmptyString(
      record.privacy_descriptor?.remote_collection_default,
      "privacy_descriptor.remote_collection_default",
      errors,
      "SUP001",
    );
  }
  if (!isObject(record?.failure_taxonomy)) {
    errors.push("failure_taxonomy must be an object");
  } else {
    validateNonEmptyString(record.failure_taxonomy?.taxonomy_version, "failure_taxonomy.taxonomy_version", errors, "SUP001");
    if (!TRACE_FAILURE_DOMAINS.includes(record.failure_taxonomy?.decisive_failure_domain)) {
      errors.push(`unsupported failure_taxonomy.decisive_failure_domain: ${record.failure_taxonomy?.decisive_failure_domain}`);
    }
    validateNonEmptyString(
      record.failure_taxonomy?.recommended_surface_label,
      "failure_taxonomy.recommended_surface_label",
      errors,
      "SUP001",
    );
    validateNonEmptyString(
      record.failure_taxonomy?.recommended_type_label,
      "failure_taxonomy.recommended_type_label",
      errors,
      "SUP001",
    );
    validateNonEmptyString(
      record.failure_taxonomy?.recommended_severity_label,
      "failure_taxonomy.recommended_severity_label",
      errors,
      "SUP001",
    );
    validateNonEmptyString(
      record.failure_taxonomy?.recommended_status_label,
      "failure_taxonomy.recommended_status_label",
      errors,
      "SUP001",
    );
    validateNonEmptyString(
      record.failure_taxonomy?.recommended_issue_template,
      "failure_taxonomy.recommended_issue_template",
      errors,
      "SUP001",
    );
    validateNonEmptyString(
      record.failure_taxonomy?.maintainer_route,
      "failure_taxonomy.maintainer_route",
      errors,
      "SUP001",
    );
    validateNonEmptyString(record.failure_taxonomy?.rationale, "failure_taxonomy.rationale", errors, "SUP001");
  }
  if (!isObject(record?.trace_export)) {
    errors.push("trace_export must be an object");
  } else {
    validateNonEmptyString(record.trace_export?.path, "trace_export.path", errors, "SUP001");
    if (!Number.isInteger(record.trace_export?.session_count)) {
      errors.push("trace_export.session_count must be an integer");
    }
    if (!Number.isInteger(record.trace_export?.event_count)) {
      errors.push("trace_export.event_count must be an integer");
    }
  }
  validateRedactionReport(record?.redaction_report, errors, "redaction_report");
  if (!Array.isArray(record?.files)) {
    errors.push("files must be a list");
  } else {
    for (const file of record.files) {
      validateNonEmptyString(file?.id, "files[].id", errors, "SUP001");
      validateNonEmptyString(file?.path, "files[].path", errors, "SUP001");
      if (!Number.isInteger(file?.size_bytes)) {
        errors.push("files[].size_bytes must be an integer");
      }
    }
  }
  for (const field of [
    "debug_report_path",
    "doctor_report_path",
    "context_explanation_path",
    "policy_explanation_path",
    "issue_template_path",
    "privacy_note_path",
    "reproducibility_template_path",
    "triage_template_path",
    "readme_path",
    "failure_taxonomy_path",
  ]) {
    if (field in record && record?.[field] !== null && typeof record?.[field] !== "string") {
      errors.push(`${field} must be string or null`);
    }
  }
  if ("share_safety_reasons" in record) {
    if (!Array.isArray(record.share_safety_reasons)) {
      errors.push("share_safety_reasons must be a list");
    } else {
      for (const reason of record.share_safety_reasons) {
        validateNonEmptyString(reason, "share_safety_reasons[]", errors, "SUP001");
      }
    }
  }
  return errors;
}

export function validateTelemetrySummary(record) {
  const errors = [];
  if (record?.kind !== "telemetry-summary") {
    errors.push("kind must be telemetry-summary");
  }
  if (record?.schema_version !== TELEMETRY_SUMMARY_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${TELEMETRY_SUMMARY_SCHEMA_VERSION}`);
  }
  validateNonEmptyString(record?.generated_at, "generated_at", errors, "TEL001");
  if (!TELEMETRY_MODES.includes(record?.mode)) {
    errors.push(`unsupported mode: ${record?.mode}`);
  }
  if (!isObject(record?.selector)) {
    errors.push("selector must be an object");
  }
  if (!isObject(record?.privacy)) {
    errors.push("privacy must be an object");
  } else {
    if (typeof record.privacy?.local_only !== "boolean") {
      errors.push("privacy.local_only must be boolean");
    }
    if (typeof record.privacy?.export_requires_explicit_action !== "boolean") {
      errors.push("privacy.export_requires_explicit_action must be boolean");
    }
    validateNonEmptyString(record.privacy?.source, "privacy.source", errors, "TEL001");
  }
  if (!isObject(record?.totals)) {
    errors.push("totals must be an object");
  } else {
    for (const field of ["sessions", "successful_sessions", "failed_sessions", "support_bundle_exports"]) {
      if (!Number.isInteger(record.totals?.[field])) {
        errors.push(`totals.${field} must be an integer`);
      }
    }
  }
  if (!isObject(record?.metrics)) {
    errors.push("metrics must be an object");
  } else {
    for (const field of ["workflow_runs_started", "workflow_runs_succeeded", "weekly_reuse_days"]) {
      if (!Number.isInteger(record.metrics?.[field])) {
        errors.push(`metrics.${field} must be an integer`);
      }
    }
    if (record.metrics?.median_ttfs_seconds !== null && typeof record.metrics?.median_ttfs_seconds !== "number") {
      errors.push("metrics.median_ttfs_seconds must be number or null");
    }
  }
  if (!Array.isArray(record?.workflows)) {
    errors.push("workflows must be a list");
  } else {
    for (const workflow of record.workflows) {
      if (!isObject(workflow)) {
        errors.push("workflows[] must be an object");
        continue;
      }
      validateNonEmptyString(workflow?.workflow_key, "workflows[].workflow_key", errors, "TEL001");
      if (!SUPPORTED_RUNTIMES.includes(workflow?.runtime)) {
        errors.push(`unsupported workflows[].runtime: ${workflow?.runtime}`);
      }
      if (!SUPPORTED_TARGETS.includes(workflow?.target)) {
        errors.push(`unsupported workflows[].target: ${workflow?.target}`);
      }
      for (const field of ["sessions", "successful_sessions", "failed_sessions", "weekly_reuse_days", "support_bundle_exports"]) {
        if (!Number.isInteger(workflow?.[field])) {
          errors.push(`workflows[].${field} must be an integer`);
        }
      }
      if (workflow?.median_ttfs_seconds !== null && typeof workflow?.median_ttfs_seconds !== "number") {
        errors.push("workflows[].median_ttfs_seconds must be number or null");
      }
    }
  }
  if ("output_path" in record && record?.output_path !== null && typeof record?.output_path !== "string") {
    errors.push("output_path must be string or null");
  }
  return errors;
}
