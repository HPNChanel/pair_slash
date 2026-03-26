import {
  CONTRACT_ENVELOPE_SCHEMA_VERSION,
  CONTRACT_INPUT_MODES,
  CONTRACT_INPUT_SOURCES,
  MEMORY_WRITE_REQUEST_SCHEMA_VERSION,
  SUPPORTED_RUNTIMES,
  SUPPORTED_TARGETS,
  normalizeRuntime,
  normalizeTarget,
  validateContractEnvelope,
} from "@pairslash/spec-core";
import * as codexAdapter from "@pairslash/runtime-codex-adapter";
import * as copilotAdapter from "@pairslash/runtime-copilot-adapter";

import { CONTRACT_ENGINE_ERROR_CODES } from "./error-codes.js";
import { ContractEngineError, ensure } from "./errors.js";
import { normalizeContractEnvelopeShape } from "./normalize.js";

const CONTRACT_SECTIONS = [
  "input_contract",
  "output_contract",
  "failure_contract",
  "memory_contract",
  "tool_contract",
  "capability_scope",
  "runtime_boundary",
];

const MEMORY_WRITE_REQUIRED_FIELDS = [
  "kind",
  "title",
  "statement",
  "evidence",
  "scope",
  "confidence",
  "action",
  "tags",
  "source_refs",
  "updated_by",
  "timestamp",
];

const MEMORY_WRITE_OPTIONAL_FIELDS = [
  "scope_detail",
  "supersedes",
];

const SOURCE_TYPES = ["manifest", "workflow", "api", "lint", "preview"];
const READ_REQUIRED_FIELDS = ["runtime", "target"];
const READ_OPTIONAL_FIELDS = ["packs", "format", "strict", "source"];

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function isWriteAuthority(manifest) {
  return manifest.memory_permissions?.global_project_memory === "write";
}

function getAdapter(runtime) {
  return normalizeRuntime(runtime) === "codex_cli" ? codexAdapter : copilotAdapter;
}

function getRuntimeScope(manifest) {
  const runtimes = uniqueSorted(manifest.supported_runtimes ?? []);
  if (runtimes.length === 1 && runtimes[0] === "codex_cli") {
    return "codex-only";
  }
  if (runtimes.length === 1 && runtimes[0] === "copilot_cli") {
    return "copilot-only";
  }
  return "both";
}

function buildMemoryPaths(manifest) {
  if (!isWriteAuthority(manifest)) {
    return {
      read_paths: [".pairslash/project-memory/"],
      write_paths: [],
      promote_paths: [],
    };
  }
  return {
    read_paths: [
      ".pairslash/project-memory/",
      ".pairslash/task-memory/",
      ".pairslash/sessions/",
      ".pairslash/staging/",
    ],
    write_paths: [
      ".pairslash/staging/",
      ".pairslash/project-memory/",
      ".pairslash/project-memory/90-memory-index.yaml",
      ".pairslash/audit-log/",
    ],
    promote_paths: [".pairslash/staging/"],
  };
}

function buildOutputContract(manifest, memoryPaths) {
  const writeAuthority = isWriteAuthority(manifest);
  const artifacts = writeAuthority
      ? [
        { id: "preview_patch", when: "before any write", required: true },
        { id: "staging_artifact", when: "after preview generation and before approval", required: true },
        { id: "written_record", when: "after explicit approval", required: true },
        { id: "index_update", when: "after successful write", required: true },
        { id: "audit_entry", when: "after approval, conflict, or rejection", required: true },
      ]
    : [
        { id: "result_payload", when: "after processing request", required: true },
        { id: "policy_verdict", when: "after contract evaluation", required: true },
      ];

  return {
    output_shape: writeAuthority ? "structured-json" : "structured-markdown",
    structured_sections: writeAuthority
      ? [
          {
            id: "request",
            label: "Request",
            required: true,
            machine_readable: true,
          },
          {
            id: "preview_patch",
            label: "Preview Patch",
            required: true,
            machine_readable: true,
          },
          {
            id: "staging_artifact",
            label: "Staging Artifact",
            required: true,
            machine_readable: true,
          },
          {
            id: "policy_verdict",
            label: "Policy Verdict",
            required: true,
            machine_readable: true,
          },
          {
            id: "commit_result",
            label: "Commit Result",
            required: false,
            machine_readable: true,
          },
        ]
      : [
          {
            id: "summary",
            label: "Summary",
            required: true,
            machine_readable: false,
          },
          {
            id: "details",
            label: "Details",
            required: true,
            machine_readable: false,
          },
          {
            id: "policy_verdict",
            label: "Policy Verdict",
            required: true,
            machine_readable: true,
          },
        ],
    machine_readable_fields: writeAuthority
      ? ["request", "preview_patch", "staging_artifact", "policy_verdict", "commit_result"]
      : ["policy_verdict"],
    artifacts,
    allowed_side_effects_summary: {
      memory: writeAuthority ? "write" : manifest.memory_permissions?.global_project_memory === "read" ? "read" : "none",
      network_allowed:
        (manifest.required_mcp_servers ?? []).length > 0 ||
        (manifest.capabilities ?? []).includes("mcp_client"),
      destructive_allowed:
        (manifest.capabilities ?? []).includes("repo_write") ||
        (manifest.capabilities ?? []).includes("shell_exec"),
      secret_touching_allowed: (manifest.required_tools ?? []).some((tool) => tool.kind === "env_var"),
      preview_required: writeAuthority,
      explicit_approval_required: writeAuthority,
      filesystem_write_paths: memoryPaths.write_paths,
    },
  };
}

function buildFailureContract(manifest) {
  const writeAuthority = isWriteAuthority(manifest);
  const categories = [
    {
      code: "CONTRACT-VALIDATION-FAILED",
      type: "validation-failure",
      retryable: false,
      description: "Input or manifest data does not satisfy contract schema.",
    },
    {
      code: "CONTRACT-CAPABILITY-MISMATCH",
      type: "capability-mismatch",
      retryable: false,
      description: "Requested capability is outside runtime or contract scope.",
    },
    {
      code: "CONTRACT-RUNTIME-UNSUPPORTED",
      type: "runtime-unsupported",
      retryable: false,
      description: "Runtime lane is not supported by this workflow contract.",
    },
    {
      code: "CONTRACT-POLICY-BLOCKED",
      type: "policy-blocked",
      retryable: false,
      description: "Policy engine blocked the requested operation.",
    },
    {
      code: "CONTRACT-TOOL-UNAVAILABLE",
      type: "tool-unavailable",
      retryable: true,
      description: "Required tool is unavailable in the requested execution context.",
    },
  ];

  if (writeAuthority) {
    categories.push(
      {
        code: "CONTRACT-PREVIEW-REQUIRED",
        type: "policy-blocked",
        retryable: true,
        description: "Authoritative write requires preview before apply.",
      },
      {
        code: "CONTRACT-DUPLICATE-CONFLICT",
        type: "policy-blocked",
        retryable: true,
        description: "Duplicate or conflicting record blocks authoritative write.",
      },
    );
  }

  return {
    no_silent_fallback: true,
    categories,
    codes: categories.map((entry) => entry.code),
  };
}

function buildMemoryContract(manifest, target, memoryPaths) {
  const writeAuthority = isWriteAuthority(manifest);
  const targetScope =
    manifest.memory_permissions?.global_project_memory !== "none"
      ? "global-project-memory"
      : manifest.memory_permissions?.task_memory !== "none"
        ? "task-memory"
        : "none";

  return {
    mode: writeAuthority
      ? "write"
      : manifest.memory_permissions?.global_project_memory === "read" ||
          manifest.memory_permissions?.task_memory === "read"
        ? "read"
        : "none",
    target_scope: targetScope,
    target,
    authoritative_write_allowed: writeAuthority,
    preview_required: writeAuthority,
    authority_mode: manifest.memory_permissions.authority_mode,
    explicit_write_only: manifest.memory_permissions.explicit_write_only,
    global_project_memory: manifest.memory_permissions.global_project_memory,
    task_memory: manifest.memory_permissions.task_memory,
    session_artifacts: manifest.memory_permissions.session_artifacts,
    audit_log: manifest.memory_permissions.audit_log,
    no_hidden_write: true,
    read_paths: memoryPaths.read_paths,
    write_paths: memoryPaths.write_paths,
    promote_paths: memoryPaths.promote_paths,
  };
}

function buildToolContract(manifest) {
  const requiredTools = (manifest.required_tools ?? []).map((tool) => ({
    id: tool.id,
    kind: tool.kind,
    check_command: tool.check_command,
    required_for: uniqueSorted(tool.required_for ?? []),
  }));
  const toolsAllowed = uniqueSorted(requiredTools.map((tool) => tool.id));

  return {
    tools_allowed: toolsAllowed,
    tools_required: requiredTools,
    required_tools: requiredTools,
    required_mcp_servers: uniqueSorted((manifest.required_mcp_servers ?? []).map((server) => server.id)),
    network_allowance:
      (manifest.required_mcp_servers ?? []).length > 0 ||
      (manifest.capabilities ?? []).includes("mcp_client"),
    destructive_allowance:
      (manifest.capabilities ?? []).includes("repo_write") ||
      (manifest.capabilities ?? []).includes("shell_exec"),
    secret_touching_allowance: requiredTools.some((tool) => tool.kind === "env_var"),
  };
}

function buildCapabilityScope(manifest, runtime, runtimeNotes) {
  const requested = uniqueSorted(manifest.capabilities ?? []);
  const runtimeBinding = manifest.runtime_bindings?.[runtime];
  const blockedByBinding =
    runtimeBinding?.compatibility?.canonical_picker === "blocked" ||
    runtimeBinding?.compatibility?.direct_invocation === "blocked";

  const negotiation = requested.map((capability) => ({
    capability,
    status: blockedByBinding ? "denied" : "granted",
    reason: blockedByBinding ? "runtime binding is blocked for this lane" : null,
  }));
  const granted = negotiation
    .filter((entry) => entry.status === "granted")
    .map((entry) => entry.capability);

  return {
    runtime_scope: getRuntimeScope(manifest),
    requested,
    granted,
    negotiation,
    degraded_behavior_notes: uniqueSorted(runtimeNotes),
  };
}

function buildInputContract(manifest) {
  if (isWriteAuthority(manifest)) {
    return {
      required_fields: MEMORY_WRITE_REQUIRED_FIELDS,
      optional_fields: MEMORY_WRITE_OPTIONAL_FIELDS,
      accepted_sources: CONTRACT_INPUT_SOURCES,
      accepted_modes: ["preview", "apply"],
      schema_refs: [
        `packages/spec-core/schemas/memory-write-request.schema.yaml@${MEMORY_WRITE_REQUEST_SCHEMA_VERSION}`,
        "packages/spec-core/schemas/memory-record.schema.yaml@0.1.0",
      ],
      validation_hints: {
        schema_refs: [
          `packages/spec-core/schemas/memory-write-request.schema.yaml@${MEMORY_WRITE_REQUEST_SCHEMA_VERSION}`,
          "packages/spec-core/schemas/memory-record.schema.yaml@0.1.0",
        ],
        strict_required_fields: true,
        reject_unknown_fields: true,
        error_codes: [
          "CONTRACT-VALIDATION-FAILED",
          "CONTRACT-PREVIEW-REQUIRED",
          "CONTRACT-DUPLICATE-CONFLICT",
        ],
      },
    };
  }
  return {
    required_fields: READ_REQUIRED_FIELDS,
    optional_fields: READ_OPTIONAL_FIELDS,
    accepted_sources: ["cli", "workflow"],
    accepted_modes: CONTRACT_INPUT_MODES.filter((mode) => mode !== "apply"),
    schema_refs: ["packages/spec-core/schemas/pack-manifest-v2.schema.yaml@2.1.0"],
    validation_hints: {
      schema_refs: ["packages/spec-core/schemas/pack-manifest-v2.schema.yaml@2.1.0"],
      strict_required_fields: true,
      reject_unknown_fields: true,
      error_codes: ["CONTRACT-VALIDATION-FAILED", "CONTRACT-POLICY-BLOCKED"],
    },
  };
}

function validateRequestedRuntimeAndTarget(runtime, target) {
  ensure(
    SUPPORTED_RUNTIMES.includes(runtime),
    CONTRACT_ENGINE_ERROR_CODES.RUNTIME_UNSUPPORTED,
    `unsupported runtime: ${runtime}`,
    { runtime },
  );
  ensure(
    SUPPORTED_TARGETS.includes(target),
    CONTRACT_ENGINE_ERROR_CODES.TARGET_UNSUPPORTED,
    `unsupported target: ${target}`,
    { target },
  );
}

function validateManifestContractBoundary(manifest) {
  ensure(
    manifest && typeof manifest === "object",
    CONTRACT_ENGINE_ERROR_CODES.MANIFEST_REQUIRED,
    "manifest is required to build contract envelope",
  );
  const unsupportedRuntimes = (manifest.supported_runtimes ?? []).filter(
    (runtime) => !SUPPORTED_RUNTIMES.includes(runtime),
  );
  ensure(
    unsupportedRuntimes.length === 0,
    CONTRACT_ENGINE_ERROR_CODES.RUNTIME_UNSUPPORTED,
    `unsupported runtime in manifest: ${unsupportedRuntimes.join(", ")}`,
    { unsupported_runtimes: unsupportedRuntimes },
  );
  const workflowClass = manifest.workflow_class ?? manifest.pack?.workflow_class;
  const globalMemory = manifest.memory_permissions?.global_project_memory;
  const authorityMode = manifest.memory_permissions?.authority_mode;
  const hasWriteCapability = (manifest.capabilities ?? []).includes("memory_write_global");
  if (workflowClass === "read-oriented" && (globalMemory === "write" || authorityMode === "write-authority")) {
    throw new ContractEngineError(
      CONTRACT_ENGINE_ERROR_CODES.WORKFLOW_AUTHORITY_VIOLATION,
      "read-oriented workflow cannot declare authoritative memory write",
      {
        workflow_class: workflowClass,
        global_project_memory: globalMemory,
        authority_mode: authorityMode,
      },
    );
  }
  if (workflowClass === "read-oriented" && hasWriteCapability) {
    throw new ContractEngineError(
      CONTRACT_ENGINE_ERROR_CODES.WORKFLOW_AUTHORITY_VIOLATION,
      "read-oriented workflow cannot request memory_write_global capability",
      {
        workflow_class: workflowClass,
      },
    );
  }
}

function assertRuntimeWithinManifest(manifest, runtime) {
  ensure(
    (manifest.supported_runtimes ?? []).includes(runtime),
    CONTRACT_ENGINE_ERROR_CODES.RUNTIME_NOT_IN_MANIFEST,
    `runtime ${runtime} is outside manifest supported_runtimes`,
    {
      runtime,
      supported_runtimes: manifest.supported_runtimes ?? [],
    },
  );
}

function assertRuntimeCapabilityCompatibility(manifest, runtime) {
  const binding = manifest.runtime_bindings?.[runtime];
  ensure(
    Boolean(binding),
    CONTRACT_ENGINE_ERROR_CODES.RUNTIME_NOT_IN_MANIFEST,
    `manifest.runtime_bindings is missing lane ${runtime}`,
    { runtime },
  );
  if (
    binding.compatibility?.canonical_picker === "blocked" ||
    binding.compatibility?.direct_invocation === "blocked"
  ) {
    throw new ContractEngineError(
      CONTRACT_ENGINE_ERROR_CODES.CAPABILITY_RUNTIME_MISMATCH,
      `runtime ${runtime} is blocked by compatibility boundary for this workflow`,
      {
        runtime,
        compatibility: binding.compatibility,
      },
    );
  }
}

function buildRuntimeBoundary(manifest, runtime) {
  const adapter = getAdapter(runtime);
  return {
    adapter: adapter.runtime,
    enforcement_mode: "runtime-aware",
    differences: adapter.describeEnforcementBoundary(manifest),
  };
}

function inferWorkflowClass(manifest) {
  return manifest.workflow_class ?? manifest.pack?.workflow_class ?? "read-oriented";
}

function assertRequiredSections(contract) {
  for (const section of CONTRACT_SECTIONS) {
    if (!contract || typeof contract[section] !== "object" || contract[section] === null) {
      throw new ContractEngineError(
        CONTRACT_ENGINE_ERROR_CODES.MISSING_CONTRACT_SECTION,
        `missing required contract section: ${section}`,
        {
          section,
        },
      );
    }
  }
}

function finalizeContract(contract) {
  assertRequiredSections(contract);
  const normalized = normalizeContractEnvelopeShape(contract);
  const errors = validateContractEnvelope(normalized);
  if (errors.length > 0) {
    throw new ContractEngineError(
      CONTRACT_ENGINE_ERROR_CODES.CONTRACT_SCHEMA_INVALID,
      `invalid contract envelope :: ${errors.join("; ")}`,
      {
        errors,
      },
    );
  }
  return normalized;
}

export function parseContractEnvelope(contract) {
  ensure(
    contract && typeof contract === "object",
    CONTRACT_ENGINE_ERROR_CODES.CONTRACT_REQUIRED,
    "contract envelope payload is required",
  );
  return finalizeContract(structuredClone(contract));
}

export function buildContractEnvelope({
  manifest,
  runtime,
  target = "repo",
  action = "lint",
  sourceType = "manifest",
  sourcePath = null,
} = {}) {
  validateManifestContractBoundary(manifest);
  const normalizedRuntime = normalizeRuntime(runtime);
  const normalizedTarget = normalizeTarget(target);
  validateRequestedRuntimeAndTarget(normalizedRuntime, normalizedTarget);
  assertRuntimeWithinManifest(manifest, normalizedRuntime);
  assertRuntimeCapabilityCompatibility(manifest, normalizedRuntime);
  ensure(
    typeof action === "string" && action.trim() !== "",
    CONTRACT_ENGINE_ERROR_CODES.ACTION_REQUIRED,
    "action must be a non-empty string",
  );
  ensure(
    SOURCE_TYPES.includes(sourceType),
    CONTRACT_ENGINE_ERROR_CODES.SOURCE_UNSUPPORTED,
    `unsupported source type ${sourceType}`,
    { source_type: sourceType },
  );

  const memoryPaths = buildMemoryPaths(manifest);
  const runtimeBoundary = buildRuntimeBoundary(manifest, normalizedRuntime);
  const capabilityScope = buildCapabilityScope(
    manifest,
    normalizedRuntime,
    runtimeBoundary.differences ?? [],
  );
  const contract = {
    kind: "contract-envelope",
    schema_version: CONTRACT_ENVELOPE_SCHEMA_VERSION,
    contract_id: `${manifest.pack_name}:${normalizedRuntime}:${normalizedTarget}:${action}`,
    source: {
      type: sourceType,
      pack_id: manifest.pack_name ?? null,
      manifest_path: sourcePath,
    },
    runtime: normalizedRuntime,
    target: normalizedTarget,
    canonical_entrypoint: manifest.canonical_entrypoint,
    direct_invocation: manifest.runtime_bindings?.[normalizedRuntime]?.direct_invocation ?? null,
    workflow_class: inferWorkflowClass(manifest),
    risk_level: manifest.risk_level,
    input_contract: buildInputContract(manifest),
    output_contract: buildOutputContract(manifest, memoryPaths),
    failure_contract: buildFailureContract(manifest),
    memory_contract: buildMemoryContract(manifest, normalizedTarget, memoryPaths),
    tool_contract: buildToolContract(manifest),
    capability_scope: capabilityScope,
    runtime_boundary: runtimeBoundary,
  };
  return finalizeContract(contract);
}

export function buildMemoryWriteContract({ manifest, runtime, target = "repo" } = {}) {
  return buildContractEnvelope({
    manifest,
    runtime,
    target,
    action: "memory.write-global",
    sourceType: "workflow",
  });
}

export { ContractEngineError, CONTRACT_ENGINE_ERROR_CODES };
