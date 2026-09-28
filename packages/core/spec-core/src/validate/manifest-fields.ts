import {
  AUDIT_LOG_LEVELS,
  CAPABILITY_FLAGS,
  MCP_SPEC_ERAS,
  MEMORY_ACCESS_LEVELS,
  MEMORY_AUTHORITY_MODES,
  PHASE4_SCHEMA_VERSION,
  SESSION_ARTIFACT_LEVELS,
  SUPPORTED_RUNTIMES,
  SUPPORTED_TARGETS,
  TOOL_KINDS,
  TOOL_PHASES,
} from "../constants.ts";
import {
  push,
  validateNonEmptyString,
  validateObject,
  validateStringArray,
} from "./primitives.ts";

export function validateRuntimeRanges(value, errors) {
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

export function validateCapabilities(value, riskLevel, errors) {
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

export function validateTools(value, errors) {
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

export function validateMcpServers(value, capabilities, errors, declaredSchemaVersion = null) {
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
    if (
      declaredSchemaVersion === PHASE4_SCHEMA_VERSION &&
      server.spec_era === undefined
    ) {
      push(
        errors,
        "PSM033",
        `required_mcp_servers[${server.id}].spec_era is required at schema_version ${PHASE4_SCHEMA_VERSION} (legacy|modern|dual)`,
      );
    }
    if (server.spec_era !== undefined && !MCP_SPEC_ERAS.includes(server.spec_era)) {
      push(
        errors,
        "PSM033",
        `required_mcp_servers[${server.id}].spec_era must be one of ${MCP_SPEC_ERAS.join(", ")}`,
      );
    }
    if (seen.has(server.id)) {
      push(errors, "PSM033", `required_mcp_servers contains duplicate id ${server.id}`);
    }
    seen.add(server.id);
  }
}

export function validateMemoryPermissions(value, capabilities, riskLevel, errors) {
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

export function validateInstallTargets(value, errors) {
  const targets = validateStringArray(value, "install_targets", errors, "PSM023");
  for (const target of targets) {
    if (!SUPPORTED_TARGETS.includes(target)) {
      push(errors, "PSM023", `install_targets contains unsupported target ${target}`);
    }
  }
}
