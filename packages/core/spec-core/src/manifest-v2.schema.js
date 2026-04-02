import * as v from "valibot";

import {
  AUDIT_LOG_LEVELS,
  CAPABILITY_FLAGS,
  COMPATIBILITY_STATUSES,
  MANIFEST_MARKER_MODES,
  MANIFEST_SMOKE_ACTIONS,
  MEMORY_ACCESS_LEVELS,
  MEMORY_AUTHORITY_MODES,
  PACK_STATUSES,
  PHASE4_SCHEMA_VERSION,
  RELEASE_CHANNELS,
  RISK_LEVELS,
  RUNTIME_ASSET_GENERATORS,
  RUNTIME_METADATA_MODES,
  RUNTIME_SELECTORS,
  SESSION_ARTIFACT_LEVELS,
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

function nonEmptyString(message) {
  return v.pipe(v.string(message), v.trim(), v.minLength(1, message));
}

const runtimeCompatibilitySchema = v.object({
  canonical_picker: v.picklist(COMPATIBILITY_STATUSES),
  direct_invocation: v.picklist(COMPATIBILITY_STATUSES),
});

const runtimeBindingSchema = v.object({
  direct_invocation: nonEmptyString("runtime binding direct_invocation must be a non-empty string"),
  metadata_mode: v.picklist(RUNTIME_METADATA_MODES),
  install_dir_name: nonEmptyString("runtime binding install_dir_name must be a non-empty string"),
  compatibility: runtimeCompatibilitySchema,
});

const requiredToolSchema = v.object({
  id: nonEmptyString("required_tools[].id must be a non-empty string"),
  kind: v.picklist(TOOL_KINDS),
  required_for: v.pipe(v.array(v.picklist(TOOL_PHASES)), v.nonEmpty()),
  check_command: nonEmptyString("required_tools[].check_command must be a non-empty string"),
});

const requiredMcpServerSchema = v.object({
  id: nonEmptyString("required_mcp_servers[].id must be a non-empty string"),
});

const memoryPermissionsSchema = v.object({
  authority_mode: v.picklist(MEMORY_AUTHORITY_MODES),
  explicit_write_only: v.boolean(),
  global_project_memory: v.picklist(MEMORY_ACCESS_LEVELS),
  task_memory: v.picklist(MEMORY_ACCESS_LEVELS),
  session_artifacts: v.picklist(SESSION_ARTIFACT_LEVELS),
  audit_log: v.picklist(AUDIT_LOG_LEVELS),
});

const runtimeAssetEntrySchema = v.object({
  asset_id: nonEmptyString("runtime_assets.entries[].asset_id must be a non-empty string"),
  runtime: v.picklist(RUNTIME_SELECTORS),
  asset_kind: nonEmptyString("runtime_assets.entries[].asset_kind must be a non-empty string"),
  install_surface: nonEmptyString("runtime_assets.entries[].install_surface must be a non-empty string"),
  source_path: v.nullable(nonEmptyString("runtime_assets.entries[].source_path must be null or non-empty string")),
  generated_path: v.nullable(
    nonEmptyString("runtime_assets.entries[].generated_path must be null or non-empty string"),
  ),
  generator: v.picklist(RUNTIME_ASSET_GENERATORS),
  required: v.boolean(),
  override_eligible: v.boolean(),
});

const assetOwnershipRecordSchema = v.object({
  asset_id: nonEmptyString("asset_ownership.records[].asset_id must be a non-empty string"),
  owner: v.picklist(["pairslash", "user", "system"]),
  uninstall_behavior: v.picklist(UNINSTALL_BEHAVIORS),
});

const assetOwnershipSchema = v.object({
  ownership_file: nonEmptyString("asset_ownership.ownership_file must be a non-empty string"),
  ownership_scope: nonEmptyString("asset_ownership.ownership_scope must be a non-empty string"),
  safe_delete_policy: nonEmptyString("asset_ownership.safe_delete_policy must be a non-empty string"),
  records: v.pipe(v.array(assetOwnershipRecordSchema), v.nonEmpty()),
});

const localOverridePolicySchema = v.object({
  marker_file: nonEmptyString("local_override_policy.marker_file must be a non-empty string"),
  marker_mode: v.picklist(MANIFEST_MARKER_MODES),
  eligible_asset_ids: v.array(nonEmptyString("local_override_policy.eligible_asset_ids[] must be non-empty")),
});

const updateStrategySchema = v.object({
  mode: v.picklist(UPDATE_STRATEGY_MODES),
  on_non_override_change: v.picklist(UPDATE_NON_OVERRIDE_POLICIES),
  rollback_strategy: nonEmptyString("update_strategy.rollback_strategy must be a non-empty string"),
});

const uninstallStrategySchema = v.object({
  mode: v.picklist(UNINSTALL_STRATEGY_MODES),
  detach_modified_files: v.boolean(),
  preserve_unknown_files: v.boolean(),
  remove_empty_pack_dir: v.boolean(),
});

const smokeCheckSchema = v.object({
  id: nonEmptyString("smoke_checks[].id must be a non-empty string"),
  runtime: v.picklist(SUPPORTED_RUNTIMES),
  target: v.picklist(SUPPORTED_TARGETS),
  action: v.picklist(MANIFEST_SMOKE_ACTIONS),
});

const docsRefsSchema = v.object({
  contract: nonEmptyString("docs_refs.contract must be a non-empty string"),
  example_invocation: nonEmptyString("docs_refs.example_invocation must be a non-empty string"),
  example_output: nonEmptyString("docs_refs.example_output must be a non-empty string"),
  validation_checklist: nonEmptyString("docs_refs.validation_checklist must be a non-empty string"),
});

export const packManifestV2Schema = v.object({
  kind: v.literal("pack-manifest-v2"),
  schema_version: v.literal(PHASE4_SCHEMA_VERSION),
  pack_name: nonEmptyString("pack_name must be a non-empty string"),
  display_name: nonEmptyString("display_name must be a non-empty string"),
  pack_version: nonEmptyString("pack_version must be a non-empty string"),
  summary: nonEmptyString("summary must be a non-empty string"),
  category: nonEmptyString("category must be a non-empty string"),
  workflow_class: v.picklist(WORKFLOW_CLASSES),
  phase: v.integer(),
  status: v.picklist(PACK_STATUSES),
  canonical_entrypoint: v.literal("/skills"),
  release_channel: v.picklist(RELEASE_CHANNELS),
  supported_runtimes: v.pipe(v.array(v.picklist(SUPPORTED_RUNTIMES)), v.nonEmpty()),
  supported_runtime_ranges: v.object({
    codex_cli: nonEmptyString("supported_runtime_ranges.codex_cli must be a non-empty string"),
    copilot_cli: nonEmptyString("supported_runtime_ranges.copilot_cli must be a non-empty string"),
  }),
  runtime_bindings: v.object({
    codex_cli: runtimeBindingSchema,
    copilot_cli: runtimeBindingSchema,
  }),
  install_targets: v.pipe(v.array(v.picklist(SUPPORTED_TARGETS)), v.nonEmpty()),
  capabilities: v.pipe(v.array(v.picklist(CAPABILITY_FLAGS)), v.nonEmpty()),
  risk_level: v.picklist(RISK_LEVELS),
  required_tools: v.array(requiredToolSchema),
  required_mcp_servers: v.array(requiredMcpServerSchema),
  memory_permissions: memoryPermissionsSchema,
  runtime_assets: v.object({
    source_root: nonEmptyString("runtime_assets.source_root must be a non-empty string"),
    primary_skill: nonEmptyString("runtime_assets.primary_skill must be a non-empty string"),
    entries: v.pipe(v.array(runtimeAssetEntrySchema), v.nonEmpty()),
  }),
  asset_ownership: assetOwnershipSchema,
  local_override_policy: localOverridePolicySchema,
  update_strategy: updateStrategySchema,
  uninstall_strategy: uninstallStrategySchema,
  smoke_checks: v.pipe(v.array(smokeCheckSchema), v.nonEmpty()),
  docs_refs: docsRefsSchema,
  trust_descriptor: v.optional(
    nonEmptyString("trust_descriptor must be a non-empty string when present"),
  ),
});

export function safeParsePackManifestV2(input) {
  return v.safeParse(packManifestV2Schema, input);
}

export function parsePackManifestV2(input) {
  return v.parse(packManifestV2Schema, input);
}
