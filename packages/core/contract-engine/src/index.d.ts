export type PairSlashRuntime = "codex_cli" | "copilot_cli";
export type PairSlashTarget = "repo" | "user";
export type WorkflowClass = "read-oriented" | "dual-mode" | "write-authority";
export type ContractInputSource = "cli" | "workflow" | "api";
export type ContractInputMode = "read" | "preview" | "apply" | "lint" | "doctor";
export type ContractMemoryMode = "none" | "read" | "write" | "promote";
export type ContractRuntimeScope = "codex-only" | "copilot-only" | "both";

export interface ContractFailureCategory {
  code: string;
  type:
    | "validation-failure"
    | "capability-mismatch"
    | "runtime-unsupported"
    | "policy-blocked"
    | "tool-unavailable";
  retryable: boolean;
  description: string;
}

export interface WorkflowContractEnvelope {
  kind: "contract-envelope";
  schema_version: "2.0.0";
  contract_id: string;
  source: {
    type: "manifest" | "workflow" | "api" | "lint" | "preview";
    pack_id: string | null;
    manifest_path?: string | null;
  };
  runtime: PairSlashRuntime;
  target: PairSlashTarget;
  canonical_entrypoint: "/skills";
  direct_invocation: string | null;
  workflow_class: WorkflowClass;
  risk_level: "low" | "medium" | "high" | "critical";
  input_contract: {
    required_fields: string[];
    optional_fields: string[];
    accepted_sources: ContractInputSource[];
    accepted_modes: ContractInputMode[];
    schema_refs: string[];
    validation_hints: {
      schema_refs: string[];
      strict_required_fields: boolean;
      reject_unknown_fields: boolean;
      error_codes: string[];
    };
  };
  output_contract: {
    output_shape: "structured-markdown" | "structured-json" | "structured-yaml";
    structured_sections: Array<{
      id: string;
      label: string;
      required: boolean;
      machine_readable: boolean;
    }>;
    machine_readable_fields: string[];
    artifacts: Array<{ id: string; when: string; required?: boolean }>;
    allowed_side_effects_summary: {
      memory: ContractMemoryMode;
      network_allowed: boolean;
      destructive_allowed: boolean;
      secret_touching_allowed: boolean;
      preview_required: boolean;
      explicit_approval_required: boolean;
      filesystem_write_paths: string[];
    };
  };
  failure_contract: {
    no_silent_fallback: true;
    categories: ContractFailureCategory[];
    codes: string[];
  };
  memory_contract: {
    mode: ContractMemoryMode;
    target_scope: "global-project-memory" | "task-memory" | "staging" | "none";
    target: PairSlashTarget;
    authoritative_write_allowed: boolean;
    preview_required: boolean;
    authority_mode: "read-only" | "write-authority";
    explicit_write_only: boolean;
    global_project_memory: "none" | "read" | "write";
    task_memory: "none" | "read" | "write";
    session_artifacts: "none" | "implicit-read" | "read" | "write";
    audit_log: "none" | "append";
    no_hidden_write: true;
    read_paths: string[];
    write_paths: string[];
    promote_paths: string[];
  };
  tool_contract: {
    tools_allowed: string[];
    tools_required: Array<{
      id: string;
      kind: "binary" | "script" | "env_var";
      check_command: string;
      required_for?: Array<"compile" | "install" | "run" | "doctor">;
    }>;
    required_tools: Array<{
      id: string;
      kind: "binary" | "script" | "env_var";
      check_command: string;
      required_for?: Array<"compile" | "install" | "run" | "doctor">;
    }>;
    required_mcp_servers: string[];
    network_allowance: boolean;
    destructive_allowance: boolean;
    secret_touching_allowance: boolean;
  };
  capability_scope: {
    runtime_scope: ContractRuntimeScope;
    requested: string[];
    granted: string[];
    negotiation: Array<{
      capability: string;
      status: "granted" | "ask" | "denied" | "fallback-blocked";
      reason: string | null;
    }>;
    degraded_behavior_notes: string[];
  };
  runtime_boundary: {
    adapter: PairSlashRuntime;
    enforcement_mode: string;
    differences: string[];
  };
}

export declare const CONTRACT_ENGINE_ERROR_CODES: {
  readonly CONTRACT_REQUIRED: "PCE-CONTRACT-001";
  readonly MANIFEST_REQUIRED: "PCE-MANIFEST-001";
  readonly RUNTIME_UNSUPPORTED: "PCE-RUNTIME-001";
  readonly TARGET_UNSUPPORTED: "PCE-TARGET-001";
  readonly SOURCE_UNSUPPORTED: "PCE-SOURCE-001";
  readonly ACTION_REQUIRED: "PCE-ACTION-001";
  readonly RUNTIME_NOT_IN_MANIFEST: "PCE-RUNTIME-002";
  readonly WORKFLOW_AUTHORITY_VIOLATION: "PCE-AUTH-001";
  readonly CAPABILITY_RUNTIME_MISMATCH: "PCE-CAPABILITY-001";
  readonly CONTRACT_SCHEMA_INVALID: "PCE-CONTRACT-002";
  readonly MISSING_CONTRACT_SECTION: "PCE-CONTRACT-003";
};

export declare class ContractEngineError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  constructor(code: string, message: string, details?: Record<string, unknown>);
}

export declare function parseContractEnvelope(contract: unknown): WorkflowContractEnvelope;

export declare function buildContractEnvelope(options: {
  manifest: Record<string, unknown>;
  runtime: PairSlashRuntime;
  target?: PairSlashTarget;
  action?: string;
  sourceType?: "manifest" | "workflow" | "api" | "lint" | "preview";
  sourcePath?: string | null;
}): WorkflowContractEnvelope;

export declare function buildMemoryWriteContract(options: {
  manifest: Record<string, unknown>;
  runtime: PairSlashRuntime;
  target?: PairSlashTarget;
}): WorkflowContractEnvelope;
