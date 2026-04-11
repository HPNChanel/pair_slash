import {
  AUDIT_LOG_LEVELS,
  BUNDLE_KINDS,
  CAPABILITY_FLAGS,
  COMPILED_PACK_SCHEMA_VERSION,
  COMPATIBILITY_STATUSES,
  CONTEXT_EXPLANATION_SCHEMA_VERSION,
  DEBUG_REPORT_SCHEMA_VERSION,
  DOCTOR_REPORT_SCHEMA_VERSION,
  LINT_REPORT_SCHEMA_VERSION,
  DOCTOR_CHECK_GROUPS,
  DOCTOR_CHECK_SEVERITIES,
  DOCTOR_CHECK_STATUSES,
  INSTALL_JOURNAL_SCHEMA_VERSION,
  INSTALL_STATE_SCHEMA_VERSION,
  INSTALL_SURFACES,
  LIFECYCLE_REASON_CODES,
  LOGICAL_ASSET_KINDS,
  LINT_CHECK_RESULTS,
  MEMORY_ACCESS_LEVELS,
  MEMORY_AUTHORITY_MODES,
  MANAGEMENT_MODES,
  MANIFEST_MARKER_MODES,
  MANIFEST_SMOKE_ACTIONS,
  NORMALIZED_IR_SCHEMA_VERSION,
  OWNERSHIP_FILE,
  OVERRIDE_MARKER_FILE,
  PACK_CATALOG_CLASSES,
  PACK_DEPRECATION_STATUSES,
  PACK_DOCS_VISIBILITY,
  PACK_STATUSES,
  PACK_PUBLISHER_CLASSES,
  PACK_RELEASE_VISIBILITY,
  PACK_RUNTIME_EVIDENCE_KINDS,
  PACK_RUNTIME_SUPPORT_STATUSES,
  PACK_SIGNATURE_STATUSES,
  PACK_SUPPORT_LEVELS,
  PACK_TRUST_DESCRIPTOR_SCHEMA_VERSION,
  PACK_TRUST_TIERS,
  POLICY_DECISIONS,
  POLICY_EXPLANATION_SCHEMA_VERSION,
  PREVIEW_OPERATION_KINDS,
  PREVIEW_PLAN_SCHEMA_VERSION,
  RECONCILE_MODES,
  REMEDIATION_ACTION_KINDS,
  REMEDIATION_DECISIONS,
  REMEDIATION_STATUSES,
  RELEASE_CHANNELS,
  RISK_LEVELS,
  RUNTIME_ASSET_GENERATORS,
  RUNTIME_METADATA_MODES,
  RUNTIME_SELECTORS,
  SESSION_ARTIFACT_LEVELS,
  SUPPORT_BUNDLE_SCHEMA_VERSION,
  SUPPORT_VERDICTS,
  SUPPORTED_RUNTIMES,
  SUPPORTED_TARGETS,
  TELEMETRY_MODES,
  TELEMETRY_SUMMARY_SCHEMA_VERSION,
  TRUST_POLICY_ACTIONS,
  TRUST_SOURCE_CLASSES,
  TRUST_VERIFICATION_STATUSES,
  TOOL_KINDS,
  TOOL_PHASES,
  TRACE_EVENT_SCHEMA_VERSION,
  TRACE_EVENT_TYPES,
  TRACE_EXPORT_SCHEMA_VERSION,
  TRACE_FAILURE_DOMAINS,
  TRACE_OUTCOMES,
  TRACE_SEVERITIES,
  UNINSTALL_BEHAVIORS,
  UNINSTALL_STRATEGY_MODES,
  UPDATE_NON_OVERRIDE_POLICIES,
  UPDATE_STRATEGY_MODES,
  WORKFLOW_DEMOTION_TRIGGER_CODES,
  WORKFLOW_MATURITY_LEVELS,
  WORKFLOW_MATURITY_STRENGTH_ORDER,
  WORKFLOW_CLASSES,
} from "./constants.js";
import { safeParsePackManifestV2 } from "./manifest-v2.schema.js";
import {
  detectPackManifestShape,
  normalizePackManifestV2,
  toSerializablePackManifestV2,
} from "./manifest-v2.normalize.js";
import { validateRuntimeRange } from "./runtime-range.js";

function push(errors, code, message) {
  errors.push(`${code} ${message}`);
}

function sortStable(values) {
  return values
    .slice()
    .sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toPosixPath(value) {
  return value.replace(/\\/g, "/");
}

const SHARED_RUNTIME_SURFACE_MATRIX = "docs/compatibility/runtime-surface-matrix.yaml";

function isLikelyRemoteRef(value) {
  return typeof value === "string" && /^[a-z]+:\/\//i.test(value);
}

function isSharedRuntimeMatrixRef(value) {
  if (typeof value !== "string" || value.trim() === "" || isLikelyRemoteRef(value)) {
    return false;
  }
  const [pathPart] = value.split("#", 2);
  return toPosixPath(pathPart) === SHARED_RUNTIME_SURFACE_MATRIX;
}

function isAuthoritativeLiveRuntimeRecordRef(value) {
  if (typeof value !== "string" || value.trim() === "" || isLikelyRemoteRef(value)) {
    return false;
  }
  const [pathPart, fragment] = value.split("#", 2);
  if (fragment) {
    return false;
  }
  const normalizedPath = toPosixPath(pathPart);
  return normalizedPath.startsWith("docs/evidence/live-runtime/") && normalizedPath.endsWith(".yaml");
}

function validateEvidenceRefPolicy(values, field, errors, code, { requireAuthoritativeLiveRuntimeRecord = false } = {}) {
  for (const value of values) {
    if (isLikelyRemoteRef(value)) {
      push(errors, code, `${field} must use repo-local evidence references`);
      continue;
    }
    if (requireAuthoritativeLiveRuntimeRecord && !isAuthoritativeLiveRuntimeRecordRef(value)) {
      push(errors, code, `${field} must point to docs/evidence/live-runtime/*.yaml authoritative lane records`);
    }
  }
}

const WORKFLOW_TRANSITION_MAP = Object.freeze({
  canary: new Set(["canary", "preview", "deprecated"]),
  preview: new Set(["preview", "canary", "beta", "deprecated"]),
  beta: new Set(["beta", "preview", "stable", "deprecated"]),
  stable: new Set(["stable", "beta", "deprecated"]),
  deprecated: new Set(["deprecated"]),
});

function workflowMaturityRank(level) {
  if (!WORKFLOW_MATURITY_LEVELS.includes(level)) {
    return -1;
  }
  return WORKFLOW_MATURITY_STRENGTH_ORDER[level] ?? -1;
}

function isLegalWorkflowTransition(from, to) {
  if (!WORKFLOW_MATURITY_LEVELS.includes(from) || !WORKFLOW_MATURITY_LEVELS.includes(to)) {
    return false;
  }
  return WORKFLOW_TRANSITION_MAP[from]?.has(to) ?? false;
}

function validateObject(value, field, errors, code) {
  if (!isObject(value)) {
    push(errors, code, `${field} must be an object`);
    return false;
  }
  return true;
}

function validateNonEmptyString(value, field, errors, code) {
  if (typeof value !== "string" || value.trim() === "") {
    push(errors, code, `${field} must be a non-empty string`);
    return false;
  }
  return true;
}

function validateBoolean(value, field, errors, code) {
  if (typeof value !== "boolean") {
    push(errors, code, `${field} must be boolean`);
    return false;
  }
  return true;
}

function validateStringArray(value, field, errors, code, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    push(errors, code, `${field} must be ${allowEmpty ? "a list" : "a non-empty list"}`);
    return [];
  }
  const seen = new Set();
  const out = [];
  for (const item of value) {
    if (typeof item !== "string" || item.trim() === "") {
      push(errors, code, `${field} entries must be non-empty strings`);
      continue;
    }
    if (seen.has(item)) {
      push(errors, code, `${field} contains duplicate value ${item}`);
      continue;
    }
    seen.add(item);
    out.push(item);
  }
  return out;
}

function validateLifecycleReasonCodes(value, field, errors, code) {
  if (!Array.isArray(value)) {
    push(errors, code, `${field} must be a list`);
    return;
  }
  for (const reasonCode of value) {
    if (!LIFECYCLE_REASON_CODES.includes(reasonCode)) {
      push(errors, code, `${field} contains unsupported reason code ${reasonCode}`);
    }
  }
}

function validateRemediationActions(value, field, errors, code) {
  if (!Array.isArray(value)) {
    push(errors, code, `${field} must be a list`);
    return;
  }
  for (const action of value) {
    if (!isObject(action)) {
      push(errors, code, `${field} entries must be objects`);
      continue;
    }
    validateNonEmptyString(action?.action_id, `${field}[].action_id`, errors, code);
    if (!REMEDIATION_ACTION_KINDS.includes(action?.action_kind)) {
      push(errors, code, `${field}[].action_kind must be one of ${REMEDIATION_ACTION_KINDS.join(", ")}`);
    }
    validateNonEmptyString(action?.summary, `${field}[].summary`, errors, code);
    if ("command" in action && action?.command !== null && typeof action?.command !== "string") {
      push(errors, code, `${field}[].command must be string or null`);
    }
    if ("path" in action && action?.path !== null && typeof action?.path !== "string") {
      push(errors, code, `${field}[].path must be string or null`);
    }
    if (typeof action?.safe_without_write !== "boolean") {
      push(errors, code, `${field}[].safe_without_write must be boolean`);
    }
    if (typeof action?.requires_preview !== "boolean") {
      push(errors, code, `${field}[].requires_preview must be boolean`);
    }
    if (typeof action?.preferred !== "boolean") {
      push(errors, code, `${field}[].preferred must be boolean`);
    }
    if (!Array.isArray(action?.applies_to_actions)) {
      push(errors, code, `${field}[].applies_to_actions must be a list`);
    } else {
      for (const appliesToAction of action.applies_to_actions) {
        validateNonEmptyString(appliesToAction, `${field}[].applies_to_actions[]`, errors, code);
      }
    }
    validateLifecycleReasonCodes(action?.reason_codes, `${field}[].reason_codes`, errors, code);
  }
}

function validateDoctorRemediation(record, errors) {
  if (!isObject(record)) {
    errors.push("remediation must be an object");
    return;
  }
  if (!REMEDIATION_STATUSES.includes(record?.status)) {
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
      if (!REMEDIATION_DECISIONS.includes(command?.decision)) {
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
      if (!REMEDIATION_ACTION_KINDS.includes(action?.action_kind)) {
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
      if (!REMEDIATION_DECISIONS.includes(action?.decision)) {
        errors.push(`unsupported remediation.actions[].decision: ${action?.decision}`);
      }
    }
  }
}

function validatePackBlock(value, errors) {
  if (!validateObject(value, "pack", errors, "PSM003")) {
    return null;
  }
  validateNonEmptyString(value.id, "pack.id", errors, "PSM003");
  if (typeof value.id === "string" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id)) {
    push(errors, "PSM003", "pack.id must be lowercase kebab-case");
  }
  validateNonEmptyString(value.display_name, "pack.display_name", errors, "PSM003");
  validateNonEmptyString(value.summary, "pack.summary", errors, "PSM003");
  validateNonEmptyString(value.category, "pack.category", errors, "PSM003");
  if (!WORKFLOW_CLASSES.includes(value.workflow_class)) {
    push(errors, "PSM003", `pack.workflow_class must be one of ${WORKFLOW_CLASSES.join(", ")}`);
  }
  if (!Number.isInteger(value.phase)) {
    push(errors, "PSM003", "pack.phase must be an integer");
  }
  if (!PACK_STATUSES.includes(value.status)) {
    push(errors, "PSM003", `pack.status must be one of ${PACK_STATUSES.join(", ")}`);
  }
  if (value.canonical_entrypoint !== "/skills") {
    push(errors, "PSM005", "pack.canonical_entrypoint must be /skills");
  }
  return value;
}

function validateRuntimeRanges(value, errors) {
  if (!validateObject(value, "supported_runtime_ranges", errors, "PSM010")) {
    return;
  }
  const keys = Object.keys(value).sort();
  const expected = SUPPORTED_RUNTIMES.slice().sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    push(errors, "PSM010", `supported_runtime_ranges must contain exactly ${expected.join(", ")}`);
  }
  for (const runtime of SUPPORTED_RUNTIMES) {
    validateNonEmptyString(value[runtime], `supported_runtime_ranges.${runtime}`, errors, "PSM010");
  }
}

function validateCapabilities(value, riskLevel, errors) {
  const capabilities = validateStringArray(value, "capabilities", errors, "PSM030");
  for (const capability of capabilities) {
    if (!CAPABILITY_FLAGS.includes(capability)) {
      push(errors, "PSM030", `unsupported capability flag ${capability}`);
    }
  }
  if (
    riskLevel === "low" &&
    ["repo_write", "shell_exec"].some((capability) => capabilities.includes(capability))
  ) {
    push(errors, "PSM031", "repo_write or shell_exec cannot use risk_level low");
  }
  return capabilities;
}

function validateTools(value, errors) {
  if (!Array.isArray(value)) {
    push(errors, "PSM032", "required_tools must be a list");
    return;
  }
  const seen = new Set();
  for (const tool of value) {
    if (!validateObject(tool, "required_tools[]", errors, "PSM032")) {
      continue;
    }
    if (!validateNonEmptyString(tool.id, "required_tools[].id", errors, "PSM032")) {
      continue;
    }
    if (seen.has(tool.id)) {
      push(errors, "PSM032", `required_tools contains duplicate id ${tool.id}`);
    }
    seen.add(tool.id);
    if (!TOOL_KINDS.includes(tool.kind)) {
      push(errors, "PSM032", `required_tools.${tool.id}.kind must be one of ${TOOL_KINDS.join(", ")}`);
    }
    const phases = validateStringArray(
      tool.required_for,
      `required_tools.${tool.id}.required_for`,
      errors,
      "PSM032",
    );
    for (const phase of phases) {
      if (!TOOL_PHASES.includes(phase)) {
        push(errors, "PSM032", `required_tools.${tool.id}.required_for contains unsupported phase ${phase}`);
      }
    }
    validateNonEmptyString(
      tool.check_command,
      `required_tools.${tool.id}.check_command`,
      errors,
      "PSM032",
    );
  }
}

function validateMcpServers(value, capabilities, errors) {
  if (!Array.isArray(value)) {
    push(errors, "PSM033", "required_mcp_servers must be a list");
    return;
  }
  if (value.length > 0 && !capabilities.includes("mcp_client")) {
    push(errors, "PSM033", "required_mcp_servers requires capability mcp_client");
  }
  const seen = new Set();
  for (const server of value) {
    if (!validateObject(server, "required_mcp_servers[]", errors, "PSM033")) {
      continue;
    }
    if (!validateNonEmptyString(server.id, "required_mcp_servers[].id", errors, "PSM033")) {
      continue;
    }
    if (seen.has(server.id)) {
      push(errors, "PSM033", `required_mcp_servers contains duplicate id ${server.id}`);
    }
    seen.add(server.id);
  }
}

function validateMemoryPermissions(value, capabilities, riskLevel, errors) {
  if (!validateObject(value, "memory_permissions", errors, "PSM040")) {
    return;
  }
  if (!MEMORY_AUTHORITY_MODES.includes(value.authority_mode)) {
    push(
      errors,
      "PSM040",
      `memory_permissions.authority_mode must be one of ${MEMORY_AUTHORITY_MODES.join(", ")}`,
    );
  }
  if (value.explicit_write_only !== true) {
    push(errors, "PSM043", "memory_permissions.explicit_write_only must be true");
  }
  if (!MEMORY_ACCESS_LEVELS.includes(value.global_project_memory)) {
    push(
      errors,
      "PSM040",
      `memory_permissions.global_project_memory must be one of ${MEMORY_ACCESS_LEVELS.join(", ")}`,
    );
  }
  if (!MEMORY_ACCESS_LEVELS.includes(value.task_memory)) {
    push(
      errors,
      "PSM040",
      `memory_permissions.task_memory must be one of ${MEMORY_ACCESS_LEVELS.join(", ")}`,
    );
  }
  if (!SESSION_ARTIFACT_LEVELS.includes(value.session_artifacts)) {
    push(
      errors,
      "PSM040",
      `memory_permissions.session_artifacts must be one of ${SESSION_ARTIFACT_LEVELS.join(", ")}`,
    );
  }
  if (!AUDIT_LOG_LEVELS.includes(value.audit_log)) {
    push(errors, "PSM044", `memory_permissions.audit_log must be one of ${AUDIT_LOG_LEVELS.join(", ")}`);
  }

  if (value.global_project_memory === "write") {
    if (value.authority_mode !== "write-authority") {
      push(errors, "PSM041", "global memory write requires authority_mode write-authority");
    }
    if (!capabilities.includes("memory_write_global")) {
      push(errors, "PSM042", "global memory write requires capability memory_write_global");
    }
    if (riskLevel !== "critical") {
      push(errors, "PSM042", "global memory write requires risk_level critical");
    }
  }
}

function validateAssets(value, packId, errors) {
  if (!validateObject(value, "assets", errors, "PSM004")) {
    return [];
  }
  validateNonEmptyString(value.pack_dir, "assets.pack_dir", errors, "PSM004");
  if (value.pack_dir !== `packs/core/${packId}`) {
    push(errors, "PSM004", `assets.pack_dir must equal packs/core/${packId}`);
  }
  validateNonEmptyString(value.primary_skill_file, "assets.primary_skill_file", errors, "PSM020");
  const include = validateStringArray(value.include, "assets.include", errors, "PSM021");
  if (include.join("\n") !== sortStable(include).join("\n")) {
    push(errors, "PSM021", "assets.include must be sorted lexicographically");
  }
  if (include.includes(OWNERSHIP_FILE)) {
    push(errors, "PSM021", `${OWNERSHIP_FILE} must not appear in assets.include`);
  }
  if (value.primary_skill_file && !include.includes(value.primary_skill_file)) {
    push(errors, "PSM020", "assets.primary_skill_file must be included in assets.include");
  }
  if ("docs" in value && !validateObject(value.docs, "assets.docs", errors, "PSM021")) {
    return include;
  }
  return include;
}

function validateInstallTargets(value, errors) {
  const targets = validateStringArray(value, "install_targets", errors, "PSM023");
  for (const target of targets) {
    if (!SUPPORTED_TARGETS.includes(target)) {
      push(errors, "PSM023", `install_targets contains unsupported target ${target}`);
    }
  }
}

function validateOwnership(value, generatedFiles, errors) {
  if (!validateObject(value, "ownership", errors, "PSM050")) {
    return;
  }
  if (value.ownership_file !== OWNERSHIP_FILE) {
    push(errors, "PSM050", `ownership.ownership_file must be ${OWNERSHIP_FILE}`);
  }
  if (value.ownership_scope !== "pack_root") {
    push(errors, "PSM050", "ownership.ownership_scope must be pack_root");
  }
  if (value.safe_delete_policy !== "pairslash-owned-only") {
    push(errors, "PSM050", "ownership.safe_delete_policy must be pairslash-owned-only");
  }
  validateBoolean(value.record_generated_files, "ownership.record_generated_files", errors, "PSM050");
  const declaredGenerated = validateStringArray(
    value.generated_files,
    "ownership.generated_files",
    errors,
    "PSM022",
  );
  if (!declaredGenerated.includes(OWNERSHIP_FILE)) {
    push(errors, "PSM022", `ownership.generated_files must include ${OWNERSHIP_FILE}`);
  }
  if (generatedFiles) {
    const a = sortStable(declaredGenerated).join("\n");
    const b = sortStable(generatedFiles).join("\n");
    if (a !== b) {
      push(errors, "PSM022", "ownership.generated_files must match runtime generated file contract");
    }
  }
}

function validateLocalOverridePolicy(value, assetInclude, errors) {
  if (!validateObject(value, "local_override_policy", errors, "PSM051")) {
    return;
  }
  if (value.strategy !== "preserve_valid_local_overrides") {
    push(errors, "PSM051", "local_override_policy.strategy must be preserve_valid_local_overrides");
  }
  const paths = validateStringArray(
    value.eligible_paths,
    "local_override_policy.eligible_paths",
    errors,
    "PSM051",
  );
  for (const relativePath of paths) {
    if (!assetInclude.includes(relativePath)) {
      push(errors, "PSM052", `${relativePath} is not present in assets.include`);
    }
    if (relativePath === OWNERSHIP_FILE) {
      push(errors, "PSM053", `${OWNERSHIP_FILE} cannot be override eligible`);
    }
  }
  if (value.marker_file !== OVERRIDE_MARKER_FILE) {
    push(errors, "PSM051", `local_override_policy.marker_file must be ${OVERRIDE_MARKER_FILE}`);
  }
  if (value.marker_mode !== "state_or_explicit_marker") {
    push(errors, "PSM051", "local_override_policy.marker_mode must be state_or_explicit_marker");
  }
  if (value.rollback_strategy !== "restore_last_managed_state") {
    push(errors, "PSM051", "local_override_policy.rollback_strategy must be restore_last_managed_state");
  }
}

function validateRuntimeTargets(value, packId, errors) {
  if (!validateObject(value, "runtime_targets", errors, "PSM011")) {
    return;
  }
  const keys = Object.keys(value).sort();
  const expected = SUPPORTED_RUNTIMES.slice().sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    push(errors, "PSM011", `runtime_targets must contain exactly ${expected.join(", ")}`);
  }
  for (const runtime of SUPPORTED_RUNTIMES) {
    const target = value[runtime];
    if (!validateObject(target, `runtime_targets.${runtime}`, errors, "PSM011")) {
      continue;
    }
    const expectedInvocation = runtime === "codex_cli" ? `$${packId}` : `/${packId}`;
    if (target.direct_invocation !== expectedInvocation) {
      push(
        errors,
        runtime === "codex_cli" ? "PSM013" : "PSM014",
        `runtime_targets.${runtime}.direct_invocation must be ${expectedInvocation}`,
      );
    }
    if (
      runtime === "codex_cli" &&
      target.metadata_mode !== "openai_yaml_optional"
    ) {
      push(errors, "PSM061", "runtime_targets.codex_cli.metadata_mode must be openai_yaml_optional");
    }
    if (runtime === "copilot_cli" && target.metadata_mode !== "none") {
      push(errors, "PSM061", "runtime_targets.copilot_cli.metadata_mode must be none");
    }
    if (target.skill_directory_name !== packId) {
      push(errors, "PSM061", `runtime_targets.${runtime}.skill_directory_name must equal ${packId}`);
    }
    if (!validateObject(target.compatibility, `runtime_targets.${runtime}.compatibility`, errors, "PSM061")) {
      continue;
    }
    for (const field of ["canonical_picker", "direct_invocation"]) {
      if (!COMPATIBILITY_STATUSES.includes(target.compatibility[field])) {
        push(
          errors,
          "PSM061",
          `runtime_targets.${runtime}.compatibility.${field} must be one of ${COMPATIBILITY_STATUSES.join(", ")}`,
        );
      }
    }
  }
}

function cloneRecord(value) {
  return JSON.parse(JSON.stringify(value));
}

function formatIssuePath(issue) {
  if (!Array.isArray(issue?.path) || issue.path.length === 0) {
    return "manifest";
  }
  return issue.path
    .map((segment) => {
      if (typeof segment?.key === "number") {
        return `[${segment.key}]`;
      }
      return `${segment?.key ?? "?"}`;
    })
    .join(".")
    .replace(/\.\[/g, "[");
}

function validateCanonicalRuntimeBindings(canonical, errors) {
  if (!validateObject(canonical.runtime_bindings, "runtime_bindings", errors, "PSM011")) {
    return;
  }
  const keys = Object.keys(canonical.runtime_bindings).sort();
  const expected = SUPPORTED_RUNTIMES.slice().sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    push(errors, "PSM011", `runtime_bindings must contain exactly ${expected.join(", ")}`);
  }
  for (const runtime of SUPPORTED_RUNTIMES) {
    const binding = canonical.runtime_bindings[runtime];
    if (!validateObject(binding, `runtime_bindings.${runtime}`, errors, "PSM011")) {
      continue;
    }
    const expectedInvocation = runtime === "codex_cli" ? `$${canonical.pack_name}` : `/${canonical.pack_name}`;
    if (binding.direct_invocation !== expectedInvocation) {
      push(
        errors,
        runtime === "codex_cli" ? "PSM013" : "PSM014",
        `runtime_bindings.${runtime}.direct_invocation must be ${expectedInvocation}`,
      );
    }
    if (!RUNTIME_METADATA_MODES.includes(binding.metadata_mode)) {
      push(
        errors,
        "PSM061",
        `runtime_bindings.${runtime}.metadata_mode must be one of ${RUNTIME_METADATA_MODES.join(", ")}`,
      );
    }
    if (runtime === "codex_cli" && binding.metadata_mode !== "openai_yaml_optional") {
      push(errors, "PSM061", "runtime_bindings.codex_cli.metadata_mode must be openai_yaml_optional");
    }
    if (runtime === "copilot_cli" && binding.metadata_mode !== "none") {
      push(errors, "PSM061", "runtime_bindings.copilot_cli.metadata_mode must be none");
    }
    if (binding.install_dir_name !== canonical.pack_name) {
      push(errors, "PSM061", `runtime_bindings.${runtime}.install_dir_name must equal ${canonical.pack_name}`);
    }
    if (!validateObject(binding.compatibility, `runtime_bindings.${runtime}.compatibility`, errors, "PSM061")) {
      continue;
    }
    for (const field of ["canonical_picker", "direct_invocation"]) {
      if (!COMPATIBILITY_STATUSES.includes(binding.compatibility[field])) {
        push(
          errors,
          "PSM061",
          `runtime_bindings.${runtime}.compatibility.${field} must be one of ${COMPATIBILITY_STATUSES.join(", ")}`,
        );
      }
    }
  }
}

function validateCanonicalRuntimeAssets(canonical, errors, { strict = false } = {}) {
  if (!validateObject(canonical.runtime_assets, "runtime_assets", errors, "PSM020")) {
    return new Map();
  }
  validateNonEmptyString(canonical.runtime_assets.source_root, "runtime_assets.source_root", errors, "PSM004");
  if (canonical.runtime_assets.source_root !== `packs/core/${canonical.pack_name}`) {
    push(errors, "PSM004", `runtime_assets.source_root must equal packs/core/${canonical.pack_name}`);
  }
  validateNonEmptyString(canonical.runtime_assets.primary_skill, "runtime_assets.primary_skill", errors, "PSM020");
  if (!Array.isArray(canonical.runtime_assets.entries) || canonical.runtime_assets.entries.length === 0) {
    push(errors, "PSM021", "runtime_assets.entries must be a non-empty list");
    return new Map();
  }

  const assetIds = new Map();
  const sourcePaths = new Set();
  const generatedPaths = new Set();
  let primarySkillCount = 0;

  for (const entry of canonical.runtime_assets.entries) {
    if (!validateObject(entry, "runtime_assets.entries[]", errors, "PSM021")) {
      continue;
    }
    if (!validateNonEmptyString(entry.asset_id, "runtime_assets.entries[].asset_id", errors, "PSM021")) {
      continue;
    }
    if (assetIds.has(entry.asset_id)) {
      push(errors, "PSM021", `runtime_assets.entries contains duplicate asset_id ${entry.asset_id}`);
      continue;
    }
    assetIds.set(entry.asset_id, entry);
    if (!RUNTIME_SELECTORS.includes(entry.runtime)) {
      push(errors, "PSM021", `runtime_assets.entries.${entry.asset_id}.runtime is unsupported`);
    }
    if (!validateNonEmptyString(entry.asset_kind, `runtime_assets.entries.${entry.asset_id}.asset_kind`, errors, "PSM021")) {
      continue;
    }
    if (!validateNonEmptyString(entry.install_surface, `runtime_assets.entries.${entry.asset_id}.install_surface`, errors, "PSM021")) {
      continue;
    }
    if (!RUNTIME_ASSET_GENERATORS.includes(entry.generator)) {
      push(
        errors,
        "PSM021",
        `runtime_assets.entries.${entry.asset_id}.generator must be one of ${RUNTIME_ASSET_GENERATORS.join(", ")}`,
      );
    }
    if (typeof entry.required !== "boolean") {
      push(errors, "PSM021", `runtime_assets.entries.${entry.asset_id}.required must be boolean`);
    }
    if (typeof entry.override_eligible !== "boolean") {
      push(errors, "PSM021", `runtime_assets.entries.${entry.asset_id}.override_eligible must be boolean`);
    }
    const hasSourcePath = typeof entry.source_path === "string" && entry.source_path.trim() !== "";
    const hasGeneratedPath = typeof entry.generated_path === "string" && entry.generated_path.trim() !== "";
    if (hasSourcePath === hasGeneratedPath) {
      push(
        errors,
        "PSM021",
        `runtime_assets.entries.${entry.asset_id} must declare exactly one of source_path or generated_path`,
      );
      continue;
    }
    if (entry.generator === "source_copy") {
      if (entry.runtime !== "shared") {
        push(errors, "PSM021", `source asset ${entry.asset_id} must use runtime shared`);
      }
      if (entry.generated_path !== null) {
        push(errors, "PSM021", `source asset ${entry.asset_id} must not declare generated_path`);
      }
      if (sourcePaths.has(entry.source_path)) {
        push(errors, "PSM021", `runtime_assets.entries contains duplicate source_path ${entry.source_path}`);
      }
      sourcePaths.add(entry.source_path);
      if (entry.source_path === canonical.runtime_assets.primary_skill) {
        primarySkillCount += 1;
        if (entry.asset_kind !== "skill_markdown") {
          push(errors, "PSM020", "runtime_assets.primary_skill must map to a skill_markdown asset");
        }
        if (entry.install_surface !== "canonical_skill") {
          push(errors, "PSM020", "runtime_assets.primary_skill must map to canonical_skill install surface");
        }
      }
      continue;
    }
    if (entry.source_path !== null) {
      push(errors, "PSM021", `generated asset ${entry.asset_id} must not declare source_path`);
    }
    if (generatedPaths.has(entry.generated_path)) {
      push(errors, "PSM021", `runtime_assets.entries contains duplicate generated_path ${entry.generated_path}`);
    }
    generatedPaths.add(entry.generated_path);
  }

  if (primarySkillCount !== 1) {
    push(errors, "PSM020", "runtime_assets.primary_skill must appear exactly once in runtime_assets.entries");
  }

  if (strict) {
    const derived = toSerializablePackManifestV2(canonical);
    const expectedGenerated = new Map(
      derived.runtime_assets.entries
        .filter((entry) => entry.generated_path)
        .map((entry) => [entry.asset_id, entry]),
    );
    const actualGenerated = new Map(
      canonical.runtime_assets.entries
        .filter((entry) => entry.generated_path)
        .map((entry) => [entry.asset_id, entry]),
    );
    for (const [assetId, expected] of expectedGenerated) {
      const actual = actualGenerated.get(assetId);
      if (!actual) {
        push(errors, "PSM021", `runtime_assets.entries is missing required generated asset ${assetId}`);
        continue;
      }
      for (const field of ["runtime", "asset_kind", "install_surface", "generated_path", "generator"]) {
        if (actual[field] !== expected[field]) {
          push(errors, "PSM021", `runtime_assets.entries.${assetId}.${field} must equal ${expected[field]}`);
        }
      }
    }
  }

  return assetIds;
}

function validateCanonicalAssetOwnership(canonical, assetIds, errors) {
  if (!validateObject(canonical.asset_ownership, "asset_ownership", errors, "PSM050")) {
    return;
  }
  if (canonical.asset_ownership.ownership_file !== OWNERSHIP_FILE) {
    push(errors, "PSM050", `asset_ownership.ownership_file must be ${OWNERSHIP_FILE}`);
  }
  if (canonical.asset_ownership.ownership_scope !== "pack_root") {
    push(errors, "PSM050", "asset_ownership.ownership_scope must be pack_root");
  }
  if (canonical.asset_ownership.safe_delete_policy !== "pairslash-owned-only") {
    push(errors, "PSM050", "asset_ownership.safe_delete_policy must be pairslash-owned-only");
  }
  if (!Array.isArray(canonical.asset_ownership.records) || canonical.asset_ownership.records.length === 0) {
    push(errors, "PSM050", "asset_ownership.records must be a non-empty list");
    return;
  }
  const seen = new Set();
  for (const record of canonical.asset_ownership.records) {
    if (!validateObject(record, "asset_ownership.records[]", errors, "PSM050")) {
      continue;
    }
    if (!validateNonEmptyString(record.asset_id, "asset_ownership.records[].asset_id", errors, "PSM050")) {
      continue;
    }
    if (seen.has(record.asset_id)) {
      push(errors, "PSM050", `asset_ownership.records contains duplicate asset_id ${record.asset_id}`);
      continue;
    }
    seen.add(record.asset_id);
    if (!assetIds.has(record.asset_id)) {
      push(errors, "PSM050", `asset_ownership.records references unknown asset_id ${record.asset_id}`);
    }
    if (!["pairslash", "user", "system"].includes(record.owner)) {
      push(errors, "PSM050", `asset_ownership.records.${record.asset_id}.owner is invalid`);
    }
    if (!UNINSTALL_BEHAVIORS.includes(record.uninstall_behavior)) {
      push(
        errors,
        "PSM050",
        `asset_ownership.records.${record.asset_id}.uninstall_behavior must be one of ${UNINSTALL_BEHAVIORS.join(", ")}`,
      );
    }
  }
  for (const assetId of assetIds.keys()) {
    if (!seen.has(assetId)) {
      push(errors, "PSM050", `asset_ownership.records is missing asset_id ${assetId}`);
    }
  }
  const receiptRecord = canonical.asset_ownership.records.find((record) => record.asset_id === "ownership-receipt");
  if (!receiptRecord) {
    push(errors, "PSM050", "asset_ownership.records must include ownership-receipt");
  } else {
    if (receiptRecord.owner !== "pairslash") {
      push(errors, "PSM050", "ownership-receipt must be owned by pairslash");
    }
    if (receiptRecord.uninstall_behavior !== "remove_if_unmodified") {
      push(errors, "PSM050", "ownership-receipt must use uninstall_behavior remove_if_unmodified");
    }
  }
}

function validateCanonicalOverridePolicy(canonical, assetIds, errors) {
  if (!validateObject(canonical.local_override_policy, "local_override_policy", errors, "PSM051")) {
    return;
  }
  if (canonical.local_override_policy.marker_file !== OVERRIDE_MARKER_FILE) {
    push(errors, "PSM051", `local_override_policy.marker_file must be ${OVERRIDE_MARKER_FILE}`);
  }
  if (!MANIFEST_MARKER_MODES.includes(canonical.local_override_policy.marker_mode)) {
    push(
      errors,
      "PSM051",
      `local_override_policy.marker_mode must be one of ${MANIFEST_MARKER_MODES.join(", ")}`,
    );
  }
  const ids = validateStringArray(
    canonical.local_override_policy.eligible_asset_ids,
    "local_override_policy.eligible_asset_ids",
    errors,
    "PSM051",
    { allowEmpty: true },
  );
  for (const assetId of ids) {
    if (!assetIds.has(assetId)) {
      push(errors, "PSM052", `${assetId} is not present in runtime_assets.entries`);
    }
    if (assetId === "ownership-receipt") {
      push(errors, "PSM053", "ownership-receipt cannot be override eligible");
    }
  }
}

function validateCanonicalUpdateAndUninstall(canonical, errors) {
  if (!validateObject(canonical.update_strategy, "update_strategy", errors, "PSM051")) {
    return;
  }
  if (!UPDATE_STRATEGY_MODES.includes(canonical.update_strategy.mode)) {
    push(errors, "PSM051", `update_strategy.mode must be one of ${UPDATE_STRATEGY_MODES.join(", ")}`);
  }
  if (!UPDATE_NON_OVERRIDE_POLICIES.includes(canonical.update_strategy.on_non_override_change)) {
    push(
      errors,
      "PSM051",
      `update_strategy.on_non_override_change must be one of ${UPDATE_NON_OVERRIDE_POLICIES.join(", ")}`,
    );
  }
  validateNonEmptyString(canonical.update_strategy.rollback_strategy, "update_strategy.rollback_strategy", errors, "PSM051");

  if (!validateObject(canonical.uninstall_strategy, "uninstall_strategy", errors, "PSM050")) {
    return;
  }
  if (!UNINSTALL_STRATEGY_MODES.includes(canonical.uninstall_strategy.mode)) {
    push(
      errors,
      "PSM050",
      `uninstall_strategy.mode must be one of ${UNINSTALL_STRATEGY_MODES.join(", ")}`,
    );
  }
  for (const field of ["detach_modified_files", "preserve_unknown_files", "remove_empty_pack_dir"]) {
    if (typeof canonical.uninstall_strategy[field] !== "boolean") {
      push(errors, "PSM050", `uninstall_strategy.${field} must be boolean`);
    }
  }
}

function validateCanonicalSmokeChecks(canonical, errors) {
  if (!Array.isArray(canonical.smoke_checks) || canonical.smoke_checks.length === 0) {
    push(errors, "PSM062", "smoke_checks must be a non-empty list");
    return;
  }
  const seen = new Set();
  for (const check of canonical.smoke_checks) {
    if (!validateObject(check, "smoke_checks[]", errors, "PSM062")) {
      continue;
    }
    if (!validateNonEmptyString(check.id, "smoke_checks[].id", errors, "PSM062")) {
      continue;
    }
    if (seen.has(check.id)) {
      push(errors, "PSM062", `smoke_checks contains duplicate id ${check.id}`);
    }
    seen.add(check.id);
    if (!SUPPORTED_RUNTIMES.includes(check.runtime)) {
      push(errors, "PSM062", `smoke_checks.${check.id}.runtime must be one of ${SUPPORTED_RUNTIMES.join(", ")}`);
    }
    if (!SUPPORTED_TARGETS.includes(check.target)) {
      push(errors, "PSM062", `smoke_checks.${check.id}.target must be one of ${SUPPORTED_TARGETS.join(", ")}`);
    }
    if (!MANIFEST_SMOKE_ACTIONS.includes(check.action)) {
      push(errors, "PSM062", `smoke_checks.${check.id}.action must be one of ${MANIFEST_SMOKE_ACTIONS.join(", ")}`);
    }
    if (!canonical.supported_runtimes.includes(check.runtime)) {
      push(errors, "PSM062", `smoke_checks.${check.id}.runtime must exist in supported_runtimes`);
    }
    if (!canonical.install_targets.includes(check.target)) {
      push(errors, "PSM062", `smoke_checks.${check.id}.target must exist in install_targets`);
    }
  }
}

function validateCanonicalTrustDescriptor(canonical, errors) {
  if (!("trust_descriptor" in canonical) || canonical.trust_descriptor === undefined) {
    return;
  }
  validateNonEmptyString(canonical.trust_descriptor, "trust_descriptor", errors, "PSM063");
}

function deriveCanonicalRuntimeSupportStatus(canonical, runtime) {
  const compatibility = canonical?.runtime_bindings?.[runtime]?.compatibility ?? {};
  const canonicalStatus = compatibility.canonical_picker ?? "unverified";
  const directStatus = compatibility.direct_invocation ?? "unverified";
  if (canonicalStatus === "blocked") {
    return "blocked";
  }
  if (canonicalStatus === "supported" && directStatus === "supported") {
    return "supported";
  }
  if (canonicalStatus === "unverified" && directStatus === "unverified") {
    return "unverified";
  }
  return "partial";
}

function validateCanonicalCatalog(canonical, errors) {
  if (!validateObject(canonical.catalog, "catalog", errors, "PSM064")) {
    return;
  }
  if (!PACK_CATALOG_CLASSES.includes(canonical.catalog?.pack_class)) {
    push(errors, "PSM064", `catalog.pack_class must be one of ${PACK_CATALOG_CLASSES.join(", ")}`);
  }
  if (!RELEASE_CHANNELS.includes(canonical.catalog?.maturity)) {
    push(errors, "PSM064", `catalog.maturity must be one of ${RELEASE_CHANNELS.join(", ")}`);
  }
  if (canonical.catalog?.maturity !== canonical.release_channel) {
    push(errors, "PSM064", "catalog.maturity must match release_channel");
  }
  if (!PACK_DOCS_VISIBILITY.includes(canonical.catalog?.docs_visibility)) {
    push(errors, "PSM064", `catalog.docs_visibility must be one of ${PACK_DOCS_VISIBILITY.join(", ")}`);
  }
  for (const field of ["default_discovery", "default_recommendation"]) {
    if (typeof canonical.catalog?.[field] !== "boolean") {
      push(errors, "PSM064", `catalog.${field} must be boolean`);
    }
  }
  if (
    canonical.catalog?.default_recommendation === true &&
    canonical.catalog?.default_discovery !== true
  ) {
    push(errors, "PSM064", "catalog.default_recommendation requires catalog.default_discovery");
  }
  if (
    canonical.catalog?.default_recommendation === true &&
    ["deprecated", "archived"].includes(canonical.catalog?.deprecation_status)
  ) {
    push(errors, "PSM064", "catalog.default_recommendation cannot be true for deprecated or archived workflows");
  }
  if (!PACK_RELEASE_VISIBILITY.includes(canonical.catalog?.release_visibility)) {
    push(errors, "PSM064", `catalog.release_visibility must be one of ${PACK_RELEASE_VISIBILITY.join(", ")}`);
  }
  if (!PACK_DEPRECATION_STATUSES.includes(canonical.catalog?.deprecation_status)) {
    push(
      errors,
      "PSM064",
      `catalog.deprecation_status must be one of ${PACK_DEPRECATION_STATUSES.join(", ")}`,
    );
  }
  if (
    canonical.catalog?.deprecation_status === "archived" &&
    canonical.status !== "deprecated"
  ) {
    push(errors, "PSM064", "catalog.deprecation_status archived requires manifest status deprecated");
  }
}

function validateCanonicalSupport(canonical, errors) {
  if (!validateObject(canonical.support, "support", errors, "PSM065")) {
    return;
  }
  if (!validateObject(canonical.support?.publisher, "support.publisher", errors, "PSM065")) {
    return;
  }
  validateNonEmptyString(canonical.support.publisher?.publisher_id, "support.publisher.publisher_id", errors, "PSM065");
  validateNonEmptyString(canonical.support.publisher?.display_name, "support.publisher.display_name", errors, "PSM065");
  validateNonEmptyString(canonical.support.publisher?.contact, "support.publisher.contact", errors, "PSM065");
  if (!PACK_PUBLISHER_CLASSES.includes(canonical.support.publisher?.publisher_class)) {
    push(
      errors,
      "PSM065",
      `support.publisher.publisher_class must be one of ${PACK_PUBLISHER_CLASSES.join(", ")}`,
    );
  }
  if (!PACK_TRUST_TIERS.includes(canonical.support?.tier_claim)) {
    push(errors, "PSM065", `support.tier_claim must be one of ${PACK_TRUST_TIERS.join(", ")}`);
  }
  if (!PACK_SUPPORT_LEVELS.includes(canonical.support?.support_level_claim)) {
    push(
      errors,
      "PSM065",
      `support.support_level_claim must be one of ${PACK_SUPPORT_LEVELS.join(", ")}`,
    );
  }
  if (!WORKFLOW_MATURITY_LEVELS.includes(canonical.support?.workflow_maturity)) {
    push(
      errors,
      "PSM065",
      `support.workflow_maturity must be one of ${WORKFLOW_MATURITY_LEVELS.join(", ")}`,
    );
  }
  const workflowMaturity = canonical.support?.workflow_maturity;
  if (!validateObject(canonical.support?.signature, "support.signature", errors, "PSM065")) {
    return;
  }
  for (const field of ["required", "allow_local_unsigned"]) {
    if (typeof canonical.support.signature?.[field] !== "boolean") {
      push(errors, "PSM065", `support.signature.${field} must be boolean`);
    }
  }
  if (!validateObject(canonical.support?.runtime_support, "support.runtime_support", errors, "PSM065")) {
    return;
  }
  for (const runtime of SUPPORTED_RUNTIMES) {
    const runtimeSupport = canonical.support.runtime_support?.[runtime];
    if (!validateObject(runtimeSupport, `support.runtime_support.${runtime}`, errors, "PSM065")) {
      continue;
    }
    if (!PACK_RUNTIME_SUPPORT_STATUSES.includes(runtimeSupport?.status)) {
      push(
        errors,
        "PSM065",
        `support.runtime_support.${runtime}.status must be one of ${PACK_RUNTIME_SUPPORT_STATUSES.join(", ")}`,
      );
    }
    if (runtimeSupport?.evidence_ref !== null && typeof runtimeSupport?.evidence_ref !== "string") {
      push(errors, "PSM065", `support.runtime_support.${runtime}.evidence_ref must be string or null`);
    }
    if (typeof runtimeSupport?.evidence_ref === "string" && isLikelyRemoteRef(runtimeSupport.evidence_ref)) {
      push(errors, "PSM065", `support.runtime_support.${runtime}.evidence_ref must be repo-local`);
    }
    if (
      ["supported", "partial"].includes(runtimeSupport?.status) &&
      (typeof runtimeSupport?.evidence_ref !== "string" || runtimeSupport.evidence_ref.trim() === "")
    ) {
      push(errors, "PSM065", `support.runtime_support.${runtime}.status ${runtimeSupport.status} requires evidence_ref`);
    }
    if (!PACK_RUNTIME_EVIDENCE_KINDS.includes(runtimeSupport?.evidence_kind)) {
      push(
        errors,
        "PSM065",
        `support.runtime_support.${runtime}.evidence_kind must be one of ${PACK_RUNTIME_EVIDENCE_KINDS.join(", ")}`,
      );
    }
    if (
      runtimeSupport?.evidence_kind === "lane-matrix" &&
      !isSharedRuntimeMatrixRef(runtimeSupport?.evidence_ref)
    ) {
      push(
        errors,
        "PSM065",
        `support.runtime_support.${runtime}.evidence_ref must point to ${SHARED_RUNTIME_SURFACE_MATRIX} for lane-matrix`,
      );
    }
    if (
      runtimeSupport?.evidence_kind === "pack-runtime-live" &&
      !isAuthoritativeLiveRuntimeRecordRef(runtimeSupport?.evidence_ref)
    ) {
      push(
        errors,
        "PSM065",
        `support.runtime_support.${runtime}.evidence_ref must point to docs/evidence/live-runtime/*.yaml for pack-runtime-live`,
      );
    }
    if (typeof runtimeSupport?.required_for_promotion !== "boolean") {
      push(errors, "PSM065", `support.runtime_support.${runtime}.required_for_promotion must be boolean`);
    }
    const manifestStatus = deriveCanonicalRuntimeSupportStatus(canonical, runtime);
    if (manifestStatus === "blocked" && runtimeSupport?.status !== "blocked") {
      push(errors, "PSM065", `support.runtime_support.${runtime}.status cannot exceed blocked manifest runtime surface`);
    }
    if (manifestStatus === "unverified" && runtimeSupport?.status === "supported") {
      push(errors, "PSM065", `support.runtime_support.${runtime}.status cannot exceed unverified manifest compatibility`);
    }
  }

  if (!validateObject(canonical.support?.workflow_transition, "support.workflow_transition", errors, "PSM065")) {
    return;
  }
  const transitionFrom = canonical.support.workflow_transition?.from;
  if (
    transitionFrom !== null &&
    !WORKFLOW_MATURITY_LEVELS.includes(transitionFrom)
  ) {
    push(
      errors,
      "PSM065",
      `support.workflow_transition.from must be one of ${WORKFLOW_MATURITY_LEVELS.join(", ")} or null`,
    );
  }
  validateNonEmptyString(canonical.support.workflow_transition?.reason, "support.workflow_transition.reason", errors, "PSM065");
  if (WORKFLOW_MATURITY_LEVELS.includes(workflowMaturity)) {
    const transitionSource = transitionFrom ?? workflowMaturity;
    if (!isLegalWorkflowTransition(transitionSource, workflowMaturity)) {
      push(errors, "PSM065", `support.workflow_transition.from ${transitionSource} -> ${workflowMaturity} is not allowed`);
    }
  }

  if (!validateObject(canonical.support?.workflow_evidence, "support.workflow_evidence", errors, "PSM065")) {
    return;
  }
  const deterministicRefs = validateStringArray(
    canonical.support.workflow_evidence?.deterministic_refs,
    "support.workflow_evidence.deterministic_refs",
    errors,
    "PSM065",
  );
  if (!validateObject(canonical.support.workflow_evidence?.live_workflow_refs, "support.workflow_evidence.live_workflow_refs", errors, "PSM065")) {
    return;
  }
  const liveWorkflowRefs = Object.fromEntries(
    SUPPORTED_RUNTIMES.map((runtime) => [
      runtime,
      validateStringArray(
        canonical.support.workflow_evidence.live_workflow_refs?.[runtime],
        `support.workflow_evidence.live_workflow_refs.${runtime}`,
        errors,
        "PSM065",
        { allowEmpty: true },
      ),
    ]),
  );
  for (const runtime of SUPPORTED_RUNTIMES) {
    validateEvidenceRefPolicy(
      liveWorkflowRefs[runtime],
      `support.workflow_evidence.live_workflow_refs.${runtime}`,
      errors,
      "PSM065",
      { requireAuthoritativeLiveRuntimeRecord: true },
    );
  }
  const operationalSafetyRefs = validateStringArray(
    canonical.support.workflow_evidence?.operational_safety_refs,
    "support.workflow_evidence.operational_safety_refs",
    errors,
    "PSM065",
    { allowEmpty: true },
  );
  validateEvidenceRefPolicy(
    operationalSafetyRefs,
    "support.workflow_evidence.operational_safety_refs",
    errors,
    "PSM065",
    { requireAuthoritativeLiveRuntimeRecord: true },
  );
  const migrationRefs = validateStringArray(
    canonical.support.workflow_evidence?.migration_refs,
    "support.workflow_evidence.migration_refs",
    errors,
    "PSM065",
    { allowEmpty: true },
  );
  validateEvidenceRefPolicy(
    migrationRefs,
    "support.workflow_evidence.migration_refs",
    errors,
    "PSM065",
  );

  if (workflowMaturity !== "deprecated" && deterministicRefs.length === 0) {
    push(errors, "PSM065", "support.workflow_evidence.deterministic_refs must include at least one reference for non-deprecated workflows");
  }
  if (["preview", "beta", "stable"].includes(workflowMaturity)) {
    for (const runtime of SUPPORTED_RUNTIMES) {
      if (liveWorkflowRefs[runtime].length === 0) {
        push(errors, "PSM065", `support.workflow_evidence.live_workflow_refs.${runtime} requires at least one reference for ${workflowMaturity}`);
      }
    }
  }
  if (["beta", "stable"].includes(workflowMaturity)) {
    for (const runtime of SUPPORTED_RUNTIMES) {
      if (liveWorkflowRefs[runtime].length < 2) {
        push(errors, "PSM065", `support.workflow_evidence.live_workflow_refs.${runtime} requires repeated evidence for ${workflowMaturity}`);
      }
    }
  }

  if (!validateObject(canonical.support?.promotion_checklist, "support.promotion_checklist", errors, "PSM065")) {
    return;
  }
  if (!WORKFLOW_MATURITY_LEVELS.includes(canonical.support.promotion_checklist?.required_for_label)) {
    push(
      errors,
      "PSM065",
      `support.promotion_checklist.required_for_label must be one of ${WORKFLOW_MATURITY_LEVELS.join(", ")}`,
    );
  }
  if (
    WORKFLOW_MATURITY_LEVELS.includes(workflowMaturity) &&
    canonical.support.promotion_checklist?.required_for_label !== workflowMaturity
  ) {
    push(errors, "PSM065", "support.promotion_checklist.required_for_label must match support.workflow_maturity");
  }
  if (!validateObject(canonical.support.promotion_checklist?.claimed_lanes, "support.promotion_checklist.claimed_lanes", errors, "PSM065")) {
    return;
  }
  for (const runtime of SUPPORTED_RUNTIMES) {
    validateStringArray(
      canonical.support.promotion_checklist.claimed_lanes?.[runtime],
      `support.promotion_checklist.claimed_lanes.${runtime}`,
      errors,
      "PSM065",
      { allowEmpty: true },
    );
  }
  for (const field of ["canonical_entrypoint_verified", "wording_verified", "docs_synced"]) {
    if (typeof canonical.support.promotion_checklist?.[field] !== "boolean") {
      push(errors, "PSM065", `support.promotion_checklist.${field} must be boolean`);
    }
  }
  if (
    ["preview", "beta", "stable"].includes(workflowMaturity) &&
    canonical.support.promotion_checklist?.canonical_entrypoint_verified !== true
  ) {
    push(errors, "PSM065", "support.promotion_checklist.canonical_entrypoint_verified must be true for preview/beta/stable");
  }
  if (
    ["beta", "stable"].includes(workflowMaturity) &&
    canonical.support.promotion_checklist?.docs_synced !== true
  ) {
    push(errors, "PSM065", "support.promotion_checklist.docs_synced must be true for beta/stable");
  }
  if (
    workflowMaturity === "stable" &&
    canonical.support.promotion_checklist?.wording_verified !== true
  ) {
    push(errors, "PSM065", "support.promotion_checklist.wording_verified must be true for stable");
  }

  if (!validateObject(canonical.support?.demotion_policy, "support.demotion_policy", errors, "PSM065")) {
    return;
  }
  validateNonEmptyString(canonical.support.demotion_policy?.owner, "support.demotion_policy.owner", errors, "PSM065");
  if (!WORKFLOW_MATURITY_LEVELS.includes(canonical.support.demotion_policy?.fallback_maturity)) {
    push(
      errors,
      "PSM065",
      `support.demotion_policy.fallback_maturity must be one of ${WORKFLOW_MATURITY_LEVELS.join(", ")}`,
    );
  }
  const demotionTriggerCodes = validateStringArray(
    canonical.support.demotion_policy?.trigger_codes,
    "support.demotion_policy.trigger_codes",
    errors,
    "PSM065",
  );
  for (const triggerCode of demotionTriggerCodes) {
    if (!WORKFLOW_DEMOTION_TRIGGER_CODES.includes(triggerCode)) {
      push(
        errors,
        "PSM065",
        `support.demotion_policy.trigger_codes contains unsupported code ${triggerCode}`,
      );
    }
  }
  if (
    WORKFLOW_MATURITY_LEVELS.includes(workflowMaturity) &&
    WORKFLOW_MATURITY_LEVELS.includes(canonical.support.demotion_policy?.fallback_maturity) &&
    workflowMaturity !== "deprecated" &&
    workflowMaturityRank(canonical.support.demotion_policy.fallback_maturity) > workflowMaturityRank(workflowMaturity)
  ) {
    push(errors, "PSM065", "support.demotion_policy.fallback_maturity must not be stronger than support.workflow_maturity");
  }

  if (workflowMaturity === "deprecated") {
    if (canonical.status !== "deprecated") {
      push(errors, "PSM065", "support.workflow_maturity deprecated requires manifest status deprecated");
    }
    if (!["deprecated", "archived"].includes(canonical.catalog?.deprecation_status)) {
      push(errors, "PSM065", "support.workflow_maturity deprecated requires catalog.deprecation_status deprecated or archived");
    }
    if (
      (typeof canonical.catalog?.replacement_pack !== "string" || canonical.catalog.replacement_pack.trim() === "") &&
      migrationRefs.length === 0
    ) {
      push(errors, "PSM065", "deprecated workflows require catalog.replacement_pack or support.workflow_evidence.migration_refs");
    }
  }
  if (
    canonical.status === "deprecated" &&
    workflowMaturity !== "deprecated"
  ) {
    push(errors, "PSM065", "manifest status deprecated requires support.workflow_maturity deprecated");
  }
  if (
    ["deprecated", "archived"].includes(canonical.catalog?.deprecation_status) &&
    workflowMaturity !== "deprecated"
  ) {
    push(errors, "PSM065", "catalog.deprecation_status deprecated/archived requires support.workflow_maturity deprecated");
  }
  if (
    workflowMaturity === "deprecated" &&
    canonical.catalog?.default_recommendation === true
  ) {
    push(errors, "PSM065", "deprecated workflows must not set catalog.default_recommendation");
  }

  const isWriteAuthorityWorkflow =
    canonical.workflow_class === "write-authority" ||
    canonical.memory_permissions?.global_project_memory === "write" ||
    (canonical.capabilities ?? []).includes("memory_write_global");
  if (isWriteAuthorityWorkflow && ["preview", "beta", "stable"].includes(workflowMaturity) && operationalSafetyRefs.length === 0) {
    push(errors, "PSM065", "write-authority workflows at preview/beta/stable require support.workflow_evidence.operational_safety_refs");
  }
  if (isWriteAuthorityWorkflow && workflowMaturity === "stable" && operationalSafetyRefs.length < 2) {
    push(errors, "PSM065", "write-authority workflows at stable require repeated operational safety evidence");
  }
  if (isWriteAuthorityWorkflow && workflowMaturity === "stable") {
    for (const runtime of SUPPORTED_RUNTIMES) {
      const runtimeSupport = canonical.support.runtime_support?.[runtime];
      if (runtimeSupport?.required_for_promotion === false) {
        continue;
      }
      if (runtimeSupport?.evidence_kind !== "pack-runtime-live") {
        push(errors, "PSM065", `write-authority stable workflows require support.runtime_support.${runtime}.evidence_kind pack-runtime-live`);
      }
      if (["blocked", "unverified"].includes(runtimeSupport?.status)) {
        push(errors, "PSM065", `write-authority stable workflows require support.runtime_support.${runtime}.status supported or partial`);
      }
    }
  }

  if (!validateObject(canonical.support?.policy_requirements, "support.policy_requirements", errors, "PSM065")) {
    return;
  }
  for (const field of [
    "no_silent_fallback",
    "preview_required_for_mutation",
    "explicit_write_only_memory",
  ]) {
    if (canonical.support.policy_requirements?.[field] !== true) {
      push(errors, "PSM065", `support.policy_requirements.${field} must be true`);
    }
  }
  if (!validateObject(canonical.support?.maintainers, "support.maintainers", errors, "PSM065")) {
    return;
  }
  validateNonEmptyString(canonical.support.maintainers?.owner, "support.maintainers.owner", errors, "PSM065");
  validateNonEmptyString(canonical.support.maintainers?.contact, "support.maintainers.contact", errors, "PSM065");

  if (
    canonical.memory_permissions?.global_project_memory === "write" &&
    canonical.support?.tier_claim !== "core-maintained"
  ) {
    push(errors, "PSM065", "memory-write packs must claim support.tier_claim core-maintained");
  }
  if (
    (canonical.capabilities ?? []).includes("memory_write_global") &&
    canonical.support?.tier_claim !== "core-maintained"
  ) {
    push(errors, "PSM065", "memory_write_global capability requires support.tier_claim core-maintained");
  }
  if (
    canonical.support?.support_level_claim === "core-supported" &&
    canonical.support?.tier_claim !== "core-maintained"
  ) {
    push(errors, "PSM065", "support.support_level_claim core-supported requires support.tier_claim core-maintained");
  }
  if (
    canonical.support?.support_level_claim === "publisher-verified" &&
    canonical.support?.tier_claim !== "verified-external"
  ) {
    push(errors, "PSM065", "support.support_level_claim publisher-verified requires support.tier_claim verified-external");
  }
  if (canonical.support?.publisher?.publisher_id === "pairslash") {
    if (canonical.support?.tier_claim === "verified-external") {
      push(errors, "PSM065", "pairslash publisher must not claim verified-external");
    }
  } else if (["core-maintained", "first-party-official"].includes(canonical.support?.tier_claim)) {
    push(errors, "PSM065", "non-pairslash publishers cannot claim first-party tiers");
  }
}

export function validatePackManifestV2(record) {
  const errors = [];
  const shape = detectPackManifestShape(record);
  const hasCompatibilityAliases =
    shape === "canonical-v2.1.0" &&
    (Boolean(record?.pack) || Boolean(record?.assets) || Boolean(record?.runtime_targets) || Boolean(record?.ownership));

  if (record?.kind !== "pack-manifest-v2") {
    push(errors, "PSM001", "kind must be pack-manifest-v2");
    return errors;
  }
  if (shape === "unknown") {
    push(errors, "PSM002", `schema_version must be ${LEGACY_PHASE4_SCHEMA_VERSION} or ${PHASE4_SCHEMA_VERSION}`);
    return errors;
  }

  const rawRuntimeKeys = sortStable([
    ...Object.keys(record?.supported_runtime_ranges ?? {}),
    ...Object.keys(record?.runtime_bindings ?? {}),
    ...Object.keys(record?.runtime_targets ?? {}),
    ...(Array.isArray(record?.supported_runtimes) ? record.supported_runtimes : []),
  ]);
  for (const runtime of rawRuntimeKeys) {
    if (!SUPPORTED_RUNTIMES.includes(runtime)) {
      push(errors, "PSM010", `supported runtime declarations include unsupported runtime ${runtime}`);
      push(errors, "PSM012", `unsupported runtime ${runtime}`);
    }
  }

  let canonical;
  if (shape === "legacy-v2.0.0" || hasCompatibilityAliases) {
    canonical = toSerializablePackManifestV2(record);
  } else {
    canonical = cloneRecord(record);
  }

  const parseResult = safeParsePackManifestV2(canonical);
  if (!parseResult.success) {
    for (const issue of parseResult.issues ?? []) {
      push(errors, "PSM000", `${formatIssuePath(issue)} :: ${issue.message}`);
    }
    return errors;
  }

  const expectedRuntimeSet = SUPPORTED_RUNTIMES.slice().sort();
  const supportedRuntimes = validateStringArray(canonical.supported_runtimes, "supported_runtimes", errors, "PSM010");
  const sortedRuntimes = supportedRuntimes.slice().sort();
  if (
    sortedRuntimes.length !== expectedRuntimeSet.length ||
    sortedRuntimes.some((runtime, index) => runtime !== expectedRuntimeSet[index])
  ) {
    push(errors, "PSM010", `supported_runtimes must contain exactly ${expectedRuntimeSet.join(", ")}`);
  }

  validateNonEmptyString(canonical.pack_version, "pack_version", errors, "PSM003");
  validateNonEmptyString(canonical.pack_name, "pack_name", errors, "PSM003");
  if (typeof canonical.pack_name === "string" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(canonical.pack_name)) {
    push(errors, "PSM003", "pack_name must be lowercase kebab-case");
  }
  validateNonEmptyString(canonical.display_name, "display_name", errors, "PSM003");
  validateNonEmptyString(canonical.summary, "summary", errors, "PSM003");
  validateNonEmptyString(canonical.category, "category", errors, "PSM003");
  if (!WORKFLOW_CLASSES.includes(canonical.workflow_class)) {
    push(errors, "PSM003", `workflow_class must be one of ${WORKFLOW_CLASSES.join(", ")}`);
  }
  if (!Number.isInteger(canonical.phase)) {
    push(errors, "PSM003", "phase must be an integer");
  }
  if (!PACK_STATUSES.includes(canonical.status)) {
    push(errors, "PSM003", `status must be one of ${PACK_STATUSES.join(", ")}`);
  }
  if (canonical.canonical_entrypoint !== "/skills") {
    push(errors, "PSM005", "canonical_entrypoint must be /skills");
  }
  if (!RISK_LEVELS.includes(canonical.risk_level)) {
    push(errors, "PSM031", `risk_level must be one of ${RISK_LEVELS.join(", ")}`);
  }
  if (!RELEASE_CHANNELS.includes(canonical.release_channel)) {
    push(errors, "PSM060", `release_channel must be one of ${RELEASE_CHANNELS.join(", ")}`);
  }

  validateRuntimeRanges(canonical.supported_runtime_ranges, errors);
  for (const runtime of SUPPORTED_RUNTIMES) {
    if (!validateRuntimeRange(canonical.supported_runtime_ranges?.[runtime])) {
      push(
        errors,
        "PSM010",
        `supported_runtime_ranges.${runtime} must use exact x.y.z or >=x.y.z semver format`,
      );
    }
  }
  validateInstallTargets(canonical.install_targets, errors);
  const capabilities = validateCapabilities(canonical.capabilities, canonical.risk_level, errors);
  validateTools(canonical.required_tools, errors);
  validateMcpServers(canonical.required_mcp_servers, capabilities, errors);
  validateMemoryPermissions(canonical.memory_permissions, capabilities, canonical.risk_level, errors);
  validateCanonicalRuntimeBindings(canonical, errors);
  const assetIds = validateCanonicalRuntimeAssets(canonical, errors, {
    strict: shape === "canonical-v2.1.0" && !hasCompatibilityAliases,
  });
  validateCanonicalAssetOwnership(canonical, assetIds, errors);
  validateCanonicalOverridePolicy(canonical, assetIds, errors);
  validateCanonicalUpdateAndUninstall(canonical, errors);
  validateCanonicalSmokeChecks(canonical, errors);
  validateCanonicalCatalog(canonical, errors);
  validateCanonicalSupport(canonical, errors);
  validateCanonicalTrustDescriptor(canonical, errors);

  return errors;
}

export function validateNormalizedIr(record) {
  const errors = [];
  if (record?.kind !== "normalized-pack-ir") {
    errors.push("kind must be normalized-pack-ir");
  }
  if (record?.schema_version !== NORMALIZED_IR_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${NORMALIZED_IR_SCHEMA_VERSION}`);
  }
  validateNonEmptyString(record?.manifest_digest, "manifest_digest", errors, "NIR001");
  if (!validateObject(record?.pack, "pack", errors, "NIR001")) {
    return errors;
  }
  validateNonEmptyString(record?.pack?.id, "pack.id", errors, "NIR001");
  validateNonEmptyString(record?.pack?.canonical_entrypoint, "pack.canonical_entrypoint", errors, "NIR001");
  if (!validateObject(record?.policy, "policy", errors, "NIR001")) {
    return errors;
  }
  if (!validateObject(record?.runtime_support, "runtime_support", errors, "NIR001")) {
    return errors;
  }
  const runtimeKeys = Object.keys(record.runtime_support).sort();
  const expectedRuntimeKeys = SUPPORTED_RUNTIMES.slice().sort();
  if (
    runtimeKeys.length !== expectedRuntimeKeys.length ||
    runtimeKeys.some((key, index) => key !== expectedRuntimeKeys[index])
  ) {
    errors.push(`runtime_support must contain exactly ${expectedRuntimeKeys.join(", ")}`);
  }
  if (!Array.isArray(record?.logical_assets) || record.logical_assets.length === 0) {
    errors.push("logical_assets must be a non-empty list");
    return errors;
  }
  for (const asset of record.logical_assets) {
    validateNonEmptyString(asset?.logical_id, "logical_assets[].logical_id", errors, "NIR001");
    validateNonEmptyString(asset?.asset_id, "logical_assets[].asset_id", errors, "NIR001");
    validateNonEmptyString(asset?.generator, "logical_assets[].generator", errors, "NIR001");
    if (!LOGICAL_ASSET_KINDS.includes(asset?.asset_kind)) {
      errors.push(`unsupported logical asset kind: ${asset?.asset_kind}`);
    }
    if (!INSTALL_SURFACES.includes(asset?.install_surface)) {
      errors.push(`unsupported install surface: ${asset?.install_surface}`);
    }
    if (!RUNTIME_SELECTORS.includes(asset?.runtime_selector)) {
      errors.push(`unsupported runtime selector: ${asset?.runtime_selector}`);
    }
    validateNonEmptyString(asset?.stable_sort_key, "logical_assets[].stable_sort_key", errors, "NIR001");
    validateNonEmptyString(asset?.sha256, "logical_assets[].sha256", errors, "NIR001");
    if (asset?.source_relpath !== null && typeof asset?.source_relpath !== "string") {
      errors.push("logical_assets[].source_relpath must be string or null");
    }
    if (asset?.generated_relpath !== null && typeof asset?.generated_relpath !== "string") {
      errors.push("logical_assets[].generated_relpath must be string or null");
    }
    if ("file_name" in (asset ?? {}) && asset?.file_name !== null && typeof asset?.file_name !== "string") {
      errors.push("logical_assets[].file_name must be string when present");
    }
    if (typeof asset?.content_type !== "string" || asset.content_type.trim() === "") {
      errors.push("logical_assets[].content_type must be a non-empty string");
    }
    if (typeof asset?.generated !== "boolean") {
      errors.push("logical_assets[].generated must be boolean");
    }
    if (typeof asset?.required !== "boolean") {
      errors.push("logical_assets[].required must be boolean");
    }
    if (typeof asset?.override_eligible !== "boolean") {
      errors.push("logical_assets[].override_eligible must be boolean");
    }
    if (!["pairslash", "user", "system"].includes(asset?.owner)) {
      errors.push(`unsupported logical_assets[].owner: ${asset?.owner}`);
    }
    if (!UNINSTALL_BEHAVIORS.includes(asset?.uninstall_behavior)) {
      errors.push(`unsupported logical_assets[].uninstall_behavior: ${asset?.uninstall_behavior}`);
    }
    if (typeof asset?.write_authority_guarded !== "boolean") {
      errors.push("logical_assets[].write_authority_guarded must be boolean");
    }
  }
  return errors;
}

export function validateCompiledPack(record) {
  const errors = [];
  if (record?.kind !== "compiled-pack") {
    errors.push("kind must be compiled-pack");
  }
  if (record?.schema_version !== COMPILED_PACK_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${COMPILED_PACK_SCHEMA_VERSION}`);
  }
  if (!SUPPORTED_RUNTIMES.includes(record?.runtime)) {
    errors.push(`unsupported runtime: ${record?.runtime}`);
  }
  if (!BUNDLE_KINDS.includes(record?.bundle_kind)) {
    errors.push(`unsupported bundle_kind: ${record?.bundle_kind}`);
  }
  validateNonEmptyString(record?.pack_id, "pack_id", errors, "CPK001");
  validateNonEmptyString(record?.digest, "digest", errors, "CPK001");
  validateNonEmptyString(record?.normalized_ir_digest, "normalized_ir_digest", errors, "CPK001");
  if (!Array.isArray(record?.files) || record.files.length === 0) {
    errors.push("files must be a non-empty list");
    return errors;
  }
  for (const file of record.files) {
    validateNonEmptyString(file?.asset_id, "files[].asset_id", errors, "CPK001");
    validateNonEmptyString(file?.generator, "files[].generator", errors, "CPK001");
    validateNonEmptyString(file?.relative_path, "files[].relative_path", errors, "CPK001");
    validateNonEmptyString(file?.sha256, "files[].sha256", errors, "CPK001");
    if (!LOGICAL_ASSET_KINDS.includes(file?.asset_kind)) {
      errors.push(`unsupported files[].asset_kind: ${file?.asset_kind}`);
    }
    if (!INSTALL_SURFACES.includes(file?.install_surface)) {
      errors.push(`unsupported files[].install_surface: ${file?.install_surface}`);
    }
    if (!RUNTIME_SELECTORS.includes(file?.runtime_selector)) {
      errors.push(`unsupported files[].runtime_selector: ${file?.runtime_selector}`);
    }
    if (typeof file?.generated !== "boolean") {
      errors.push("files[].generated must be boolean");
    }
    if (typeof file?.required !== "boolean") {
      errors.push("files[].required must be boolean");
    }
    if (typeof file?.override_eligible !== "boolean") {
      errors.push("files[].override_eligible must be boolean");
    }
    if (!["pairslash", "user", "system"].includes(file?.owner)) {
      errors.push(`unsupported files[].owner: ${file?.owner}`);
    }
    if (!UNINSTALL_BEHAVIORS.includes(file?.uninstall_behavior)) {
      errors.push(`unsupported files[].uninstall_behavior: ${file?.uninstall_behavior}`);
    }
    if (typeof file?.write_authority_guarded !== "boolean") {
      errors.push("files[].write_authority_guarded must be boolean");
    }
  }
  return errors;
}

function validateVersionPolicyDecision(value, field, errors) {
  if (!isObject(value)) {
    errors.push(`${field} must be an object`);
    return;
  }
  if (
    value?.status !== "install" &&
    value?.status !== "allowed" &&
    value?.status !== "warn" &&
    value?.status !== "blocked" &&
    value?.status !== "legacy"
  ) {
    errors.push(`${field}.status must be install, allowed, warn, blocked, or legacy`);
  }
  if (typeof value?.blocking !== "boolean") {
    errors.push(`${field}.blocking must be boolean`);
  }
  if (typeof value?.summary !== "string") {
    errors.push(`${field}.summary must be string`);
  }
  if (typeof value?.rule_id !== "string") {
    errors.push(`${field}.rule_id must be string`);
  }
}

function validateTrustReceipt(value, field, errors) {
  if (!isObject(value)) {
    errors.push(`${field} must be an object`);
    return;
  }
  if (value?.kind !== "trust-receipt") {
    errors.push(`${field}.kind must be trust-receipt`);
  }
  validateNonEmptyString(value?.pack_id, `${field}.pack_id`, errors, "TRU001");
  validateNonEmptyString(value?.version, `${field}.version`, errors, "TRU001");
  validateNonEmptyString(value?.manifest_digest, `${field}.manifest_digest`, errors, "TRU001");
  if (value?.compiled_digest !== null && typeof value?.compiled_digest !== "string") {
    errors.push(`${field}.compiled_digest must be string or null`);
  }
  if (!TRUST_SOURCE_CLASSES.includes(value?.source_class)) {
    errors.push(`${field}.source_class must be one of ${TRUST_SOURCE_CLASSES.join(", ")}`);
  }
  if (!TRUST_VERIFICATION_STATUSES.includes(value?.verification_status)) {
    errors.push(
      `${field}.verification_status must be one of ${TRUST_VERIFICATION_STATUSES.join(", ")}`,
    );
  }
  if (!TRUST_POLICY_ACTIONS.includes(value?.policy_action)) {
    errors.push(`${field}.policy_action must be one of ${TRUST_POLICY_ACTIONS.join(", ")}`);
  }
  if ("trust_tier" in value && !PACK_TRUST_TIERS.includes(value?.trust_tier)) {
    errors.push(`${field}.trust_tier must be one of ${PACK_TRUST_TIERS.join(", ")}`);
  }
  if ("tier_claim" in value && value?.tier_claim !== null && !PACK_TRUST_TIERS.includes(value?.tier_claim)) {
    errors.push(`${field}.tier_claim must be one of ${PACK_TRUST_TIERS.join(", ")} or null`);
  }
  if (value?.publisher !== null && typeof value?.publisher !== "string") {
    errors.push(`${field}.publisher must be string or null`);
  }
  if ("publisher_class" in value && value?.publisher_class !== null && !PACK_PUBLISHER_CLASSES.includes(value?.publisher_class)) {
    errors.push(
      `${field}.publisher_class must be one of ${PACK_PUBLISHER_CLASSES.join(", ")} or null`,
    );
  }
  if (value?.release_id !== null && typeof value?.release_id !== "string") {
    errors.push(`${field}.release_id must be string or null`);
  }
  if (value?.key_id !== null && typeof value?.key_id !== "string") {
    errors.push(`${field}.key_id must be string or null`);
  }
  if (value?.trust_bundle_dir !== null && typeof value?.trust_bundle_dir !== "string") {
    errors.push(`${field}.trust_bundle_dir must be string or null`);
  }
  if (value?.manifest_path !== null && typeof value?.manifest_path !== "string") {
    errors.push(`${field}.manifest_path must be string or null`);
  }
  if ("signature_status" in value && !PACK_SIGNATURE_STATUSES.includes(value?.signature_status)) {
    errors.push(
      `${field}.signature_status must be one of ${PACK_SIGNATURE_STATUSES.join(", ")}`,
    );
  }
  if ("support_level" in value && !PACK_SUPPORT_LEVELS.includes(value?.support_level)) {
    errors.push(`${field}.support_level must be one of ${PACK_SUPPORT_LEVELS.join(", ")}`);
  }
  if (
    "support_level_claim" in value &&
    value?.support_level_claim !== null &&
    !PACK_SUPPORT_LEVELS.includes(value?.support_level_claim)
  ) {
    errors.push(
      `${field}.support_level_claim must be one of ${PACK_SUPPORT_LEVELS.join(", ")} or null`,
    );
  }
  if ("descriptor_path" in value && value?.descriptor_path !== null && typeof value?.descriptor_path !== "string") {
    errors.push(`${field}.descriptor_path must be string or null`);
  }
  if ("descriptor_digest" in value && value?.descriptor_digest !== null && typeof value?.descriptor_digest !== "string") {
    errors.push(`${field}.descriptor_digest must be string or null`);
  }
  if ("runtime_support" in value) {
    if (!isObject(value?.runtime_support)) {
      errors.push(`${field}.runtime_support must be an object`);
    } else {
      if (value.runtime_support?.runtime !== null && typeof value.runtime_support?.runtime !== "string") {
        errors.push(`${field}.runtime_support.runtime must be string or null`);
      }
      for (const supportField of ["manifest_status", "declared_status", "resolved_status"]) {
        if (!PACK_RUNTIME_SUPPORT_STATUSES.includes(value.runtime_support?.[supportField])) {
          errors.push(
            `${field}.runtime_support.${supportField} must be one of ${PACK_RUNTIME_SUPPORT_STATUSES.join(", ")}`,
          );
        }
      }
      if (
        value.runtime_support?.evidence_ref !== null &&
        typeof value.runtime_support?.evidence_ref !== "string"
      ) {
        errors.push(`${field}.runtime_support.evidence_ref must be string or null`);
      }
      if (typeof value.runtime_support?.evidence_present !== "boolean") {
        errors.push(`${field}.runtime_support.evidence_present must be boolean`);
      }
      if (!TRUST_POLICY_ACTIONS.includes(value.runtime_support?.policy_action)) {
        errors.push(
          `${field}.runtime_support.policy_action must be one of ${TRUST_POLICY_ACTIONS.join(", ")}`,
        );
      }
      if (!Array.isArray(value.runtime_support?.reasons)) {
        errors.push(`${field}.runtime_support.reasons must be a list`);
      }
    }
  }
  if ("capabilities" in value) {
    if (!Array.isArray(value?.capabilities)) {
      errors.push(`${field}.capabilities must be a list`);
    } else {
      for (const capability of value.capabilities) {
        validateNonEmptyString(capability, `${field}.capabilities[]`, errors, "TRU001");
      }
    }
  }
  if ("memory_authority" in value) {
    if (!isObject(value?.memory_authority)) {
      errors.push(`${field}.memory_authority must be an object`);
    } else {
      if (!MEMORY_AUTHORITY_MODES.includes(value.memory_authority?.authority_mode)) {
        errors.push(
          `${field}.memory_authority.authority_mode must be one of ${MEMORY_AUTHORITY_MODES.join(", ")}`,
        );
      }
      if (!MEMORY_ACCESS_LEVELS.includes(value.memory_authority?.global_project_memory)) {
        errors.push(
          `${field}.memory_authority.global_project_memory must be one of ${MEMORY_ACCESS_LEVELS.join(", ")}`,
        );
      }
      if (typeof value.memory_authority?.explicit_write_only !== "boolean") {
        errors.push(`${field}.memory_authority.explicit_write_only must be boolean`);
      }
    }
  }
  if (!Array.isArray(value?.reasons)) {
    errors.push(`${field}.reasons must be a list`);
  } else {
    for (const reason of value.reasons) {
      validateNonEmptyString(reason, `${field}.reasons[]`, errors, "TRU001");
    }
  }
  validateNonEmptyString(value?.summary, `${field}.summary`, errors, "TRU001");
  validateVersionPolicyDecision(value?.version_policy, `${field}.version_policy`, errors);
}

function validateDescriptorRuntimeSupport(value, field, errors) {
  if (!validateObject(value, field, errors, "PTD001")) {
    return;
  }
  if (!PACK_RUNTIME_SUPPORT_STATUSES.includes(value?.status)) {
    errors.push(
      `${field}.status must be one of ${PACK_RUNTIME_SUPPORT_STATUSES.join(", ")}`,
    );
  }
  if (value?.evidence_ref !== null && typeof value?.evidence_ref !== "string") {
    errors.push(`${field}.evidence_ref must be string or null`);
  }
}

export function validatePackTrustDescriptor(record, { manifest = null } = {}) {
  const errors = [];
  if (record?.kind !== "pack-trust-descriptor") {
    errors.push("kind must be pack-trust-descriptor");
  }
  if (record?.schema_version !== PACK_TRUST_DESCRIPTOR_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${PACK_TRUST_DESCRIPTOR_SCHEMA_VERSION}`);
  }
  validateNonEmptyString(record?.pack_name, "pack_name", errors, "PTD001");
  validateNonEmptyString(record?.pack_version, "pack_version", errors, "PTD001");
  if (!validateObject(record?.publisher, "publisher", errors, "PTD001")) {
    return errors;
  }
  validateNonEmptyString(record.publisher?.publisher_id, "publisher.publisher_id", errors, "PTD001");
  validateNonEmptyString(record.publisher?.display_name, "publisher.display_name", errors, "PTD001");
  validateNonEmptyString(record.publisher?.contact, "publisher.contact", errors, "PTD001");
  if (!PACK_PUBLISHER_CLASSES.includes(record.publisher?.publisher_class)) {
    errors.push(
      `publisher.publisher_class must be one of ${PACK_PUBLISHER_CLASSES.join(", ")}`,
    );
  }
  if (!PACK_TRUST_TIERS.includes(record?.tier_claim)) {
    errors.push(`tier_claim must be one of ${PACK_TRUST_TIERS.join(", ")}`);
  }
  if (!PACK_SUPPORT_LEVELS.includes(record?.support_level_claim)) {
    errors.push(
      `support_level_claim must be one of ${PACK_SUPPORT_LEVELS.join(", ")}`,
    );
  }
  if (!validateObject(record?.signature, "signature", errors, "PTD001")) {
    return errors;
  }
  if (typeof record.signature?.required !== "boolean") {
    errors.push("signature.required must be boolean");
  }
  if (typeof record.signature?.allow_local_unsigned !== "boolean") {
    errors.push("signature.allow_local_unsigned must be boolean");
  }
  if (!validateObject(record?.runtime_support, "runtime_support", errors, "PTD001")) {
    return errors;
  }
  validateDescriptorRuntimeSupport(record.runtime_support?.codex_cli, "runtime_support.codex_cli", errors);
  validateDescriptorRuntimeSupport(record.runtime_support?.copilot_cli, "runtime_support.copilot_cli", errors);
  if (!validateObject(record?.policy_requirements, "policy_requirements", errors, "PTD001")) {
    return errors;
  }
  for (const field of [
    "no_silent_fallback",
    "preview_required_for_mutation",
    "explicit_write_only_memory",
  ]) {
    if (record.policy_requirements?.[field] !== true) {
      errors.push(`policy_requirements.${field} must be true`);
    }
  }
  if (manifest) {
    if (record.pack_name !== manifest.pack?.id) {
      errors.push(`pack_name must match manifest pack id ${manifest.pack?.id}`);
    }
    if (record.pack_version !== manifest.pack_version) {
      errors.push(`pack_version must match manifest pack_version ${manifest.pack_version}`);
    }
    if (
      manifest.memory_permissions?.global_project_memory === "write" &&
      record.tier_claim !== "core-maintained"
    ) {
      errors.push("memory-write packs must claim tier core-maintained");
    }
    if (record.publisher?.publisher_id === "pairslash") {
      if (record.tier_claim === "verified-external") {
        errors.push("pairslash publisher must not claim verified-external tier");
      }
      if (
        record.publisher?.publisher_class === "external" &&
        ["core-maintained", "first-party-official"].includes(record.tier_claim)
      ) {
        errors.push("pairslash publisher cannot use external publisher_class for first-party tiers");
      }
    } else if (
      ["core-maintained", "first-party-official"].includes(record.tier_claim)
    ) {
      errors.push("non-pairslash publishers cannot claim first-party tiers");
    }
    if (
      record.support_level_claim === "core-supported" &&
      record.tier_claim !== "core-maintained"
    ) {
      errors.push("core-supported support_level_claim requires tier_claim core-maintained");
    }
    if (
      record.support_level_claim === "publisher-verified" &&
      record.tier_claim !== "verified-external"
    ) {
      errors.push("publisher-verified support_level_claim requires tier_claim verified-external");
    }
  }
  return errors;
}

export function validateInstallState(record) {
  const errors = [];
  if (record?.kind !== "install-state") {
    errors.push("kind must be install-state");
  }
  if (record?.schema_version !== INSTALL_STATE_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${INSTALL_STATE_SCHEMA_VERSION}`);
  }
  if (!SUPPORTED_RUNTIMES.includes(record?.runtime)) {
    errors.push(`unsupported runtime: ${record?.runtime}`);
  }
  if (!SUPPORTED_TARGETS.includes(record?.target)) {
    errors.push(`unsupported target: ${record?.target}`);
  }
  if ("updated_at" in (record ?? {}) && typeof record?.updated_at !== "string" && record?.updated_at !== null) {
    errors.push("updated_at must be string or null");
  }
  if (
    "last_transaction_id" in (record ?? {}) &&
    typeof record?.last_transaction_id !== "string" &&
    record?.last_transaction_id !== null
  ) {
    errors.push("last_transaction_id must be string or null");
  }
  if (!Array.isArray(record?.packs)) {
    errors.push("packs must be a list");
    return errors;
  }
  for (const pack of record.packs) {
    validateNonEmptyString(pack?.id, "packs[].id", errors, "IST001");
    validateNonEmptyString(pack?.install_dir, "packs[].install_dir", errors, "IST001");
    if ("previous_version" in pack && typeof pack?.previous_version !== "string" && pack?.previous_version !== null) {
      errors.push("packs[].previous_version must be string or null");
    }
    if ("updated_at" in pack && typeof pack?.updated_at !== "string" && pack?.updated_at !== null) {
      errors.push("packs[].updated_at must be string or null");
    }
    if (!Array.isArray(pack?.files)) {
      errors.push("packs[].files must be a list");
      continue;
    }
    if ("trust_receipt" in pack && pack?.trust_receipt !== null) {
      validateTrustReceipt(pack.trust_receipt, "packs[].trust_receipt", errors);
    }
    for (const file of pack.files) {
      if ("asset_id" in file) {
        validateNonEmptyString(file?.asset_id, "packs[].files[].asset_id", errors, "IST001");
      }
      if ("generator" in file) {
        validateNonEmptyString(file?.generator, "packs[].files[].generator", errors, "IST001");
      }
      validateNonEmptyString(file?.relative_path, "packs[].files[].relative_path", errors, "IST001");
      validateNonEmptyString(file?.absolute_path, "packs[].files[].absolute_path", errors, "IST001");
      validateNonEmptyString(file?.source_digest, "packs[].files[].source_digest", errors, "IST001");
      validateNonEmptyString(file?.current_digest, "packs[].files[].current_digest", errors, "IST001");
      if (!LOGICAL_ASSET_KINDS.includes(file?.asset_kind)) {
        errors.push(`unsupported packs[].files[].asset_kind: ${file?.asset_kind}`);
      }
      if (!INSTALL_SURFACES.includes(file?.install_surface)) {
        errors.push(`unsupported packs[].files[].install_surface: ${file?.install_surface}`);
      }
      if (!RUNTIME_SELECTORS.includes(file?.runtime_selector)) {
        errors.push(`unsupported packs[].files[].runtime_selector: ${file?.runtime_selector}`);
      }
      if (typeof file?.generated !== "boolean") {
        errors.push("packs[].files[].generated must be boolean");
      }
      if (typeof file?.write_authority_guarded !== "boolean") {
        errors.push("packs[].files[].write_authority_guarded must be boolean");
      }
      if (typeof file?.owned_by_pairslash !== "boolean") {
        errors.push("packs[].files[].owned_by_pairslash must be boolean");
      }
      if ("management_mode" in file && !MANAGEMENT_MODES.includes(file?.management_mode)) {
        errors.push(`unsupported packs[].files[].management_mode: ${file?.management_mode}`);
      }
      if (typeof file?.override_eligible !== "boolean") {
        errors.push("packs[].files[].override_eligible must be boolean");
      }
      if ("required" in file && typeof file?.required !== "boolean") {
        errors.push("packs[].files[].required must be boolean when present");
      }
      if ("declared_owner" in file && !["pairslash", "user", "system"].includes(file?.declared_owner)) {
        errors.push(`unsupported packs[].files[].declared_owner: ${file?.declared_owner}`);
      }
      if ("uninstall_behavior" in file && !UNINSTALL_BEHAVIORS.includes(file?.uninstall_behavior)) {
        errors.push(`unsupported packs[].files[].uninstall_behavior: ${file?.uninstall_behavior}`);
      }
      if (typeof file?.local_override !== "boolean") {
        errors.push("packs[].files[].local_override must be boolean");
      }
      if (
        "reconciled_reason_code" in file &&
        file?.reconciled_reason_code !== null &&
        !LIFECYCLE_REASON_CODES.includes(file?.reconciled_reason_code)
      ) {
        errors.push(
          `unsupported packs[].files[].reconciled_reason_code: ${file?.reconciled_reason_code}`,
        );
      }
      if ("last_operation" in file && typeof file?.last_operation !== "string" && file?.last_operation !== null) {
        errors.push("packs[].files[].last_operation must be string or null");
      }
    }
  }
  return errors;
}

export function validatePreviewPlan(record) {
  const errors = [];
  if (record?.kind !== "preview-plan") {
    errors.push("kind must be preview-plan");
  }
  if (record?.schema_version !== PREVIEW_PLAN_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${PREVIEW_PLAN_SCHEMA_VERSION}`);
  }
  if (!["install", "update", "uninstall"].includes(record?.action)) {
    errors.push(`unsupported action: ${record?.action}`);
  }
  if (!SUPPORTED_RUNTIMES.includes(record?.runtime)) {
    errors.push(`unsupported runtime: ${record?.runtime}`);
  }
  if (!SUPPORTED_TARGETS.includes(record?.target)) {
    errors.push(`unsupported target: ${record?.target}`);
  }
  if (typeof record?.can_apply !== "boolean") {
    errors.push("can_apply must be boolean");
  }
  if (!Array.isArray(record?.selected_packs)) {
    errors.push("selected_packs must be a list");
  }
  if (!Array.isArray(record?.warnings)) {
    errors.push("warnings must be a list");
  }
  if (!Array.isArray(record?.errors)) {
    errors.push("errors must be a list");
  }
  if (typeof record?.requires_confirmation !== "boolean") {
    errors.push("requires_confirmation must be boolean");
  }
  if ("trust_delta" in record && record?.trust_delta !== null) {
    if (!isObject(record.trust_delta)) {
      errors.push("trust_delta must be an object");
    } else {
      if (typeof record.trust_delta.machine_readable !== "boolean") {
        errors.push("trust_delta.machine_readable must be boolean");
      }
      if (!["stable", "changed", "blocked"].includes(record.trust_delta.overall_status)) {
        errors.push("trust_delta.overall_status must be stable, changed, or blocked");
      }
      if (!Number.isInteger(record.trust_delta.blocking_count)) {
        errors.push("trust_delta.blocking_count must be an integer");
      }
      if (!Number.isInteger(record.trust_delta.changed_count)) {
        errors.push("trust_delta.changed_count must be an integer");
      }
      validateNonEmptyString(record.trust_delta.summary, "trust_delta.summary", errors, "PPL001");
      if (!Array.isArray(record.trust_delta.pack_changes)) {
        errors.push("trust_delta.pack_changes must be a list");
      } else {
        for (const change of record.trust_delta.pack_changes) {
          validateNonEmptyString(change?.pack_id, "trust_delta.pack_changes[].pack_id", errors, "PPL001");
          if (typeof change?.changed !== "boolean") {
            errors.push("trust_delta.pack_changes[].changed must be boolean");
          }
          if (typeof change?.blocking !== "boolean") {
            errors.push("trust_delta.pack_changes[].blocking must be boolean");
          }
          if (!Array.isArray(change?.reasons)) {
            errors.push("trust_delta.pack_changes[].reasons must be a list");
          }
          if ("capability_expansions" in change && !Array.isArray(change?.capability_expansions)) {
            errors.push("trust_delta.pack_changes[].capability_expansions must be a list when present");
          }
          if ("memory_escalated" in change && typeof change?.memory_escalated !== "boolean") {
            errors.push("trust_delta.pack_changes[].memory_escalated must be boolean when present");
          }
          if ("trust_downgrade" in change && typeof change?.trust_downgrade !== "boolean") {
            errors.push("trust_delta.pack_changes[].trust_downgrade must be boolean when present");
          }
        }
      }
    }
  }
  if ("reason_codes" in record) {
    validateLifecycleReasonCodes(record?.reason_codes, "reason_codes", errors, "PPL001");
  }
  if ("remediation_actions" in record) {
    validateRemediationActions(record?.remediation_actions, "remediation_actions", errors, "PPL001");
  }
  if (!Array.isArray(record?.operations)) {
    errors.push("operations must be a list");
    return errors;
  }
  for (const op of record.operations) {
    if (!PREVIEW_OPERATION_KINDS.includes(op?.kind)) {
      errors.push(`unsupported operation kind: ${op?.kind}`);
    }
    validateNonEmptyString(op?.pack_id, "operations[].pack_id", errors, "PPL001");
    validateNonEmptyString(op?.absolute_path, "operations[].absolute_path", errors, "PPL001");
    validateNonEmptyString(op?.reason, "operations[].reason", errors, "PPL001");
    if ("asset_kind" in op && !LOGICAL_ASSET_KINDS.includes(op?.asset_kind)) {
      errors.push(`unsupported operations[].asset_kind: ${op?.asset_kind}`);
    }
    if ("install_surface" in op && !INSTALL_SURFACES.includes(op?.install_surface)) {
      errors.push(`unsupported operations[].install_surface: ${op?.install_surface}`);
    }
    if ("ownership" in op && !["pairslash", "user", "unmanaged", "system"].includes(op?.ownership)) {
      errors.push(`unsupported operations[].ownership: ${op?.ownership}`);
    }
    if ("override_eligible" in op && typeof op?.override_eligible !== "boolean") {
      errors.push("operations[].override_eligible must be boolean");
    }
    if ("reason_code" in op && !LIFECYCLE_REASON_CODES.includes(op?.reason_code)) {
      errors.push(`unsupported operations[].reason_code: ${op?.reason_code}`);
    }
    if ("reason_detail" in op && op?.reason_detail !== null && typeof op?.reason_detail !== "string") {
      errors.push("operations[].reason_detail must be string or null");
    }
    if ("management_mode" in op && !MANAGEMENT_MODES.includes(op?.management_mode)) {
      errors.push(`unsupported operations[].management_mode: ${op?.management_mode}`);
    }
    if ("reconcile_mode" in op && !RECONCILE_MODES.includes(op?.reconcile_mode)) {
      errors.push(`unsupported operations[].reconcile_mode: ${op?.reconcile_mode}`);
    }
    if ("remediation_actions" in op) {
      validateRemediationActions(op?.remediation_actions, "operations[].remediation_actions", errors, "PPL001");
    }
  }
  if ("asset_diff" in record) {
    if (!isObject(record.asset_diff)) {
      errors.push("asset_diff must be an object");
    } else {
      for (const field of ["create_count", "update_count", "delete_count", "mutating_operation_count"]) {
        if (!Number.isInteger(record.asset_diff[field])) {
          errors.push(`asset_diff.${field} must be an integer`);
        }
      }
      if (!Array.isArray(record.asset_diff.runtime_targeted_outputs)) {
        errors.push("asset_diff.runtime_targeted_outputs must be a list");
      }
      if (!Array.isArray(record.asset_diff.config_fragments_affected)) {
        errors.push("asset_diff.config_fragments_affected must be a list");
      }
      if (!Array.isArray(record.asset_diff.risky_mutations)) {
        errors.push("asset_diff.risky_mutations must be a list");
      }
    }
  }
  if ("policy_summary" in record) {
    if (!isObject(record.policy_summary)) {
      errors.push("policy_summary must be an object");
    } else {
      if (!POLICY_DECISIONS.includes(record.policy_summary.overall_verdict)) {
        errors.push(`unsupported policy_summary.overall_verdict: ${record.policy_summary.overall_verdict}`);
      }
      if (typeof record.policy_summary.no_silent_fallback !== "boolean") {
        errors.push("policy_summary.no_silent_fallback must be boolean");
      }
      if (typeof record.policy_summary.unsupported_runtime_capability !== "boolean") {
        errors.push("policy_summary.unsupported_runtime_capability must be boolean");
      }
      if (!Array.isArray(record.policy_summary.pack_verdicts)) {
        errors.push("policy_summary.pack_verdicts must be a list");
      }
      if (!Array.isArray(record.policy_summary.reasons)) {
        errors.push("policy_summary.reasons must be a list");
      }
    }
  }
  if ("commitability" in record) {
    if (!isObject(record.commitability)) {
      errors.push("commitability must be an object");
    } else {
      if (!["proceedable", "needs-explicit-approval", "blocked"].includes(record.commitability.status)) {
        errors.push(`unsupported commitability.status: ${record.commitability.status}`);
      }
      if (typeof record.commitability.can_proceed !== "boolean") {
        errors.push("commitability.can_proceed must be boolean");
      }
      if (typeof record.commitability.blocked !== "boolean") {
        errors.push("commitability.blocked must be boolean");
      }
      if (typeof record.commitability.needs_explicit_approval !== "boolean") {
        errors.push("commitability.needs_explicit_approval must be boolean");
      }
      if (!Number.isInteger(record.commitability.blocked_operations_count)) {
        errors.push("commitability.blocked_operations_count must be integer");
      }
      if (!Array.isArray(record.commitability.can_proceed_operations)) {
        errors.push("commitability.can_proceed_operations must be a list");
      }
      if (!Array.isArray(record.commitability.blocked_reasons)) {
        errors.push("commitability.blocked_reasons must be a list");
      }
      if ("blocked_reason_codes" in record.commitability) {
        validateLifecycleReasonCodes(
          record.commitability.blocked_reason_codes,
          "commitability.blocked_reason_codes",
          errors,
          "PPL001",
        );
      }
      if ("explicit_approval_hint" in record.commitability) {
        if (record.commitability.explicit_approval_hint !== null && typeof record.commitability.explicit_approval_hint !== "string") {
          errors.push("commitability.explicit_approval_hint must be string or null");
        }
      }
    }
  }
  if ("preview_boundary" in record) {
    if (!isObject(record.preview_boundary)) {
      errors.push("preview_boundary must be an object");
    } else {
      if (typeof record.preview_boundary.preview_only !== "boolean") {
        errors.push("preview_boundary.preview_only must be boolean");
      }
      if (typeof record.preview_boundary.no_commit_on_preview !== "boolean") {
        errors.push("preview_boundary.no_commit_on_preview must be boolean");
      }
      if (typeof record.preview_boundary.commit_path !== "string") {
        errors.push("preview_boundary.commit_path must be string");
      }
      if (typeof record.preview_boundary.note !== "string") {
        errors.push("preview_boundary.note must be string");
      }
    }
  }
  return errors;
}

export function validateInstallJournal(record) {
  const errors = [];
  if (record?.kind !== "install-journal") {
    errors.push("kind must be install-journal");
  }
  if (record?.schema_version !== INSTALL_JOURNAL_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${INSTALL_JOURNAL_SCHEMA_VERSION}`);
  }
  if (!SUPPORTED_RUNTIMES.includes(record?.runtime)) {
    errors.push(`unsupported runtime: ${record?.runtime}`);
  }
  if (!SUPPORTED_TARGETS.includes(record?.target)) {
    errors.push(`unsupported target: ${record?.target}`);
  }
  if (!["install", "update", "uninstall"].includes(record?.action)) {
    errors.push(`unsupported action: ${record?.action}`);
  }
  if (!["pending", "committed", "rolled_back", "rollback_failed"].includes(record?.status)) {
    errors.push(`unsupported status: ${record?.status}`);
  }
  validateNonEmptyString(record?.transaction_id, "transaction_id", errors, "IJR001");
  validateNonEmptyString(record?.journal_path, "journal_path", errors, "IJR001");
  if (!Array.isArray(record?.steps)) {
    errors.push("steps must be a list");
    return errors;
  }
  for (const step of record.steps) {
    if (!["create", "replace", "remove", "write_state"].includes(step?.kind)) {
      errors.push(`unsupported steps[].kind: ${step?.kind}`);
    }
    validateNonEmptyString(step?.path, "steps[].path", errors, "IJR001");
    if ("created_by_transaction" in step && typeof step?.created_by_transaction !== "boolean") {
      errors.push("steps[].created_by_transaction must be boolean");
    }
  }
  return errors;
}

export function validateDoctorReport(record) {
  const errors = [];
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
      "install_root",
      "state_path",
    ]) {
      validateNonEmptyString(summary?.[field], `environment_summary.${field}`, errors, "DCR001");
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
      for (const field of ["config_home", "install_root", "state_path"]) {
        validateNonEmptyString(probe?.[field], `scope_probes.${target}.${field}`, errors, "DCR001");
      }
      for (const field of ["config_home_exists", "install_root_exists", "writable", "blocking_for_install"]) {
        if (typeof probe?.[field] !== "boolean") {
          errors.push(`scope_probes.${target}.${field} must be boolean`);
        }
      }
      if (!SUPPORT_VERDICTS.includes(probe?.verdict)) {
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

export function validateLintReport(record) {
  const errors = [];
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
