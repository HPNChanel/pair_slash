# Runtime Mapping

Phase 4 keeps one source spec and two runtime-native outputs.

- Source of truth: `packs/core/<pack-id>/pack.manifest.yaml`
- Shared pipeline: manifest -> normalized IR -> runtime emitter -> managed install state
- Canonical entrypoint: `/skills`
- Direct invocation: metadata only, not a second product surface

Use the runtime-specific pages in this directory when you need the exact file and
install-surface mapping that compiler, installer, uninstall, doctor, and lint
all rely on.

- [Codex CLI mapping](./codex-cli.md)
- [GitHub Copilot CLI mapping](./copilot-cli.md)
- [Pilot acceptance lanes](./pilot-acceptance.md)

## Rules

- Do not add install-root literals to `pack.manifest.yaml`.
- Do not add a third runtime.
- Do not treat derived runtime folders as source.
- Do not bypass preview or dry-run for environment mutations.

## Compiler contract

- Common manifest authority: `runtime_bindings`, `runtime_assets.entries`, `asset_ownership.records`, `local_override_policy.eligible_asset_ids`, `update_strategy`, and `uninstall_strategy`.
- Runtime-specific lowering: Codex consumes `codex_*` generators; Copilot consumes `copilot_*` generators; `source_copy` and `pairslash_ownership_receipt` are shared compiler behaviors.
- Valid fallback: legacy `2.0.0` manifests may still normalize into canonical `2.1.0`, but compiler code must read canonical fields only after normalization.
- Intentionally unsupported in Phase 4: third runtimes, undocumented custom slash surfaces, dynamic hook engines, contract evaluation, and policy execution.
