# PairSlash `pack.manifest.yaml v2` Practical Spec

This spec is intentionally compact and validator-first.
It is scoped to Phase 4 runtime-native distribution/installability only.

## Decision summary

- `pack.manifest.yaml v2` is the single install/distribution contract per pack.
- It must be readable by compiler, installer, uninstall, update, doctor, and registry bridge logic.
- Runtime install paths stay derived in adapters; they do not appear in the manifest.
- The manifest must support exactly two runtimes: `codex_cli` and `copilot_cli`.
- Canonical entrypoint stays `/skills`; direct invocation is runtime-specific metadata only.

## YAML schema skeleton

```yaml
kind: pack-manifest-v2
schema_version: "2.0.0"

version: "0.2.0"

pack:
  id: pairslash-plan
  display_name: PairSlash Plan
  summary: Create a structured execution plan before code changes.
  category: planning
  workflow_class: read-oriented
  phase: 2
  status: active
  canonical_entrypoint: /skills

supported_runtime_ranges:
  codex_cli: ">=0.116.0"
  copilot_cli: ">=0.0.0"

install_targets:
  - repo
  - user

capabilities:
  - plan_generation
  - repo_read
  - memory_read

risk_level: low

required_tools:
  - id: rg
    kind: binary
    required_for:
      - run
      - doctor
    check_command: "rg --version"

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
  include:
    - contract.md
    - example-invocation.md
    - example-output.md
    - pack.yaml
    - SKILL.md
    - validation-checklist.md
  docs:
    contract_file: contract.md
    example_invocation_file: example-invocation.md
    example_output_file: example-output.md
    validation_checklist_file: validation-checklist.md

ownership:
  ownership_file: pairslash.install.json
  ownership_scope: pack_root
  safe_delete_policy: pairslash-owned-only
  record_generated_files: true
  generated_files:
    - pairslash.install.json

local_override_policy:
  strategy: preserve_valid_local_overrides
  eligible_paths:
    - contract.md
    - example-invocation.md
    - example-output.md
    - pack.yaml
    - SKILL.md
    - validation-checklist.md
  marker_file: .pairslash.local-overrides.yaml
  marker_mode: state_or_explicit_marker
  rollback_strategy: restore_last_managed_state

release_channel: stable

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

## Field guide

- `kind`: fixed discriminator, must be `pack-manifest-v2`.
- `schema_version`: manifest schema version, fixed to `2.0.0` for Phase 4.
- `version`: pack content version; this is the pack version, not the runtime or compiler version.
- `pack.id`: canonical pack id, lowercase kebab-case, must match install dir name and direct invocation suffix.
- `pack.display_name`: human-facing pack name for docs/doctor/registry bridge output.
- `pack.summary`: short operator summary.
- `pack.category`: registry/UX grouping, for example `planning`, `backend`, `memory`.
- `pack.workflow_class`: one of `read-oriented`, `dual-mode`, `write-authority`.
- `pack.phase`: originating pack phase, preserved for migration bridge and release tracking.
- `pack.status`: `active`, `draft`, or `deprecated`.
- `pack.canonical_entrypoint`: always `/skills`.

- `supported_runtime_ranges`: semver-like floor/range per supported runtime; must contain exactly `codex_cli` and `copilot_cli`.
- `install_targets`: allowed install scopes, limited to `repo` and `user`.
- `capabilities`: normalized behavior flags used by lint/doctor/risk validation.
- `risk_level`: one of `low`, `medium`, `high`, `critical`.
- `required_tools`: runtime/tool prerequisites doctor can check before install/use.
- `required_mcp_servers`: MCP dependencies; empty for most Phase 4 packs.

- `memory_permissions`: authoritative memory contract.
- `memory_permissions.authority_mode`: `read-only` or `write-authority`.
- `memory_permissions.explicit_write_only`: must stay `true`; read workflows cannot silently write memory.
- `memory_permissions.global_project_memory`: `none`, `read`, or `write`.
- `memory_permissions.task_memory`: `none`, `read`, or `write`.
- `memory_permissions.session_artifacts`: `none`, `implicit-read`, `read`, or `write`.
- `memory_permissions.audit_log`: `none` or `append`.

- `assets`: canonical source bundle compiled into runtime-native footprints.
- `assets.pack_dir`: source-of-truth directory under `packs/core/<id>`.
- `assets.primary_skill_file`: usually `SKILL.md`.
- `assets.include`: deterministic list of source files to compile/install.
- `assets.docs.*`: optional explicit docs pointers for registry bridge and validation.

- `ownership`: uninstall and safe-delete contract.
- `ownership.ownership_file`: generated manifest of owned footprint, must be `pairslash.install.json`.
- `ownership.ownership_scope`: `pack_root` for Phase 4.
- `ownership.safe_delete_policy`: must be `pairslash-owned-only`.
- `ownership.record_generated_files`: if `true`, generated files are included in install ownership state.
- `ownership.generated_files`: generated files expected in compiled output.

- `local_override_policy`: update preservation and rollback contract.
- `local_override_policy.strategy`: must be `preserve_valid_local_overrides`.
- `local_override_policy.eligible_paths`: files allowed to diverge locally without being overwritten.
- `local_override_policy.marker_file`: optional explicit override declaration file.
- `local_override_policy.marker_mode`: `state_or_explicit_marker` for Phase 4.
- `local_override_policy.rollback_strategy`: `restore_last_managed_state`.

- `release_channel`: `stable`, `preview`, or `canary`.
- `runtime_targets`: runtime-specific adapter metadata only; no runtime-specific source duplication allowed.
- `runtime_targets.<runtime>.direct_invocation`: `$<id>` for Codex and `/<id>` for Copilot.
- `runtime_targets.<runtime>.metadata_mode`: adapter-level metadata behavior.
- `runtime_targets.<runtime>.skill_directory_name`: derived install directory leaf, must equal `pack.id`.
- `runtime_targets.<runtime>.compatibility.*`: support signal for doctor/lint bridge, not a separate runtime product spec.

## Core pack example

```yaml
kind: pack-manifest-v2
schema_version: "2.0.0"
version: "0.2.0"
pack:
  id: pairslash-plan
  display_name: PairSlash Plan
  summary: Create a structured execution plan before code changes.
  category: planning
  workflow_class: read-oriented
  phase: 2
  status: active
  canonical_entrypoint: /skills
supported_runtime_ranges:
  codex_cli: ">=0.116.0"
  copilot_cli: ">=0.0.0"
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
assets:
  pack_dir: packs/core/pairslash-plan
  primary_skill_file: SKILL.md
  include:
    - contract.md
    - example-invocation.md
    - example-output.md
    - pack.yaml
    - SKILL.md
    - validation-checklist.md
  docs:
    contract_file: contract.md
    example_invocation_file: example-invocation.md
    example_output_file: example-output.md
    validation_checklist_file: validation-checklist.md
ownership:
  ownership_file: pairslash.install.json
  ownership_scope: pack_root
  safe_delete_policy: pairslash-owned-only
  record_generated_files: true
  generated_files:
    - pairslash.install.json
local_override_policy:
  strategy: preserve_valid_local_overrides
  eligible_paths:
    - contract.md
    - example-invocation.md
    - example-output.md
    - pack.yaml
    - SKILL.md
    - validation-checklist.md
  marker_file: .pairslash.local-overrides.yaml
  marker_mode: state_or_explicit_marker
  rollback_strategy: restore_last_managed_state
release_channel: stable
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

## Validation errors

- `PSM001 invalid-kind`: `kind` is not `pack-manifest-v2`.
- `PSM002 unsupported-schema-version`: `schema_version` is not `2.0.0`.
- `PSM003 invalid-pack-id`: `pack.id` missing, not kebab-case, or does not match source dir leaf.
- `PSM004 pack-dir-mismatch`: `assets.pack_dir` is not `packs/core/<pack.id>`.
- `PSM005 canonical-entrypoint-mismatch`: `pack.canonical_entrypoint` is not `/skills`.

- `PSM010 runtime-range-set-invalid`: `supported_runtime_ranges` does not contain exactly `codex_cli` and `copilot_cli`.
- `PSM011 runtime-target-set-invalid`: `runtime_targets` does not contain exactly `codex_cli` and `copilot_cli`.
- `PSM012 unsupported-runtime`: a third runtime appears anywhere in manifest.
- `PSM013 codex-direct-invocation-invalid`: Codex direct invocation is not `$<pack.id>`.
- `PSM014 copilot-direct-invocation-invalid`: Copilot direct invocation is not `/<pack.id>`.

- `PSM020 primary-skill-not-in-assets`: `assets.primary_skill_file` is missing from `assets.include`.
- `PSM021 assets-include-invalid`: include list empty, duplicated, unsorted, or contains generated files.
- `PSM022 ownership-file-missing-from-generated`: `pairslash.install.json` not declared in `ownership.generated_files`.
- `PSM023 invalid-install-target`: `install_targets` contains unsupported scope.

- `PSM030 invalid-capability-flag`: capability not in allowed enum.
- `PSM031 invalid-risk-level`: risk level not in allowed enum.
- `PSM032 invalid-required-tool`: tool entry missing `id`, `kind`, `required_for`, or `check_command`.
- `PSM033 invalid-required-mcp-server`: MCP requirement entry malformed.

- `PSM040 invalid-memory-permission-shape`: `memory_permissions` malformed.
- `PSM041 write-authority-required`: `global_project_memory: write` without `authority_mode: write-authority`.
- `PSM042 missing-global-write-capability`: global write memory permission without `memory_write_global`.
- `PSM043 explicit-write-only-disabled`: `explicit_write_only` is not `true`.
- `PSM044 invalid-audit-log-permission`: audit log value outside allowed enum.

- `PSM050 invalid-ownership-policy`: `ownership_file`, `ownership_scope`, or `safe_delete_policy` invalid.
- `PSM051 invalid-local-override-policy`: override strategy/marker/rollback invalid.
- `PSM052 override-path-outside-assets`: an override-eligible file is not in `assets.include`.
- `PSM053 generated-file-override-illegal`: generated ownership file is marked override-eligible.

- `PSM060 invalid-release-channel`: `release_channel` is not `stable`, `preview`, or `canary`.
- `PSM061 runtime-compatibility-shape-invalid`: runtime compatibility block missing required keys.

## File/package changes cụ thể

- Added practical spec document: [pack-manifest-v2-practical-spec.md](D:/FOR_WORK/WORK_PROJECT/pair_slash/docs/architecture/pack-manifest-v2-practical-spec.md)

## Implementation plan theo thứ tự commit nhỏ

1. Freeze field set and enums from this spec.
2. Implement parser + validator against this shape in `packages/spec-core`.
3. Map manifest -> compiler/install/doctor inputs.
4. Add golden fixtures for one core pack and one write-authority pack.

## Risks and mitigations

- Nếu manifest chứa install path thật thay vì derived adapter metadata, Phase 5/6 sẽ vỡ one-spec-two-runtimes. Mitigation: chỉ cho `runtime_targets` chứa invocation/metadata mode, không chứa root path.
- Nếu ownership/override policy không nằm ngay trong manifest, update/uninstall sẽ drift khỏi compiler output. Mitigation: giữ `ownership` và `local_override_policy` là required.
- Nếu global memory write không bị khóa bằng capability + authority mode, Phase 6/7 sẽ mất rào chắn an toàn. Mitigation: validator fail cứng ở `PSM041/042/043`.

## Acceptance criteria

- Skeleton trên đủ để validator quyết định pack hợp lệ cho install/update/uninstall/doctor.
- Chỉ có 2 runtime hợp lệ.
- `/skills` luôn là canonical entrypoint.
- Manifest chứa đủ rule cho ownership, local override preservation, repo/user scope, release channel, required tools, MCP, memory permissions.
- Core pack example validate qua parser mà không cần field suy diễn ngoài schema.
