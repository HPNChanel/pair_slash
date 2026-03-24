import {
  AUDIT_LOG_LEVELS,
  BUNDLE_KINDS,
  CAPABILITY_FLAGS,
  COMPILED_PACK_SCHEMA_VERSION,
  COMPATIBILITY_STATUSES,
  DOCTOR_REPORT_SCHEMA_VERSION,
  LINT_REPORT_SCHEMA_VERSION,
  DOCTOR_CHECK_GROUPS,
  DOCTOR_CHECK_SEVERITIES,
  DOCTOR_CHECK_STATUSES,
  INSTALL_JOURNAL_SCHEMA_VERSION,
  INSTALL_STATE_SCHEMA_VERSION,
  INSTALL_SURFACES,
  LOGICAL_ASSET_KINDS,
  LINT_CHECK_RESULTS,
  MEMORY_ACCESS_LEVELS,
  MEMORY_AUTHORITY_MODES,
  NORMALIZED_IR_SCHEMA_VERSION,
  OWNERSHIP_FILE,
  OVERRIDE_MARKER_FILE,
  PACK_STATUSES,
  PREVIEW_OPERATION_KINDS,
  PREVIEW_PLAN_SCHEMA_VERSION,
  RELEASE_CHANNELS,
  RISK_LEVELS,
  RUNTIME_SELECTORS,
  SESSION_ARTIFACT_LEVELS,
  SUPPORT_VERDICTS,
  SUPPORTED_RUNTIMES,
  SUPPORTED_TARGETS,
  TOOL_KINDS,
  TOOL_PHASES,
  WORKFLOW_CLASSES,
} from "./constants.js";

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

export function validatePackManifestV2(record) {
  const errors = [];
  const required = [
    "kind",
    "schema_version",
    "version",
    "pack",
    "supported_runtime_ranges",
    "install_targets",
    "capabilities",
    "risk_level",
    "required_tools",
    "required_mcp_servers",
    "memory_permissions",
    "assets",
    "ownership",
    "local_override_policy",
    "release_channel",
    "runtime_targets",
  ];
  for (const field of required) {
    if (!(field in (record || {}))) {
      push(errors, "PSM000", `missing field: ${field}`);
    }
  }
  if (record?.kind !== "pack-manifest-v2") {
    push(errors, "PSM001", "kind must be pack-manifest-v2");
  }
  if (record?.schema_version !== "2.0.0") {
    push(errors, "PSM002", "schema_version must be 2.0.0");
  }
  validateNonEmptyString(record?.version, "version", errors, "PSM003");
  const pack = validatePackBlock(record?.pack, errors);
  if (!RISK_LEVELS.includes(record?.risk_level)) {
    push(errors, "PSM031", `risk_level must be one of ${RISK_LEVELS.join(", ")}`);
  }
  if (!RELEASE_CHANNELS.includes(record?.release_channel)) {
    push(errors, "PSM060", `release_channel must be one of ${RELEASE_CHANNELS.join(", ")}`);
  }

  validateRuntimeRanges(record?.supported_runtime_ranges, errors);
  validateInstallTargets(record?.install_targets, errors);
  const capabilities = validateCapabilities(record?.capabilities, record?.risk_level, errors);
  validateTools(record?.required_tools, errors);
  validateMcpServers(record?.required_mcp_servers, capabilities, errors);
  validateMemoryPermissions(record?.memory_permissions, capabilities, record?.risk_level, errors);

  const assetInclude = validateAssets(record?.assets, pack?.id, errors);
  validateOwnership(record?.ownership, [OWNERSHIP_FILE], errors);
  validateLocalOverridePolicy(record?.local_override_policy, assetInclude, errors);
  validateRuntimeTargets(record?.runtime_targets, pack?.id, errors);

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
    if (typeof asset?.generated !== "boolean") {
      errors.push("logical_assets[].generated must be boolean");
    }
    if (typeof asset?.override_eligible !== "boolean") {
      errors.push("logical_assets[].override_eligible must be boolean");
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
    if (typeof file?.override_eligible !== "boolean") {
      errors.push("files[].override_eligible must be boolean");
    }
    if (typeof file?.write_authority_guarded !== "boolean") {
      errors.push("files[].write_authority_guarded must be boolean");
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
    for (const file of pack.files) {
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
      if (typeof file?.override_eligible !== "boolean") {
        errors.push("packs[].files[].override_eligible must be boolean");
      }
      if (typeof file?.local_override !== "boolean") {
        errors.push("packs[].files[].local_override must be boolean");
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
    }
  }
  if (!Array.isArray(record?.issues)) {
    errors.push("issues must be a list");
  } else {
    for (const issue of record.issues) {
      validateNonEmptyString(issue?.code, "issues[].code", errors, "DCR003");
      if (!["warn", "fail"].includes(issue?.severity)) {
        errors.push(`unsupported issues[].severity: ${issue?.severity}`);
      }
      validateNonEmptyString(issue?.check_id, "issues[].check_id", errors, "DCR003");
      validateNonEmptyString(issue?.message, "issues[].message", errors, "DCR003");
      if (issue?.remediation !== null && typeof issue?.remediation !== "string") {
        errors.push("issues[].remediation must be string or null");
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
  if (record?.phase !== "phase4-bridge") {
    errors.push("phase must be phase4-bridge");
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
