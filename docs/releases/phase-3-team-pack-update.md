# PairSlash Phase 3 Team-Pack Update

## Release summary

Project release: `0.2.0`

This release adds the Phase 3 team-pack registry and metadata model while
keeping the existing Phase 2 runtime and memory-authority behavior intact.
The current formalized registry-backed pack set is `pairslash-plan`,
`pairslash-backend`, `pairslash-frontend`, `pairslash-devops`, and
`pairslash-release`.

## Companion artifacts

- Changelog draft: `docs/releases/changelog-0.2.0.md`
- Upgrade notes: `docs/releases/upgrade-notes-0.2.0.md`
- Release checklist: `docs/releases/release-checklist-0.2.0.md`

## Included in this release

- `pairslash-plan` formalized as pack version `0.2.0`
- `pairslash-backend` formalized as pack version `0.2.0`
- `pairslash-frontend` formalized as pack version `0.2.0`
- `pairslash-devops` formalized as pack version `0.2.0`
- `pairslash-release` formalized as pack version `0.2.0`
- pack metadata schema: `packages/core/spec-core/schemas/pack-metadata.schema.yaml`
- pack registry schema: `packages/core/spec-core/schemas/pack-registry.schema.yaml`
- pack registry manifest: `packages/core/spec-core/registry/packs.yaml`
- validation and CI coverage for pack metadata and registry consistency

## Compatibility and scope

- Supported runtimes remain `codex-cli` and `github-copilot-cli`
- Canonical entrypoint remains `/skills`
- Direct invocation claims remain evidence-bound by
  `docs/compatibility/runtime-surface-matrix.yaml`
- Registry membership is authoritative for formalized-pack support
- Newly added team packs are formalized in the registry, but their runtime
  surfaces remain `unverified` until live checks land in the compatibility docs
- Other core workflow directories under `packs/core/` remain source packs, not
  formalized registry entries in this release

## Upgrade notes

- Existing source-pack users do not need to change install paths
- Tooling that wants formalized pack metadata should read
  `packages/core/spec-core/registry/packs.yaml` first and follow the referenced
  metadata files
- No Global Project Memory migration is required
- No runtime compatibility expansion is included in this release

## Rollback notes

- Revert the registry, pack metadata, and release-doc changes as one unit if
  release messaging or downstream registry assumptions prove incorrect
- Do not keep the `0.2.0` public version banner without the corresponding
  registry-backed formalization artifacts
