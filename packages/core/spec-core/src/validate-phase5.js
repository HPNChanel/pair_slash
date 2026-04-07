import {
  AUDIT_LOG_ENTRY_SCHEMA_VERSION,
  CANDIDATE_REPORT_SCHEMA_VERSION,
  CAPABILITY_FLAGS,
  CAPABILITY_NEGOTIATION_RESULTS,
  CONTRACT_ENVELOPE_SCHEMA_VERSION,
  CONTRACT_FAILURE_TYPES,
  CONTRACT_INPUT_MODES,
  CONTRACT_INPUT_SOURCES,
  CONTRACT_MEMORY_MODES,
  CONTRACT_MEMORY_TARGET_SCOPES,
  CONTRACT_OUTPUT_SHAPES,
  CONTRACT_RUNTIME_SCOPES,
  MEMORY_ACCESS_LEVELS,
  MEMORY_AUTHORITY_MODES,
  MEMORY_RECORD_ACTIONS,
  MEMORY_RECORD_CONFIDENCE,
  MEMORY_RECORD_KINDS,
  MEMORY_RECORD_SCOPES,
  MEMORY_REQUEST_SOURCES,
  MEMORY_APPROVAL_STATES,
  MEMORY_PIPELINE_STAGE_STATUSES,
  MEMORY_RECORD_LAYERS,
  MEMORY_WRITE_PREVIEW_SCHEMA_VERSION,
  MEMORY_WRITE_REQUEST_SCHEMA_VERSION,
  MEMORY_WRITE_RESULT_SCHEMA_VERSION,
  MEMORY_WRITE_STAGING_SCHEMA_VERSION,
  MEMORY_WRITE_STATUSES,
  POLICY_DECISIONS,
  POLICY_HOOK_SUPPORT_LEVELS,
  POLICY_PRIMARY_ENFORCEMENT_MODES,
  POLICY_REASON_AREAS,
  POLICY_RISK_CATEGORIES,
  POLICY_VERDICT_SCHEMA_VERSION,
  RISK_LEVELS,
  SESSION_ARTIFACT_LEVELS,
  SUPPORTED_RUNTIMES,
  SUPPORTED_TARGETS,
  TOOL_KINDS,
} from "./constants.js";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateNonEmptyString(value, field, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${field} must be a non-empty string`);
    return false;
  }
  return true;
}

function validateStringLength(value, field, errors, { min = null, max = null } = {}) {
  if (typeof value !== "string") {
    return;
  }
  if (min !== null && value.trim().length < min) {
    errors.push(`${field} must be at least ${min} characters`);
  }
  if (max !== null && value.trim().length > max) {
    errors.push(`${field} must be at most ${max} characters`);
  }
}

function validateStringArray(value, field, errors, { allowEmpty = true } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    errors.push(`${field} must be ${allowEmpty ? "a list" : "a non-empty list"}`);
    return [];
  }
  const seen = new Set();
  const entries = [];
  for (const item of value) {
    if (!validateNonEmptyString(item, `${field}[]`, errors)) {
      continue;
    }
    if (seen.has(item)) {
      errors.push(`${field} contains duplicate value ${item}`);
      continue;
    }
    seen.add(item);
    entries.push(item);
  }
  return entries;
}

function validateNonNegativeInteger(value, field, errors) {
  if (!Number.isInteger(value) || value < 0) {
    errors.push(`${field} must be a non-negative integer`);
  }
}

function validateRecordShape(record, errors, field = "record") {
  if (!isObject(record)) {
    errors.push(`${field} must be an object`);
    return;
  }
  if (!MEMORY_RECORD_KINDS.includes(record.kind)) {
    errors.push(`${field}.kind must be one of ${MEMORY_RECORD_KINDS.join(", ")}`);
  }
  validateNonEmptyString(record.title, `${field}.title`, errors);
  validateStringLength(record.title, `${field}.title`, errors, { min: 3, max: 200 });
  validateNonEmptyString(record.statement, `${field}.statement`, errors);
  validateStringLength(record.statement, `${field}.statement`, errors, { min: 10 });
  validateNonEmptyString(record.evidence, `${field}.evidence`, errors);
  validateStringLength(record.evidence, `${field}.evidence`, errors, { min: 5 });
  if (!MEMORY_RECORD_SCOPES.includes(record.scope)) {
    errors.push(`${field}.scope must be one of ${MEMORY_RECORD_SCOPES.join(", ")}`);
  }
  if (
    ["subsystem", "path-prefix"].includes(record.scope) &&
    !validateNonEmptyString(record.scope_detail, `${field}.scope_detail`, errors)
  ) {
    errors.push(`${field}.scope_detail is required for ${record.scope}`);
  }
  if (!MEMORY_RECORD_CONFIDENCE.includes(record.confidence)) {
    errors.push(`${field}.confidence must be one of ${MEMORY_RECORD_CONFIDENCE.join(", ")}`);
  }
  if (!MEMORY_RECORD_ACTIONS.includes(record.action)) {
    errors.push(`${field}.action must be one of ${MEMORY_RECORD_ACTIONS.join(", ")}`);
  }
  if (record.action === "supersede") {
    validateNonEmptyString(record.supersedes, `${field}.supersedes`, errors);
  }
  validateStringArray(record.tags ?? [], `${field}.tags`, errors);
  validateStringArray(record.source_refs ?? [], `${field}.source_refs`, errors);
  validateNonEmptyString(record.updated_by, `${field}.updated_by`, errors);
  validateNonEmptyString(record.timestamp, `${field}.timestamp`, errors);
}

function validatePipelineStage(record, errors, field = "pipeline_stages[]") {
  if (!isObject(record)) {
    errors.push(`${field} must be an object`);
    return;
  }
  validateNonEmptyString(record.name, `${field}.name`, errors);
  if (!MEMORY_PIPELINE_STAGE_STATUSES.includes(record.status)) {
    errors.push(`${field}.status must be one of ${MEMORY_PIPELINE_STAGE_STATUSES.join(", ")}`);
  }
  validateBoolean(record.blocking, `${field}.blocking`, errors);
  validateStringArray(record.notes ?? [], `${field}.notes`, errors);
}

function validateRelatedRecord(record, errors, field = "related_records[]") {
  if (!isObject(record)) {
    errors.push(`${field} must be an object`);
    return;
  }
  if (!MEMORY_RECORD_LAYERS.includes(record.layer)) {
    errors.push(`${field}.layer must be one of ${MEMORY_RECORD_LAYERS.join(", ")}`);
  }
  validateNonEmptyString(record.file, `${field}.file`, errors);
  validateNonEmptyString(record.kind, `${field}.kind`, errors);
  validateNonEmptyString(record.title, `${field}.title`, errors);
  validateNonEmptyString(record.scope, `${field}.scope`, errors);
  if ("scope_detail" in record && record.scope_detail !== null && typeof record.scope_detail !== "string") {
    errors.push(`${field}.scope_detail must be string or null`);
  }
  validateStringArray(record.reasons ?? [], `${field}.reasons`, errors);
  if ("statement" in record && record.statement !== null && typeof record.statement !== "string") {
    errors.push(`${field}.statement must be string or null`);
  }
  if ("artifact_path" in record && record.artifact_path !== null && typeof record.artifact_path !== "string") {
    errors.push(`${field}.artifact_path must be string or null`);
  }
}

function validateStagingArtifactRef(record, errors, field = "staging_artifact") {
  if (!isObject(record)) {
    errors.push(`${field} must be an object`);
    return;
  }
  validateNonEmptyString(record.artifact_id, `${field}.artifact_id`, errors);
  validateNonEmptyString(record.path, `${field}.path`, errors);
  validateNonEmptyString(record.request_key, `${field}.request_key`, errors);
  validateNonEmptyString(record.content_fingerprint, `${field}.content_fingerprint`, errors);
  validateBoolean(record.exists, `${field}.exists`, errors);
}

function validateApproval(record, errors, field = "approval") {
  if (!isObject(record)) {
    errors.push(`${field} must be an object`);
    return;
  }
  validateBoolean(record.required, `${field}.required`, errors);
  if (!MEMORY_APPROVAL_STATES.includes(record.state)) {
    errors.push(`${field}.state must be one of ${MEMORY_APPROVAL_STATES.join(", ")}`);
  }
  if ("confirmation_phrase" in record && record.confirmation_phrase !== null) {
    validateNonEmptyString(record.confirmation_phrase, `${field}.confirmation_phrase`, errors);
  }
}

function validateNegotiationEntry(entry, errors, field = "capability_scope.negotiation[]") {
  if (!isObject(entry)) {
    errors.push(`${field} must be an object`);
    return;
  }
  if (!CAPABILITY_FLAGS.includes(entry.capability)) {
    errors.push(`${field}.capability must be one of ${CAPABILITY_FLAGS.join(", ")}`);
  }
  if (!CAPABILITY_NEGOTIATION_RESULTS.includes(entry.status)) {
    errors.push(`${field}.status must be one of ${CAPABILITY_NEGOTIATION_RESULTS.join(", ")}`);
  }
  if ("reason" in entry && entry.reason !== null && typeof entry.reason !== "string") {
    errors.push(`${field}.reason must be string or null`);
  }
}

function validateRuntimeBoundary(boundary, errors, field = "runtime_boundary") {
  if (!isObject(boundary)) {
    errors.push(`${field} must be an object`);
    return;
  }
  if (!SUPPORTED_RUNTIMES.includes(boundary.adapter)) {
    errors.push(`${field}.adapter must be one of ${SUPPORTED_RUNTIMES.join(", ")}`);
  }
  validateNonEmptyString(boundary.enforcement_mode, `${field}.enforcement_mode`, errors);
  validateStringArray(boundary.differences ?? [], `${field}.differences`, errors);
}

function validateBoolean(value, field, errors) {
  if (typeof value !== "boolean") {
    errors.push(`${field} must be boolean`);
    return false;
  }
  return true;
}

function validateRiskEntry(entry, errors, field = "evaluated_risks[]") {
  if (!isObject(entry)) {
    errors.push(`${field} must be an object`);
    return;
  }
  if (!POLICY_RISK_CATEGORIES.includes(entry.category)) {
    errors.push(`${field}.category must be one of ${POLICY_RISK_CATEGORIES.join(", ")}`);
  }
  validateBoolean(entry.present, `${field}.present`, errors);
  validateStringArray(entry.sources ?? [], `${field}.sources`, errors, { allowEmpty: false });
  validateNonEmptyString(entry.rationale, `${field}.rationale`, errors);
}

function validatePolicyReason(reason, errors, field = "reasons[]") {
  if (!isObject(reason)) {
    errors.push(`${field} must be an object`);
    return;
  }
  validateNonEmptyString(reason.code, `${field}.code`, errors);
  if (!POLICY_DECISIONS.includes(reason.verdict)) {
    errors.push(`${field}.verdict must be one of ${POLICY_DECISIONS.join(", ")}`);
  }
  if (!POLICY_REASON_AREAS.includes(reason.policy_area)) {
    errors.push(`${field}.policy_area must be one of ${POLICY_REASON_AREAS.join(", ")}`);
  }
  validateStringArray(reason.related_risks ?? [], `${field}.related_risks`, errors);
  for (const riskCategory of reason.related_risks ?? []) {
    if (!POLICY_RISK_CATEGORIES.includes(riskCategory)) {
      errors.push(
        `${field}.related_risks contains unsupported value ${riskCategory} (supported: ${POLICY_RISK_CATEGORIES.join(", ")})`,
      );
    }
  }
  validateNonEmptyString(reason.message, `${field}.message`, errors);
  validateStringArray(reason.contract_fields ?? [], `${field}.contract_fields`, errors);
  validateStringArray(reason.runtime_factors ?? [], `${field}.runtime_factors`, errors);
}

function validateEnforcementContext(record, errors, field = "enforcement_context") {
  if (!isObject(record)) {
    errors.push(`${field} must be an object`);
    return;
  }
  if (!SUPPORTED_RUNTIMES.includes(record.runtime)) {
    errors.push(`${field}.runtime must be one of ${SUPPORTED_RUNTIMES.join(", ")}`);
  }
  if (!POLICY_PRIMARY_ENFORCEMENT_MODES.includes(record.primary_enforcement)) {
    errors.push(
      `${field}.primary_enforcement must be one of ${POLICY_PRIMARY_ENFORCEMENT_MODES.join(", ")}`,
    );
  }
  if (!POLICY_HOOK_SUPPORT_LEVELS.includes(record.hook_support)) {
    errors.push(`${field}.hook_support must be one of ${POLICY_HOOK_SUPPORT_LEVELS.join(", ")}`);
  }
  validateStringArray(record.supported_surfaces ?? [], `${field}.supported_surfaces`, errors);
  validateStringArray(record.surface_notes ?? [], `${field}.surface_notes`, errors);
  validateBoolean(record.no_silent_fallback, `${field}.no_silent_fallback`, errors);
}

function validateExplanation(record, errors, field = "explanation") {
  if (!isObject(record)) {
    errors.push(`${field} must be an object`);
    return;
  }
  validateNonEmptyString(record.summary, `${field}.summary`, errors);
  validateStringArray(record.decisive_reason_codes ?? [], `${field}.decisive_reason_codes`, errors);
  validateStringArray(
    record.decisive_contract_fields ?? [],
    `${field}.decisive_contract_fields`,
    errors,
  );
  validateStringArray(
    record.decisive_runtime_factors ?? [],
    `${field}.decisive_runtime_factors`,
    errors,
  );
  validateBoolean(record.no_silent_fallback, `${field}.no_silent_fallback`, errors);
}

function validateInputContract(inputContract, errors) {
  validateStringArray(inputContract.required_fields ?? [], "input_contract.required_fields", errors, {
    allowEmpty: false,
  });
  validateStringArray(inputContract.optional_fields ?? [], "input_contract.optional_fields", errors);
  const acceptedSources = validateStringArray(
    inputContract.accepted_sources ?? [],
    "input_contract.accepted_sources",
    errors,
    { allowEmpty: false },
  );
  for (const source of acceptedSources) {
    if (!CONTRACT_INPUT_SOURCES.includes(source)) {
      errors.push(
        `input_contract.accepted_sources contains unsupported source ${source} (supported: ${CONTRACT_INPUT_SOURCES.join(", ")})`,
      );
    }
  }
  const acceptedModes = validateStringArray(
    inputContract.accepted_modes ?? [],
    "input_contract.accepted_modes",
    errors,
    { allowEmpty: false },
  );
  for (const mode of acceptedModes) {
    if (!CONTRACT_INPUT_MODES.includes(mode)) {
      errors.push(
        `input_contract.accepted_modes contains unsupported mode ${mode} (supported: ${CONTRACT_INPUT_MODES.join(", ")})`,
      );
    }
  }
  if (!isObject(inputContract.validation_hints)) {
    errors.push("input_contract.validation_hints must be an object");
  } else {
    validateStringArray(
      inputContract.validation_hints.schema_refs ?? [],
      "input_contract.validation_hints.schema_refs",
      errors,
      { allowEmpty: false },
    );
    validateStringArray(
      inputContract.validation_hints.error_codes ?? [],
      "input_contract.validation_hints.error_codes",
      errors,
      { allowEmpty: false },
    );
    validateBoolean(
      inputContract.validation_hints.strict_required_fields,
      "input_contract.validation_hints.strict_required_fields",
      errors,
    );
    validateBoolean(
      inputContract.validation_hints.reject_unknown_fields,
      "input_contract.validation_hints.reject_unknown_fields",
      errors,
    );
  }
  if ("schema_refs" in inputContract) {
    validateStringArray(inputContract.schema_refs ?? [], "input_contract.schema_refs", errors);
  }
}

function validateOutputContract(outputContract, errors) {
  if (!CONTRACT_OUTPUT_SHAPES.includes(outputContract.output_shape)) {
    errors.push(`output_contract.output_shape must be one of ${CONTRACT_OUTPUT_SHAPES.join(", ")}`);
  }
  if (!Array.isArray(outputContract.structured_sections) || outputContract.structured_sections.length === 0) {
    errors.push("output_contract.structured_sections must be a non-empty list");
  } else {
    for (const section of outputContract.structured_sections) {
      if (!isObject(section)) {
        errors.push("output_contract.structured_sections[] must be an object");
        continue;
      }
      validateNonEmptyString(section.id, "output_contract.structured_sections[].id", errors);
      validateNonEmptyString(section.label, "output_contract.structured_sections[].label", errors);
      validateBoolean(section.required, "output_contract.structured_sections[].required", errors);
      validateBoolean(
        section.machine_readable,
        "output_contract.structured_sections[].machine_readable",
        errors,
      );
    }
  }
  validateStringArray(
    outputContract.machine_readable_fields ?? [],
    "output_contract.machine_readable_fields",
    errors,
  );
  if (!Array.isArray(outputContract.artifacts)) {
    errors.push("output_contract.artifacts must be a list");
  } else {
    for (const artifact of outputContract.artifacts) {
      if (!isObject(artifact)) {
        errors.push("output_contract.artifacts[] must be an object");
        continue;
      }
      validateNonEmptyString(artifact.id, "output_contract.artifacts[].id", errors);
      validateNonEmptyString(artifact.when, "output_contract.artifacts[].when", errors);
      if ("required" in artifact) {
        validateBoolean(artifact.required, "output_contract.artifacts[].required", errors);
      }
    }
  }
  if (!isObject(outputContract.allowed_side_effects_summary)) {
    errors.push("output_contract.allowed_side_effects_summary must be an object");
  } else {
    if (!CONTRACT_MEMORY_MODES.includes(outputContract.allowed_side_effects_summary.memory)) {
      errors.push(
        `output_contract.allowed_side_effects_summary.memory must be one of ${CONTRACT_MEMORY_MODES.join(", ")}`,
      );
    }
    validateBoolean(
      outputContract.allowed_side_effects_summary.network_allowed,
      "output_contract.allowed_side_effects_summary.network_allowed",
      errors,
    );
    validateBoolean(
      outputContract.allowed_side_effects_summary.destructive_allowed,
      "output_contract.allowed_side_effects_summary.destructive_allowed",
      errors,
    );
    validateBoolean(
      outputContract.allowed_side_effects_summary.secret_touching_allowed,
      "output_contract.allowed_side_effects_summary.secret_touching_allowed",
      errors,
    );
    validateBoolean(
      outputContract.allowed_side_effects_summary.preview_required,
      "output_contract.allowed_side_effects_summary.preview_required",
      errors,
    );
    validateBoolean(
      outputContract.allowed_side_effects_summary.explicit_approval_required,
      "output_contract.allowed_side_effects_summary.explicit_approval_required",
      errors,
    );
    validateStringArray(
      outputContract.allowed_side_effects_summary.filesystem_write_paths ?? [],
      "output_contract.allowed_side_effects_summary.filesystem_write_paths",
      errors,
    );
  }
}

function validateFailureContract(failureContract, errors) {
  if (typeof failureContract.no_silent_fallback !== "boolean") {
    errors.push("failure_contract.no_silent_fallback must be boolean");
  }
  if (!Array.isArray(failureContract.categories) || failureContract.categories.length === 0) {
    errors.push("failure_contract.categories must be a non-empty list");
  } else {
    for (const category of failureContract.categories) {
      if (!isObject(category)) {
        errors.push("failure_contract.categories[] must be an object");
        continue;
      }
      validateNonEmptyString(category.code, "failure_contract.categories[].code", errors);
      if (!CONTRACT_FAILURE_TYPES.includes(category.type)) {
        errors.push(
          `failure_contract.categories[].type must be one of ${CONTRACT_FAILURE_TYPES.join(", ")}`,
        );
      }
      validateBoolean(category.retryable, "failure_contract.categories[].retryable", errors);
      validateNonEmptyString(
        category.description,
        "failure_contract.categories[].description",
        errors,
      );
    }
  }
  const failureCodes = validateStringArray(
    failureContract.codes ?? [],
    "failure_contract.codes",
    errors,
    { allowEmpty: false },
  );
  const categoryCodes = new Set((failureContract.categories ?? []).map((entry) => entry?.code).filter(Boolean));
  for (const code of failureCodes) {
    if (!categoryCodes.has(code)) {
      errors.push(`failure_contract.codes contains ${code} but no matching categories entry`);
    }
  }
}

function validateMemoryContract(memoryContract, workflowClass, errors) {
  if (!CONTRACT_MEMORY_MODES.includes(memoryContract.mode)) {
    errors.push(`memory_contract.mode must be one of ${CONTRACT_MEMORY_MODES.join(", ")}`);
  }
  if (!CONTRACT_MEMORY_TARGET_SCOPES.includes(memoryContract.target_scope)) {
    errors.push(
      `memory_contract.target_scope must be one of ${CONTRACT_MEMORY_TARGET_SCOPES.join(", ")}`,
    );
  }
  validateBoolean(
    memoryContract.authoritative_write_allowed,
    "memory_contract.authoritative_write_allowed",
    errors,
  );
  validateBoolean(memoryContract.preview_required, "memory_contract.preview_required", errors);
  if (!MEMORY_AUTHORITY_MODES.includes(memoryContract.authority_mode)) {
    errors.push(`memory_contract.authority_mode must be one of ${MEMORY_AUTHORITY_MODES.join(", ")}`);
  }
  if (!MEMORY_ACCESS_LEVELS.includes(memoryContract.global_project_memory)) {
    errors.push(
      `memory_contract.global_project_memory must be one of ${MEMORY_ACCESS_LEVELS.join(", ")}`,
    );
  }
  if (!MEMORY_ACCESS_LEVELS.includes(memoryContract.task_memory)) {
    errors.push(`memory_contract.task_memory must be one of ${MEMORY_ACCESS_LEVELS.join(", ")}`);
  }
  if (!SESSION_ARTIFACT_LEVELS.includes(memoryContract.session_artifacts)) {
    errors.push(
      `memory_contract.session_artifacts must be one of ${SESSION_ARTIFACT_LEVELS.join(", ")}`,
    );
  }
  validateBoolean(memoryContract.explicit_write_only, "memory_contract.explicit_write_only", errors);
  validateBoolean(memoryContract.no_hidden_write, "memory_contract.no_hidden_write", errors);
  validateStringArray(memoryContract.read_paths ?? [], "memory_contract.read_paths", errors);
  validateStringArray(memoryContract.write_paths ?? [], "memory_contract.write_paths", errors);
  validateStringArray(memoryContract.promote_paths ?? [], "memory_contract.promote_paths", errors);

  if (workflowClass === "read-oriented" && memoryContract.authoritative_write_allowed) {
    errors.push("read-oriented workflow cannot declare authoritative memory write");
  }
  if (memoryContract.mode === "write" && memoryContract.authoritative_write_allowed !== true) {
    errors.push("memory_contract.mode=write requires authoritative_write_allowed=true");
  }
  if (memoryContract.authoritative_write_allowed && memoryContract.preview_required !== true) {
    errors.push("authoritative memory write requires preview_required=true");
  }
}

function validateToolShape(tool, field, errors) {
  if (!isObject(tool)) {
    errors.push(`${field} must be an object`);
    return;
  }
  validateNonEmptyString(tool.id, `${field}.id`, errors);
  if (!TOOL_KINDS.includes(tool.kind)) {
    errors.push(`${field}.kind must be one of ${TOOL_KINDS.join(", ")}`);
  }
  validateNonEmptyString(tool.check_command, `${field}.check_command`, errors);
}

function validateToolContract(toolContract, errors) {
  validateStringArray(toolContract.tools_allowed ?? [], "tool_contract.tools_allowed", errors);
  if (!Array.isArray(toolContract.tools_required)) {
    errors.push("tool_contract.tools_required must be a list");
  } else {
    for (const tool of toolContract.tools_required) {
      validateToolShape(tool, "tool_contract.tools_required[]", errors);
    }
  }
  if ("required_tools" in toolContract) {
    if (!Array.isArray(toolContract.required_tools)) {
      errors.push("tool_contract.required_tools must be a list");
    } else {
      for (const tool of toolContract.required_tools) {
        validateToolShape(tool, "tool_contract.required_tools[]", errors);
      }
    }
  }
  validateStringArray(toolContract.required_mcp_servers ?? [], "tool_contract.required_mcp_servers", errors);
  validateBoolean(toolContract.network_allowance, "tool_contract.network_allowance", errors);
  validateBoolean(toolContract.destructive_allowance, "tool_contract.destructive_allowance", errors);
  validateBoolean(toolContract.secret_touching_allowance, "tool_contract.secret_touching_allowance", errors);
}

function validateCapabilityScope(capabilityScope, errors) {
  if (!CONTRACT_RUNTIME_SCOPES.includes(capabilityScope.runtime_scope)) {
    errors.push(
      `capability_scope.runtime_scope must be one of ${CONTRACT_RUNTIME_SCOPES.join(", ")}`,
    );
  }
  const requested = validateStringArray(
    capabilityScope.requested ?? [],
    "capability_scope.requested",
    errors,
  );
  const granted = validateStringArray(
    capabilityScope.granted ?? [],
    "capability_scope.granted",
    errors,
  );
  for (const capability of [...requested, ...granted]) {
    if (!CAPABILITY_FLAGS.includes(capability)) {
      errors.push(`unsupported capability in capability_scope: ${capability}`);
    }
  }
  if (!Array.isArray(capabilityScope.negotiation)) {
    errors.push("capability_scope.negotiation must be a list");
  } else {
    for (const entry of capabilityScope.negotiation) {
      validateNegotiationEntry(entry, errors);
    }
  }
  validateStringArray(
    capabilityScope.degraded_behavior_notes ?? [],
    "capability_scope.degraded_behavior_notes",
    errors,
  );
}

export function validateContractEnvelope(record) {
  const errors = [];
  if (record?.kind !== "contract-envelope") {
    errors.push("kind must be contract-envelope");
  }
  if (record?.schema_version !== CONTRACT_ENVELOPE_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${CONTRACT_ENVELOPE_SCHEMA_VERSION}`);
  }
  validateNonEmptyString(record?.contract_id, "contract_id", errors);
  if (!SUPPORTED_RUNTIMES.includes(record?.runtime)) {
    errors.push(`runtime must be one of ${SUPPORTED_RUNTIMES.join(", ")}`);
  }
  if (!SUPPORTED_TARGETS.includes(record?.target)) {
    errors.push(`target must be one of ${SUPPORTED_TARGETS.join(", ")}`);
  }
  if (record?.canonical_entrypoint !== "/skills") {
    errors.push("canonical_entrypoint must be /skills");
  }
  if (!["read-oriented", "dual-mode", "write-authority"].includes(record?.workflow_class)) {
    errors.push("workflow_class must be read-oriented, dual-mode, or write-authority");
  }
  if (!RISK_LEVELS.includes(record?.risk_level)) {
    errors.push(`risk_level must be one of ${RISK_LEVELS.join(", ")}`);
  }
  if (!isObject(record?.source)) {
    errors.push("source must be an object");
  } else {
    if (!["manifest", "workflow", "api", "lint", "preview"].includes(record.source.type)) {
      errors.push("source.type must be manifest, workflow, api, lint, or preview");
    }
    if (record.source.pack_id !== null && typeof record.source.pack_id !== "string") {
      errors.push("source.pack_id must be string or null");
    }
    if ("manifest_path" in record.source && record.source.manifest_path !== null) {
      validateNonEmptyString(record.source.manifest_path, "source.manifest_path", errors);
    }
  }
  for (const [field, value] of Object.entries({
    input_contract: record?.input_contract,
    output_contract: record?.output_contract,
    failure_contract: record?.failure_contract,
    memory_contract: record?.memory_contract,
    tool_contract: record?.tool_contract,
    capability_scope: record?.capability_scope,
  })) {
    if (!isObject(value)) {
      errors.push(`${field} must be an object`);
    }
  }
  if (isObject(record?.input_contract)) {
    validateInputContract(record.input_contract, errors);
  }
  if (isObject(record?.output_contract)) {
    validateOutputContract(record.output_contract, errors);
  }
  if (isObject(record?.failure_contract)) {
    validateFailureContract(record.failure_contract, errors);
  }
  if (isObject(record?.memory_contract)) {
    validateMemoryContract(record.memory_contract, record.workflow_class, errors);
  }
  if (isObject(record?.tool_contract)) {
    validateToolContract(record.tool_contract, errors);
  }
  if (isObject(record?.capability_scope)) {
    validateCapabilityScope(record.capability_scope, errors);
    if (record.capability_scope.runtime_scope === "codex-only" && record.runtime !== "codex_cli") {
      errors.push("runtime/capability_scope.runtime_scope mismatch for codex-only contract");
    }
    if (record.capability_scope.runtime_scope === "copilot-only" && record.runtime !== "copilot_cli") {
      errors.push("runtime/capability_scope.runtime_scope mismatch for copilot-only contract");
    }
  }
  validateRuntimeBoundary(record?.runtime_boundary, errors);
  return errors;
}

export function validatePolicyVerdict(record) {
  const errors = [];
  if (record?.kind !== "policy-verdict") {
    errors.push("kind must be policy-verdict");
  }
  if (record?.schema_version !== POLICY_VERDICT_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${POLICY_VERDICT_SCHEMA_VERSION}`);
  }
  if ("contract_id" in (record ?? {}) && record?.contract_id !== null && typeof record?.contract_id !== "string") {
    errors.push("contract_id must be string or null");
  }
  if (!SUPPORTED_RUNTIMES.includes(record?.runtime)) {
    errors.push(`runtime must be one of ${SUPPORTED_RUNTIMES.join(", ")}`);
  }
  if (!SUPPORTED_TARGETS.includes(record?.target)) {
    errors.push(`target must be one of ${SUPPORTED_TARGETS.join(", ")}`);
  }
  validateNonEmptyString(record?.action, "action", errors);
  if (!POLICY_DECISIONS.includes(record?.overall_verdict)) {
    errors.push(`overall_verdict must be one of ${POLICY_DECISIONS.join(", ")}`);
  }
  if (typeof record?.machine_readable !== "boolean") {
    errors.push("machine_readable must be boolean");
  }
  if (typeof record?.preview_required !== "boolean") {
    errors.push("preview_required must be boolean");
  }
  if (typeof record?.approval_required !== "boolean") {
    errors.push("approval_required must be boolean");
  }
  validateStringArray(record?.allowed_operations ?? [], "allowed_operations", errors);
  validateStringArray(record?.blocked_operations ?? [], "blocked_operations", errors);
  if (!Array.isArray(record?.evaluated_risks)) {
    errors.push("evaluated_risks must be a list");
  } else {
    for (const risk of record.evaluated_risks) {
      validateRiskEntry(risk, errors);
    }
  }
  if (!Array.isArray(record?.reasons)) {
    errors.push("reasons must be a list");
  } else {
    for (const reason of record.reasons) {
      validatePolicyReason(reason, errors);
    }
  }
  if (!Array.isArray(record?.capability_negotiation)) {
    errors.push("capability_negotiation must be a list");
  } else {
    for (const entry of record.capability_negotiation) {
      validateNegotiationEntry(entry, errors, "capability_negotiation[]");
    }
  }
  validateEnforcementContext(record?.enforcement_context, errors);
  validateRuntimeBoundary(record?.runtime_boundary, errors);
  validateExplanation(record?.explanation, errors);
  return errors;
}

export function validateMemoryWriteRequest(record) {
  const errors = [];
  if (record?.kind !== "memory-write-request") {
    errors.push("kind must be memory-write-request");
  }
  if (record?.schema_version !== MEMORY_WRITE_REQUEST_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${MEMORY_WRITE_REQUEST_SCHEMA_VERSION}`);
  }
  if (!SUPPORTED_RUNTIMES.includes(record?.runtime)) {
    errors.push(`runtime must be one of ${SUPPORTED_RUNTIMES.join(", ")}`);
  }
  if (!SUPPORTED_TARGETS.includes(record?.target)) {
    errors.push(`target must be one of ${SUPPORTED_TARGETS.join(", ")}`);
  }
  if (!MEMORY_REQUEST_SOURCES.includes(record?.request_source)) {
    errors.push(`request_source must be one of ${MEMORY_REQUEST_SOURCES.join(", ")}`);
  }
  validateRecordShape(record?.record, errors);
  return errors;
}

export function validateMemoryWritePreview(record) {
  const errors = [];
  if (record?.kind !== "memory-write-preview") {
    errors.push("kind must be memory-write-preview");
  }
  if (record?.schema_version !== MEMORY_WRITE_PREVIEW_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${MEMORY_WRITE_PREVIEW_SCHEMA_VERSION}`);
  }
  if (!SUPPORTED_RUNTIMES.includes(record?.runtime)) {
    errors.push(`runtime must be one of ${SUPPORTED_RUNTIMES.join(", ")}`);
  }
  if (!SUPPORTED_TARGETS.includes(record?.target)) {
    errors.push(`target must be one of ${SUPPORTED_TARGETS.join(", ")}`);
  }
  if (typeof record?.ready_for_apply !== "boolean") {
    errors.push("ready_for_apply must be boolean");
  }
  if (typeof record?.requires_confirmation !== "boolean") {
    errors.push("requires_confirmation must be boolean");
  }
  if (!isObject(record?.request)) {
    errors.push("request must be an object");
  } else {
    errors.push(...validateMemoryWriteRequest(record.request).map((message) => `request.${message}`));
  }
  errors.push(...validatePolicyVerdict(record?.policy_verdict).map((message) => `policy_verdict.${message}`));
  if (!isObject(record?.preview_patch)) {
    errors.push("preview_patch must be an object");
  } else {
    if (record.preview_patch.target_file !== null) {
      validateNonEmptyString(record.preview_patch.target_file, "preview_patch.target_file", errors);
    }
    if (!MEMORY_RECORD_ACTIONS.includes(record.preview_patch.action)) {
      errors.push(`preview_patch.action must be one of ${MEMORY_RECORD_ACTIONS.join(", ")}`);
    }
    if (!isObject(record.preview_patch.content)) {
      errors.push("preview_patch.content must be an object");
    }
    if (typeof record.preview_patch.text !== "string") {
      errors.push("preview_patch.text must be string");
    }
  }
  if (!Array.isArray(record?.pipeline_stages) || record.pipeline_stages.length === 0) {
    errors.push("pipeline_stages must be a non-empty list");
  } else {
    for (const stage of record.pipeline_stages) {
      validatePipelineStage(stage, errors);
    }
  }
  if (!Array.isArray(record?.related_records)) {
    errors.push("related_records must be a list");
  } else {
    for (const entry of record.related_records) {
      validateRelatedRecord(entry, errors);
    }
  }
  if (!Array.isArray(record?.duplicate_matches)) {
    errors.push("duplicate_matches must be a list");
  } else {
    for (const entry of record.duplicate_matches) {
      validateRelatedRecord(entry, errors, "duplicate_matches[]");
    }
  }
  if (!Array.isArray(record?.conflict_matches)) {
    errors.push("conflict_matches must be a list");
  } else {
    for (const entry of record.conflict_matches) {
      validateRelatedRecord(entry, errors, "conflict_matches[]");
    }
  }
  validateStringArray(record?.scope_warnings ?? [], "scope_warnings", errors);
  if (!MEMORY_RECORD_ACTIONS.includes(record?.record_disposition)) {
    errors.push(`record_disposition must be one of ${MEMORY_RECORD_ACTIONS.join(", ")}`);
  }
  validateStagingArtifactRef(record?.staging_artifact, errors);
  validateApproval(record?.approval, errors);
  validateStringArray(record?.warnings ?? [], "warnings", errors);
  validateStringArray(record?.errors ?? [], "errors", errors);
  return errors;
}

export function validateMemoryWriteResult(record) {
  const errors = [];
  if (record?.kind !== "memory-write-result") {
    errors.push("kind must be memory-write-result");
  }
  if (record?.schema_version !== MEMORY_WRITE_RESULT_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${MEMORY_WRITE_RESULT_SCHEMA_VERSION}`);
  }
  if (!MEMORY_WRITE_STATUSES.includes(record?.status)) {
    errors.push(`status must be one of ${MEMORY_WRITE_STATUSES.join(", ")}`);
  }
  if (!SUPPORTED_RUNTIMES.includes(record?.runtime)) {
    errors.push(`runtime must be one of ${SUPPORTED_RUNTIMES.join(", ")}`);
  }
  if (!SUPPORTED_TARGETS.includes(record?.target)) {
    errors.push(`target must be one of ${SUPPORTED_TARGETS.join(", ")}`);
  }
  if (typeof record?.committed !== "boolean") {
    errors.push("committed must be boolean");
  }
  if (!isObject(record?.request)) {
    errors.push("request must be an object");
  } else {
    errors.push(...validateMemoryWriteRequest(record.request).map((message) => `request.${message}`));
  }
  errors.push(...validatePolicyVerdict(record?.policy_verdict).map((message) => `policy_verdict.${message}`));
  if (record?.target_file !== null && typeof record?.target_file !== "string") {
    errors.push("target_file must be string or null");
  }
  if (record?.audit_log_path !== null && typeof record?.audit_log_path !== "string") {
    errors.push("audit_log_path must be string or null");
  }
  if (typeof record?.index_updated !== "boolean") {
    errors.push("index_updated must be boolean");
  }
  if (!Array.isArray(record?.pipeline_stages) || record.pipeline_stages.length === 0) {
    errors.push("pipeline_stages must be a non-empty list");
  } else {
    for (const stage of record.pipeline_stages) {
      validatePipelineStage(stage, errors);
    }
  }
  if (!Array.isArray(record?.related_records)) {
    errors.push("related_records must be a list");
  } else {
    for (const entry of record.related_records) {
      validateRelatedRecord(entry, errors);
    }
  }
  if (!Array.isArray(record?.duplicate_matches)) {
    errors.push("duplicate_matches must be a list");
  } else {
    for (const entry of record.duplicate_matches) {
      validateRelatedRecord(entry, errors, "duplicate_matches[]");
    }
  }
  if (!Array.isArray(record?.conflict_matches)) {
    errors.push("conflict_matches must be a list");
  } else {
    for (const entry of record.conflict_matches) {
      validateRelatedRecord(entry, errors, "conflict_matches[]");
    }
  }
  validateStringArray(record?.scope_warnings ?? [], "scope_warnings", errors);
  if (!MEMORY_RECORD_ACTIONS.includes(record?.record_disposition)) {
    errors.push(`record_disposition must be one of ${MEMORY_RECORD_ACTIONS.join(", ")}`);
  }
  validateStagingArtifactRef(record?.staging_artifact, errors);
  validateApproval(record?.approval, errors);
  validateStringArray(record?.warnings ?? [], "warnings", errors);
  validateStringArray(record?.errors ?? [], "errors", errors);
  return errors;
}

export function validateMemoryWriteStagingArtifact(record) {
  const errors = [];
  if (record?.kind !== "memory-write-staging-artifact") {
    errors.push("kind must be memory-write-staging-artifact");
  }
  if (record?.schema_version !== MEMORY_WRITE_STAGING_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${MEMORY_WRITE_STAGING_SCHEMA_VERSION}`);
  }
  if (!SUPPORTED_RUNTIMES.includes(record?.runtime)) {
    errors.push(`runtime must be one of ${SUPPORTED_RUNTIMES.join(", ")}`);
  }
  if (!SUPPORTED_TARGETS.includes(record?.target)) {
    errors.push(`target must be one of ${SUPPORTED_TARGETS.join(", ")}`);
  }
  validateNonEmptyString(record?.artifact_id, "artifact_id", errors);
  validateNonEmptyString(record?.request_key, "request_key", errors);
  validateNonEmptyString(record?.content_fingerprint, "content_fingerprint", errors);
  validateNonEmptyString(record?.path, "path", errors);
  if (!isObject(record?.request)) {
    errors.push("request must be an object");
  } else {
    errors.push(...validateMemoryWriteRequest(record.request).map((message) => `request.${message}`));
  }
  if (!isObject(record?.preview_patch)) {
    errors.push("preview_patch must be an object");
  }
  if (!Array.isArray(record?.pipeline_stages) || record.pipeline_stages.length === 0) {
    errors.push("pipeline_stages must be a non-empty list");
  } else {
    for (const stage of record.pipeline_stages) {
      validatePipelineStage(stage, errors);
    }
  }
  if (!Array.isArray(record?.related_records)) {
    errors.push("related_records must be a list");
  } else {
    for (const entry of record.related_records) {
      validateRelatedRecord(entry, errors);
    }
  }
  if (!Array.isArray(record?.duplicate_matches)) {
    errors.push("duplicate_matches must be a list");
  } else {
    for (const entry of record.duplicate_matches) {
      validateRelatedRecord(entry, errors, "duplicate_matches[]");
    }
  }
  if (!Array.isArray(record?.conflict_matches)) {
    errors.push("conflict_matches must be a list");
  } else {
    for (const entry of record.conflict_matches) {
      validateRelatedRecord(entry, errors, "conflict_matches[]");
    }
  }
  validateStringArray(record?.scope_warnings ?? [], "scope_warnings", errors);
  if (!MEMORY_RECORD_ACTIONS.includes(record?.record_disposition)) {
    errors.push(`record_disposition must be one of ${MEMORY_RECORD_ACTIONS.join(", ")}`);
  }
  validateApproval(record?.approval, errors);
  errors.push(...validatePolicyVerdict(record?.policy_verdict).map((message) => `policy_verdict.${message}`));
  if (typeof record?.ready_for_apply !== "boolean") {
    errors.push("ready_for_apply must be boolean");
  }
  validateStringArray(record?.warnings ?? [], "warnings", errors);
  validateStringArray(record?.errors ?? [], "errors", errors);
  return errors;
}

export function validateAuditLogEntry(record) {
  const errors = [];
  if (record?.schema_version !== AUDIT_LOG_ENTRY_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${AUDIT_LOG_ENTRY_SCHEMA_VERSION}`);
  }
  validateNonEmptyString(record?.timestamp, "timestamp", errors);
  if (!MEMORY_RECORD_ACTIONS.includes(record?.action)) {
    errors.push(`action must be one of ${MEMORY_RECORD_ACTIONS.join(", ")}`);
  }
  if (!MEMORY_RECORD_KINDS.includes(record?.kind)) {
    errors.push(`kind must be one of ${MEMORY_RECORD_KINDS.join(", ")}`);
  }
  validateNonEmptyString(record?.title, "title", errors);
  validateStringLength(record?.title, "title", errors, { min: 3, max: 200 });
  validateNonEmptyString(record?.target_file, "target_file", errors);
  validateNonEmptyString(record?.updated_by, "updated_by", errors);
  if (!MEMORY_RECORD_CONFIDENCE.includes(record?.confidence)) {
    errors.push(`confidence must be one of ${MEMORY_RECORD_CONFIDENCE.join(", ")}`);
  }
  if (!["success", "rejected", "conflict", "failed"].includes(record?.result)) {
    errors.push("result must be one of success, rejected, conflict, failed");
  }
  if ("approval" in (record ?? {}) && !MEMORY_APPROVAL_STATES.includes(record?.approval)) {
    errors.push(`approval must be one of ${MEMORY_APPROVAL_STATES.join(", ")}`);
  }
  if ("duplicate_count" in (record ?? {})) {
    validateNonNegativeInteger(record?.duplicate_count, "duplicate_count", errors);
  }
  if ("conflict_count" in (record ?? {})) {
    validateNonNegativeInteger(record?.conflict_count, "conflict_count", errors);
  }
  if ("related_layers" in (record ?? {})) {
    const layers = validateStringArray(record?.related_layers, "related_layers", errors);
    for (const layer of layers) {
      if (!MEMORY_RECORD_LAYERS.includes(layer)) {
        errors.push(`related_layers contains unsupported layer ${layer}`);
      }
    }
  }
  if ("preview_artifact" in (record ?? {})) {
    validateNonEmptyString(record?.preview_artifact, "preview_artifact", errors);
  }
  if ("notes" in (record ?? {}) && typeof record?.notes !== "string") {
    errors.push("notes must be string");
  }
  return errors;
}

export function validateCandidateReport(record) {
  const errors = [];
  if (record?.kind !== "memory-candidate-report") {
    errors.push("kind must be memory-candidate-report");
  }
  if (record?.schema_version !== CANDIDATE_REPORT_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${CANDIDATE_REPORT_SCHEMA_VERSION}`);
  }
  validateNonEmptyString(record?.generated_at, "generated_at", errors);
  if (!SUPPORTED_RUNTIMES.includes(record?.runtime)) {
    errors.push(`runtime must be one of ${SUPPORTED_RUNTIMES.join(", ")}`);
  }
  if (!SUPPORTED_TARGETS.includes(record?.target)) {
    errors.push(`target must be one of ${SUPPORTED_TARGETS.join(", ")}`);
  }
  validateNonEmptyString(record?.task_scope, "task_scope", errors);
  validateNonEmptyString(record?.strictness, "strictness", errors);
  validateNonEmptyString(record?.read_profile_id, "read_profile_id", errors);
  if (typeof record?.read_only !== "boolean") {
    errors.push("read_only must be boolean");
  } else if (record.read_only !== true) {
    errors.push("read_only must be true");
  }
  const precedenceRule = validateStringArray(
    record?.precedence_rule,
    "precedence_rule",
    errors,
    { allowEmpty: false },
  );
  const expectedPrefix = ["global-project-memory", "task-memory", "session", "staging"];
  for (let index = 0; index < expectedPrefix.length; index += 1) {
    if (precedenceRule[index] !== expectedPrefix[index]) {
      errors.push(`precedence_rule must start with ${expectedPrefix.join(" > ")}`);
      break;
    }
  }

  if (!isObject(record?.plan)) {
    errors.push("plan must be an object");
  } else {
    validateNonEmptyString(record.plan?.task_scope, "plan.task_scope", errors);
    validateStringArray(record.plan?.evidence_sources, "plan.evidence_sources", errors);
    if (!Number.isInteger(record.plan?.candidate_count_estimate) || record.plan.candidate_count_estimate < 0) {
      errors.push("plan.candidate_count_estimate must be a non-negative integer");
    }
    validateStringArray(record.plan?.risk_notes, "plan.risk_notes", errors);
  }

  if (!Array.isArray(record?.candidates) || record.candidates.length === 0) {
    errors.push("candidates must be a non-empty list");
  } else {
    for (const candidate of record.candidates) {
      if (!isObject(candidate)) {
        errors.push("candidates[] must be an object");
        continue;
      }
      validateNonEmptyString(candidate?.id, "candidates[].id", errors);
      if (!["task-memory", "session", "staging"].includes(candidate?.source_layer)) {
        errors.push("candidates[].source_layer must be one of task-memory, session, staging");
      }
      validateNonEmptyString(candidate?.source_file, "candidates[].source_file", errors);
      validateNonEmptyString(candidate?.claim_key, "candidates[].claim_key", errors);
      if (!MEMORY_RECORD_KINDS.includes(candidate?.kind)) {
        errors.push(`candidates[].kind must be one of ${MEMORY_RECORD_KINDS.join(", ")}`);
      }
      validateNonEmptyString(candidate?.title, "candidates[].title", errors);
      validateNonEmptyString(candidate?.statement, "candidates[].statement", errors);
      if (!MEMORY_RECORD_SCOPES.includes(candidate?.scope)) {
        errors.push(`candidates[].scope must be one of ${MEMORY_RECORD_SCOPES.join(", ")}`);
      }
      if (
        "scope_detail" in candidate &&
        candidate.scope_detail !== null &&
        typeof candidate.scope_detail !== "string"
      ) {
        errors.push("candidates[].scope_detail must be string or null");
      }
      validateStringArray(candidate?.evidence ?? [], "candidates[].evidence", errors);
      if (!MEMORY_RECORD_CONFIDENCE.includes(candidate?.confidence)) {
        errors.push(`candidates[].confidence must be one of ${MEMORY_RECORD_CONFIDENCE.join(", ")}`);
      }
      validateNonEmptyString(candidate?.confidence_reason, "candidates[].confidence_reason", errors);
      if (!["new", "duplicate", "supersede-candidate"].includes(candidate?.novelty)) {
        errors.push("candidates[].novelty must be one of new, duplicate, supersede-candidate");
      }
      if (
        ![
          "keep-as-candidate",
          "duplicate-existing",
          "needs-supersede-review",
          "too-weak-do-not-promote",
        ].includes(candidate?.classification)
      ) {
        errors.push(
          "candidates[].classification must be one of keep-as-candidate, duplicate-existing, needs-supersede-review, too-weak-do-not-promote",
        );
      }
      validateNonEmptyString(candidate?.reason_to_promote, "candidates[].reason_to_promote", errors);
      validateNonEmptyString(
        candidate?.reason_not_to_promote_yet,
        "candidates[].reason_not_to_promote_yet",
        errors,
      );
      validateNonEmptyString(candidate?.target_file_hint, "candidates[].target_file_hint", errors);
      if (
        ![
          "USE_PAIRSLASH_MEMORY_WRITE_GLOBAL",
          "KEEP_IN_TASK_MEMORY",
          "REJECT_CANDIDATES",
        ].includes(candidate?.recommended_next_action)
      ) {
        errors.push(
          "candidates[].recommended_next_action must be one of USE_PAIRSLASH_MEMORY_WRITE_GLOBAL, KEEP_IN_TASK_MEMORY, REJECT_CANDIDATES",
        );
      }
      if (!isObject(candidate?.suspicion)) {
        errors.push("candidates[].suspicion must be an object");
      } else {
        validateBoolean(candidate.suspicion?.duplicate, "candidates[].suspicion.duplicate", errors);
        validateBoolean(candidate.suspicion?.conflict, "candidates[].suspicion.conflict", errors);
        validateBoolean(candidate.suspicion?.supersede, "candidates[].suspicion.supersede", errors);
        validateStringArray(candidate.suspicion?.reasons, "candidates[].suspicion.reasons", errors);
      }
      if (
        "matched_global_record" in candidate &&
        candidate.matched_global_record !== null &&
        !isObject(candidate.matched_global_record)
      ) {
        errors.push("candidates[].matched_global_record must be object or null");
      } else if (isObject(candidate?.matched_global_record)) {
        if (candidate.matched_global_record.layer !== "global-project-memory") {
          errors.push("candidates[].matched_global_record.layer must be global-project-memory");
        }
        validateNonEmptyString(candidate.matched_global_record?.file, "candidates[].matched_global_record.file", errors);
        if (candidate.matched_global_record?.kind !== null) {
          validateNonEmptyString(
            candidate.matched_global_record?.kind,
            "candidates[].matched_global_record.kind",
            errors,
          );
        }
        if (candidate.matched_global_record?.title !== null) {
          validateNonEmptyString(
            candidate.matched_global_record?.title,
            "candidates[].matched_global_record.title",
            errors,
          );
        }
        if (candidate.matched_global_record?.scope !== null) {
          validateNonEmptyString(
            candidate.matched_global_record?.scope,
            "candidates[].matched_global_record.scope",
            errors,
          );
        }
        if (
          "scope_detail" in candidate.matched_global_record &&
          candidate.matched_global_record.scope_detail !== null &&
          typeof candidate.matched_global_record.scope_detail !== "string"
        ) {
          errors.push("candidates[].matched_global_record.scope_detail must be string or null");
        }
        if (
          "statement" in candidate.matched_global_record &&
          candidate.matched_global_record.statement !== null &&
          typeof candidate.matched_global_record.statement !== "string"
        ) {
          errors.push("candidates[].matched_global_record.statement must be string or null");
        }
      }
    }
  }

  if (!isObject(record?.reconciliation)) {
    errors.push("reconciliation must be an object");
  } else {
    validateStringArray(
      record.reconciliation?.existing_records_checked,
      "reconciliation.existing_records_checked",
      errors,
    );
    validateStringArray(record.reconciliation?.duplicates_found, "reconciliation.duplicates_found", errors);
    validateStringArray(record.reconciliation?.conflicts_found, "reconciliation.conflicts_found", errors);
    validateStringArray(
      record.reconciliation?.supersede_review_needed,
      "reconciliation.supersede_review_needed",
      errors,
    );
    validateStringArray(record.reconciliation?.missing_evidence, "reconciliation.missing_evidence", errors);
    validateStringArray(record.reconciliation?.unresolved_context, "reconciliation.unresolved_context", errors);
  }

  if (
    ![
      "USE_PAIRSLASH_MEMORY_WRITE_GLOBAL",
      "KEEP_IN_TASK_MEMORY",
      "REJECT_CANDIDATES",
    ].includes(record?.next_action)
  ) {
    errors.push("next_action must be one of USE_PAIRSLASH_MEMORY_WRITE_GLOBAL, KEEP_IN_TASK_MEMORY, REJECT_CANDIDATES");
  }

  return errors;
}
