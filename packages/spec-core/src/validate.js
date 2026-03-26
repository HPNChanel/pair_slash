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
  MANIFEST_MARKER_MODES,
  MANIFEST_SMOKE_ACTIONS,
  NORMALIZED_IR_SCHEMA_VERSION,
  OWNERSHIP_FILE,
  OVERRIDE_MARKER_FILE,
  PACK_STATUSES,
  PREVIEW_OPERATION_KINDS,
  PREVIEW_PLAN_SCHEMA_VERSION,
  RELEASE_CHANNELS,
  RISK_LEVELS,
  RUNTIME_ASSET_GENERATORS,
  RUNTIME_METADATA_MODES,
  RUNTIME_SELECTORS,
  SESSION_ARTIFACT_LEVELS,
  SUPPORT_VERDICTS,
  SUPPORTED_RUNTIMES,
  SUPPORTED_TARGETS,
  TOOL_KINDS,
  TOOL_PHASES,
  UNINSTALL_BEHAVIORS,
  UNINSTALL_STRATEGY_MODES,
  UPDATE_NON_OVERRIDE_POLICIES,
  UPDATE_STRATEGY_MODES,
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
