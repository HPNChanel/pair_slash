# PairSlash `pack.manifest.yaml v2` Practical Spec

`pack.manifest.yaml v2` is the Phase 4 pack contract for compiler, installer, update, uninstall, doctor, lint, compat-lab, and future registry/policy readers.

Guardrails:

- Supports exactly `codex_cli` and `copilot_cli`
- Keeps `/skills` as the canonical entrypoint
- Keeps install roots derived in runtime adapters, not inside manifest
- Adds machine-readable ownership/override/update/uninstall semantics without turning into a Phase 5 policy DSL

## Canonical shape

Canonical manifests use `schema_version: "2.1.0"`.

```yaml
kind: pack-manifest-v2
schema_version: "2.1.0"

pack_name: pairslash-plan
display_name: PairSlash Plan
pack_version: "0.4.0"
summary: Create a structured execution plan before code changes.
category: planning
workflow_class: read-oriented
phase: 2
status: active
canonical_entrypoint: /skills
release_channel: stable

supported_runtimes:
  - codex_cli
  - copilot_cli
supported_runtime_ranges:
  codex_cli: ">=0.116.0"
  copilot_cli: ">=0.0.0"

runtime_bindings:
  codex_cli:
    direct_invocation: $pairslash-plan
    metadata_mode: openai_yaml_optional
    install_dir_name: pairslash-plan
    compatibility:
      canonical_picker: supported
      direct_invocation: supported
  copilot_cli:
    direct_invocation: /pairslash-plan
    metadata_mode: none
    install_dir_name: pairslash-plan
    compatibility:
      canonical_picker: supported
      direct_invocation: unverified

install_targets:
  - repo
  - user

capabilities:
  - plan_generation
  - repo_read
  - memory_read
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

runtime_assets:
  source_root: packs/core/pairslash-plan
  primary_skill: SKILL.md
  entries:
    - asset_id: skill
      runtime: shared
      asset_kind: skill_markdown
      install_surface: canonical_skill
      source_path: SKILL.md
      generated_path: null
      generator: source_copy
      required: true
      override_eligible: true
    - asset_id: codex-metadata
      runtime: codex_cli
      asset_kind: runtime_manifest
      install_surface: metadata
      source_path: null
      generated_path: agents/openai.yaml
      generator: codex_metadata
      required: true
      override_eligible: false

asset_ownership:
  ownership_file: pairslash.install.json
  ownership_scope: pack_root
  safe_delete_policy: pairslash-owned-only
  records:
    - asset_id: skill
      owner: pairslash
      uninstall_behavior: detach_if_modified
    - asset_id: codex-metadata
      owner: pairslash
      uninstall_behavior: detach_if_modified
    - asset_id: ownership-receipt
      owner: pairslash
      uninstall_behavior: remove_if_unmodified

local_override_policy:
  marker_file: .pairslash.local-overrides.yaml
  marker_mode: state_or_explicit_marker
  eligible_asset_ids:
    - skill

update_strategy:
  mode: preserve_valid_local_overrides
  on_non_override_change: block
  rollback_strategy: restore_last_managed_state

uninstall_strategy:
  mode: pairslash_owned_only
  detach_modified_files: true
  preserve_unknown_files: true
  remove_empty_pack_dir: true

smoke_checks:
  - id: codex-repo-preview-install
    runtime: codex_cli
    target: repo
    action: preview_install
  - id: copilot-user-doctor
    runtime: copilot_cli
    target: user
    action: doctor

docs_refs:
  contract: contract.md
  example_invocation: example-invocation.md
  example_output: example-output.md
  validation_checklist: validation-checklist.md
```

## Field semantics

- `pack_name`: canonical machine id; lowercase kebab-case; source root leaf, install dir leaf, and direct invocation suffix must align to this value.
- `display_name`: human-facing label for doctor, registry, and docs.
- `pack_version`: pack content version; not compiler version and not runtime version.
- `supported_runtimes`: exact runtime set. Phase 4 only allows `codex_cli` and `copilot_cli`.
- `supported_runtime_ranges`: semver-like runtime floors; accepted format is exact `x.y.z` or `>=x.y.z`.
- `runtime_bindings`: runtime-specific invocation and metadata mode. No absolute install path is allowed here.
- `runtime_assets`: bundle contract. `source_path` means copied source asset; `generated_path` means compiler-emitted runtime artifact relative to pack root.
- `asset_ownership`: uninstall/update ownership contract. Every asset id in `runtime_assets.entries` must have exactly one ownership record.
- `local_override_policy`: declares which asset ids may diverge locally.
- `update_strategy`: Phase 4 update rule. PairSlash preserves valid overrides and blocks non-override drift.
- `uninstall_strategy`: Phase 4 uninstall rule. PairSlash removes only PairSlash-owned unchanged footprint and detaches modified/unknown files.
- `smoke_checks`: scenario descriptors for preview/doctor acceptance, not arbitrary shell scripts.
- `docs_refs`: relative doc paths for contract/example/checklist surfaces.

## Enums

- `workflow_class`: `read-oriented | dual-mode | write-authority`
- `risk_level`: `low | medium | high | critical`
- `memory_permissions.authority_mode`: `read-only | write-authority`
- `memory_permissions.global_project_memory`: `none | read | write`
- `memory_permissions.task_memory`: `none | read | write`
- `memory_permissions.session_artifacts`: `none | implicit-read | read | write`
- `memory_permissions.audit_log`: `none | append`
- `runtime_bindings.*.metadata_mode`: `openai_yaml_optional | none`
- `asset_ownership.records[].uninstall_behavior`: `remove_if_unmodified | detach_if_modified | preserve_unmanaged`
- `smoke_checks[].action`: `preview_install | preview_update | preview_uninstall | doctor`

## Validation rules

- `supported_runtimes`, `supported_runtime_ranges`, and `runtime_bindings` must describe the same exact runtime set.
- `memory_write_global` requires `authority_mode: write-authority`, `global_project_memory: write`, and `risk_level: critical`.
- `required_mcp_servers` requires `mcp_client`.
- `runtime_assets.primary_skill` must appear exactly once as a `skill_markdown` / `canonical_skill` source asset.
- Every asset must declare exactly one of `source_path` or `generated_path`.
- `ownership-receipt` is mandatory, non-override, PairSlash-owned, and must use `remove_if_unmodified`.
- `local_override_policy.eligible_asset_ids` must reference real assets and must never include `ownership-receipt`.
- `uninstall_strategy.mode` must remain `pairslash_owned_only`.

## Migration from legacy `2.0.0`

Legacy `2.0.0` manifests are still accepted in Phase 4 through a compatibility normalizer.

Field mapping:

- `version -> pack_version`
- `pack.id -> pack_name`
- `pack.display_name -> display_name`
- `pack.summary -> summary`
- `pack.category -> category`
- `pack.workflow_class -> workflow_class`
- `pack.phase -> phase`
- `pack.status -> status`
- `runtime_targets -> runtime_bindings`
- `assets + ownership -> runtime_assets + asset_ownership`
- `assets.docs -> docs_refs`
- `local_override_policy.eligible_paths -> local_override_policy.eligible_asset_ids`
- `local_override_policy.strategy + rollback_strategy -> update_strategy`

Legacy manifests now trigger migration warnings in lint/doctor, but they are still loadable. New manifests and rewritten manifests should use canonical `2.1.0`.

## Examples in repo

- Core canonical example: [pack.manifest.yaml](/D:/FOR_WORK/WORK_PROJECT/pair_slash/packs/core/pairslash-plan/pack.manifest.yaml)
- Runtime-targeted/write-authority example: [pack.manifest.yaml](/D:/FOR_WORK/WORK_PROJECT/pair_slash/packs/core/pairslash-memory-write-global/pack.manifest.yaml)
