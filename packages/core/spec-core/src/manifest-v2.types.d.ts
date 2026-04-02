export type PairSlashRuntime = "codex_cli" | "copilot_cli";
export type PairSlashTarget = "repo" | "user";
export type PairSlashReleaseChannel = "stable" | "preview" | "canary";
export type PairSlashWorkflowClass = "read-oriented" | "dual-mode" | "write-authority";
export type PairSlashRiskLevel = "low" | "medium" | "high" | "critical";

export interface RuntimeCompatibility {
  canonical_picker: "supported" | "unverified" | "blocked";
  direct_invocation: "supported" | "unverified" | "blocked";
}

export interface RuntimeBinding {
  direct_invocation: string;
  metadata_mode: "openai_yaml_optional" | "none";
  install_dir_name: string;
  compatibility: RuntimeCompatibility;
}

export interface RuntimeAssetEntry {
  asset_id: string;
  runtime: "shared" | PairSlashRuntime;
  asset_kind: string;
  install_surface: string;
  source_path: string | null;
  generated_path: string | null;
  generator:
    | "source_copy"
    | "codex_metadata"
    | "codex_context"
    | "codex_config"
    | "codex_write_authority"
    | "codex_mcp"
    | "copilot_package"
    | "copilot_agent"
    | "copilot_preflight"
    | "copilot_mcp"
    | "pairslash_ownership_receipt";
  required: boolean;
  override_eligible: boolean;
}

export interface AssetOwnershipRecord {
  asset_id: string;
  owner: "pairslash" | "user" | "system";
  uninstall_behavior: "remove_if_unmodified" | "detach_if_modified" | "preserve_unmanaged";
}

export interface SmokeCheck {
  id: string;
  runtime: PairSlashRuntime;
  target: PairSlashTarget;
  action: "preview_install" | "preview_update" | "preview_uninstall" | "doctor";
}

export interface PackManifestV2 {
  kind: "pack-manifest-v2";
  schema_version: "2.1.0";
  pack_name: string;
  display_name: string;
  pack_version: string;
  summary: string;
  category: string;
  workflow_class: PairSlashWorkflowClass;
  phase: number;
  status: "active" | "draft" | "deprecated";
  canonical_entrypoint: "/skills";
  release_channel: PairSlashReleaseChannel;
  supported_runtimes: PairSlashRuntime[];
  supported_runtime_ranges: Record<PairSlashRuntime, string>;
  runtime_bindings: Record<PairSlashRuntime, RuntimeBinding>;
  install_targets: PairSlashTarget[];
  capabilities: string[];
  risk_level: PairSlashRiskLevel;
  required_tools: Array<{
    id: string;
    kind: "binary" | "script" | "env_var";
    required_for: Array<"compile" | "install" | "run" | "doctor">;
    check_command: string;
  }>;
  required_mcp_servers: Array<{ id: string }>;
  memory_permissions: {
    authority_mode: "read-only" | "write-authority";
    explicit_write_only: true;
    global_project_memory: "none" | "read" | "write";
    task_memory: "none" | "read" | "write";
    session_artifacts: "none" | "implicit-read" | "read" | "write";
    audit_log: "none" | "append";
  };
  runtime_assets: {
    source_root: string;
    primary_skill: string;
    entries: RuntimeAssetEntry[];
  };
  asset_ownership: {
    ownership_file: "pairslash.install.json";
    ownership_scope: "pack_root";
    safe_delete_policy: "pairslash-owned-only";
    records: AssetOwnershipRecord[];
  };
  local_override_policy: {
    marker_file: ".pairslash.local-overrides.yaml";
    marker_mode: "state_or_explicit_marker";
    eligible_asset_ids: string[];
  };
  update_strategy: {
    mode: "preserve_valid_local_overrides";
    on_non_override_change: "block";
    rollback_strategy: "restore_last_managed_state";
  };
  uninstall_strategy: {
    mode: "pairslash_owned_only";
    detach_modified_files: boolean;
    preserve_unknown_files: boolean;
    remove_empty_pack_dir: boolean;
  };
  smoke_checks: SmokeCheck[];
  docs_refs: {
    contract: string;
    example_invocation: string;
    example_output: string;
    validation_checklist: string;
  };
  trust_descriptor?: string;
}

export interface PackManifestResolution {
  runtime: PairSlashRuntime;
  target: PairSlashTarget;
  runtime_range: string;
  runtime_binding: RuntimeBinding;
  source_root: string;
  primary_skill: string;
  assets: RuntimeAssetEntry[];
  ownership_records: AssetOwnershipRecord[];
  docs_refs: PackManifestV2["docs_refs"];
  smoke_checks: SmokeCheck[];
}
