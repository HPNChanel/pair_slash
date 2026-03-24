# PairSlash Compiler v2 (Implement-Oriented)

## 1) Decision summary

- Compiler v2 contract is fixed as `spec -> normalized IR -> runtime emitter -> compiled bundle`.
- `pack.manifest.yaml v2` is the single spec input; runtime install paths remain derived in adapters.
- One-spec-two-runtimes is enforced by shared IR and runtime-specific emitters only.
- Canonical entrypoint is always `/skills`; runtime direct invocation is metadata only.
- Write-authority semantics are encoded in IR/output metadata (`write_authority_guarded`) and never inferred ad hoc by installer.

## 2) File/package changes cu the

This design maps to current packages and files:

- Shared contracts and pipeline:
  - `packages/spec-core/src/ir.js`
  - `packages/spec-core/src/compile.js`
  - `packages/spec-core/src/constants.js`
  - `packages/spec-core/src/validate.js`
- Runtime emitters:
  - `packages/compiler-codex/src/index.js`
  - `packages/compiler-copilot/src/index.js`
- Runtime adapters:
  - `packages/runtime-codex-adapter/src/index.js`
  - `packages/runtime-copilot-adapter/src/index.js`

Suggested new contract file for implementation (`d.ts` only, no runtime impact):

- `packages/spec-core/src/compiler-v2-contract.d.ts`

```ts
export type RuntimeId = "codex_cli" | "copilot_cli";
export type InstallTarget = "repo" | "user";
export type WorkflowClass = "read-oriented" | "dual-mode" | "write-authority";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type CapabilityFlag =
  | "plan_generation"
  | "repo_read"
  | "repo_write"
  | "shell_exec"
  | "test_exec"
  | "review_analysis"
  | "memory_read"
  | "memory_write_global"
  | "mcp_client"
  | "preview_emit";

export type AssetKind =
  | "skill_markdown"
  | "support_doc"
  | "context_fragment"
  | "agent_fragment"
  | "config_fragment"
  | "hook_script"
  | "mcp_config"
  | "runtime_manifest"
  | "ownership_manifest";

export type InstallSurface =
  | "canonical_skill"
  | "support_doc"
  | "metadata"
  | "context"
  | "config"
  | "agent"
  | "hook"
  | "mcp";

export interface NormalizedRuntimeSupport {
  semver_range: string;
  direct_invocation: string;
  metadata_mode: string;
  skill_directory_name: string;
  compatibility: {
    canonical_picker: "supported" | "unverified" | "blocked";
    direct_invocation: "supported" | "unverified" | "blocked";
  };
}

export interface NormalizedLogicalAsset {
  logical_id: string;
  asset_kind: AssetKind;
  source_relpath: string | null;
  install_surface: InstallSurface;
  runtime_selector: "shared" | RuntimeId;
  file_name?: string;
  content_type: string;
  generated: boolean;
  override_eligible: boolean;
  write_authority_guarded: boolean;
  stable_sort_key: string;
  sha256: string;
  size: number;
  content?: string;
}

export interface NormalizedPackIr {
  kind: "normalized-pack-ir";
  schema_version: string;
  compiler_version: string;
  manifest_relpath: string;
  manifest_digest: string;
  pack: {
    id: string;
    version: string;
    display_name: string;
    summary: string;
    category: string;
    workflow_class: WorkflowClass;
    phase: number;
    status: "active" | "draft" | "deprecated";
    canonical_entrypoint: "/skills";
    release_channel: "stable" | "preview" | "canary";
    risk_level: RiskLevel;
  };
  policy: {
    install_targets: InstallTarget[];
    capabilities: CapabilityFlag[];
    required_tools: Array<{ id: string; kind: string; semver_range: string }>;
    required_mcp_servers: Array<{ id: string; transport: string; endpoint: string }>;
    memory_permissions: {
      authority_mode: "read-only" | "write-authority";
      explicit_write_only: true;
      global_project_memory: "none" | "read" | "write";
      task_memory: "none" | "read" | "write";
      session_artifacts: "none" | "implicit-read" | "read" | "write";
      audit_log: "none" | "append";
    };
    ownership: {
      ownership_file: "pairslash.install.json";
      ownership_scope: "pack_root";
      safe_delete_policy: "pairslash-owned-only";
      record_generated_files: true;
    };
    local_override_policy: {
      strategy: "preserve_valid_local_overrides";
      eligible_paths: string[];
      marker_file: ".pairslash.local-overrides.yaml";
      marker_mode: "state_or_explicit_marker";
    };
  };
  runtime_support: Record<RuntimeId, NormalizedRuntimeSupport>;
  logical_assets: NormalizedLogicalAsset[];
  asset_summary: {
    total_assets: number;
    by_kind: Record<string, number>;
    by_runtime: Record<string, number>;
  };
}

export interface EmittedFile {
  relative_path: string;
  sha256?: string;
  size?: number;
  generated: boolean;
  override_eligible: boolean;
  write_authority_guarded: boolean;
  asset_kind: AssetKind;
  install_surface: InstallSurface;
  runtime_selector: "shared" | RuntimeId;
  content: string;
}

export interface CompiledPack {
  kind: "compiled-pack";
  schema_version: string;
  compiler_version: string;
  manifest_digest: string;
  normalized_ir_digest: string;
  runtime: RuntimeId;
  runtime_short_name: "codex" | "copilot";
  bundle_kind: "codex-skill-bundle" | "copilot-package-bundle";
  pack_id: string;
  version: string;
  canonical_entrypoint: "/skills";
  direct_invocation: string;
  output_dir: string;
  digest: string;
  normalized_ir: Omit<NormalizedPackIr, "logical_assets"> & {
    logical_assets: Array<Omit<NormalizedLogicalAsset, "content">>;
  };
  files: EmittedFile[];
}
```

## 3) Implementation plan theo thu tu commit nho

1. `spec-core`: lock IR shape + validators + digest contract.
2. `spec-core`: expose shared `compilePack` + `finalizeCompiledPack`.
3. `compiler-codex`: implement emitter-only lowerer from IR.
4. `compiler-copilot`: implement emitter-only lowerer from IR.
5. `runtime-*adapter`: enforce install surface map and output naming.
6. `installer/doctor`: consume compiled metadata only, no re-derivation.
7. `tests`: add golden snapshots for IR and runtime bundles.

Main pipeline signatures:

```ts
// spec-core
function buildNormalizedIr(input: {
  repoRoot: string;
  manifestPath: string;
}): NormalizedPackIr;

function compilePack(input: {
  repoRoot: string;
  manifestPath: string;
  runtime: RuntimeId;
  runtimeAdapter: RuntimeAdapter;
  emitBundle: (ctx: { ir: NormalizedPackIr; runtimeAdapter: RuntimeAdapter }) => EmittedFile[];
  write?: boolean;
  distRoot?: string;
}): CompiledPack;

function finalizeCompiledPack(input: {
  repoRoot: string;
  ir: NormalizedPackIr;
  runtime: RuntimeId;
  runtimeAdapter: RuntimeAdapter;
  emittedAssets: EmittedFile[];
  write?: boolean;
  distRoot?: string;
}): CompiledPack;

function writeCompiledPack(compiledPack: CompiledPack): string;
```

## 4) Risks and mitigations

- Risk: emitters inject runtime-specific policy logic -> two products drift.
  - Mitigation: policy decisions happen only in IR builder; emitters only map surfaces/files.
- Risk: unstable ordering from OS path separator or object traversal.
  - Mitigation: use POSIX relative paths, lexicographic sort, stable JSON/YAML serialization.
- Risk: uninstall/update unsafe if ownership metadata is incomplete.
  - Mitigation: every compiled file carries `asset_kind/install_surface/runtime_selector/override_eligible`.
- Risk: write-authority semantics leak into read-only packs.
  - Mitigation: validator blocks inconsistent `workflow_class` + memory permissions + risk level.

## 5) Acceptance criteria

- Same manifest input produces byte-stable `compiled-pack.digest` and `normalized_ir_digest`.
- Both runtimes compile from same IR and keep `/skills` as canonical entrypoint.
- Codex/Copilot bundles differ only by runtime surface mapping, not policy semantics.
- `pairslash.install.json` includes complete ownership and override metadata for all files.
- Write-authority pack emits guard metadata and runtime guard fragments/hooks.
- MCP-dependent pack emits runtime MCP config for both runtimes.

## 6) Neu co code: tao/sua code that

### Naming and stable ordering rules

- `pack_id`: lowercase kebab-case, reused in output directory and direct invocation.
- Relative file paths in compiled bundles are POSIX style (`/`) for deterministic digest.
- `logical_assets` sorted by `stable_sort_key`; `compiled.files` sorted by `relative_path`.
- Digest input string:
  - `${relative_path}:${sha256}:${asset_kind}:${install_surface}` per line, newline-joined.
- `pairslash.install.json` is always generated and never override-eligible.

### Output files by runtime

Codex (`bundle_kind = codex-skill-bundle`)

- Shared source assets:
  - `SKILL.md`
  - other `assets.include` docs at root
- Runtime generated:
  - `agents/openai.yaml`
  - `fragments/context/runtime-context.md`
  - `fragments/config/pack-config.yaml`
  - `fragments/config/write-authority.yaml` (write-authority only)
  - `fragments/mcp/servers.yaml` (when `required_mcp_servers` non-empty)
  - `pairslash.install.json`
  - `compiled-pack.json`
  - `normalized-ir.json`

Copilot (`bundle_kind = copilot-package-bundle`)

- Shared source assets:
  - `SKILL.md`
  - other `assets.include` docs at root
- Runtime generated:
  - `package/pairslash-bundle.json`
  - `agents/runtime-context.md`
  - `hooks/preflight.yaml` (write-authority or MCP pack)
  - `mcp/servers.yaml` (when `required_mcp_servers` non-empty)
  - `pairslash.install.json`
  - `compiled-pack.json`
  - `normalized-ir.json`

### Ownership metadata contract (`pairslash.install.json`)

```json
{
  "kind": "pairslash-owned-footprint",
  "schema_version": "1.0.0",
  "pack_id": "pairslash-plan",
  "runtime": "codex_cli",
  "ownership_scope": "pack_root",
  "files": [
    {
      "relative_path": "SKILL.md",
      "sha256": "....",
      "generated": false,
      "asset_kind": "skill_markdown",
      "install_surface": "canonical_skill",
      "runtime_selector": "shared",
      "override_eligible": true,
      "override_strategy": "preserve",
      "write_authority_guarded": false,
      "owned_by_pairslash": true
    }
  ]
}
```

### Snapshot/golden checklist

- IR snapshot:
  - read-only core pack
  - write-authority pack
  - MCP-dependent pack
- Runtime golden trees:
  - Codex and Copilot for each fixture above
- Determinism:
  - compile same fixture twice => identical `digest` and file list
- Parity:
  - same pack has equal `manifest_digest`, equal policy block in stripped IR for both runtimes
- Negative tests:
  - third runtime key
  - missing `/skills`
  - invalid write-authority permission/risk/capability combo
  - unsupported install surface in emitter

### Example input spec -> output bundles

Input (minimal practical):

```yaml
version: "2.0.0"
pack:
  id: pairslash-plan
  display_name: PairSlash Plan
  summary: Structured execution planning workflow.
  category: planning
  workflow_class: read-oriented
  phase: 4
  status: active
  canonical_entrypoint: /skills
release_channel: stable
supported_runtime_ranges:
  codex_cli: ">=0.116.0"
  copilot_cli: ">=0.0.0"
install_targets: [repo, user]
capabilities: [plan_generation, repo_read, memory_read]
risk_level: low
required_tools: []
required_mcp_servers: []
memory_permissions:
  authority_mode: read-only
  explicit_write_only: true
  global_project_memory: read
  task_memory: read
  session_artifacts: implicit-read
  audit_log: none
assets:
  pack_dir: packs/core/pairslash-plan
  primary_skill_file: SKILL.md
  include: [SKILL.md, contract.md, validation-checklist.md]
ownership:
  ownership_file: pairslash.install.json
  ownership_scope: pack_root
  safe_delete_policy: pairslash-owned-only
  record_generated_files: true
local_override_policy:
  strategy: preserve_valid_local_overrides
  eligible_paths: [SKILL.md, contract.md]
  marker_file: .pairslash.local-overrides.yaml
  marker_mode: state_or_explicit_marker
runtime_targets:
  codex_cli:
    direct_invocation: $pairslash-plan
    metadata_mode: openai_yaml_optional
    skill_directory_name: pairslash-plan
    compatibility:
      canonical_picker: supported
      direct_invocation: supported
  copilot_cli:
    direct_invocation: /pairslash-plan
    metadata_mode: none
    skill_directory_name: pairslash-plan
    compatibility:
      canonical_picker: supported
      direct_invocation: unverified
```

Expected Codex bundle:

- `SKILL.md`
- `contract.md`
- `validation-checklist.md`
- `agents/openai.yaml`
- `fragments/context/runtime-context.md`
- `fragments/config/pack-config.yaml`
- `pairslash.install.json`
- `compiled-pack.json`
- `normalized-ir.json`

Expected Copilot bundle:

- `SKILL.md`
- `contract.md`
- `validation-checklist.md`
- `package/pairslash-bundle.json`
- `agents/runtime-context.md`
- `pairslash.install.json`
- `compiled-pack.json`
- `normalized-ir.json`
