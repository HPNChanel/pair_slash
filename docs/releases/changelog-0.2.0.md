# PairSlash 0.2.0 Changelog Draft

Status: draft, not yet published

## Release scope

- Project release: `0.2.0`
- Formalized pack releases in scope:
  - `pairslash-plan` pack version `0.2.0`
  - `pairslash-backend` pack version `0.2.0`
  - `pairslash-frontend` pack version `0.2.0`
  - `pairslash-devops` pack version `0.2.0`
  - `pairslash-release` pack version `0.2.0`
- Registry-backed formalization remains limited to the entries present in
  `packages/spec-core/registry/packs.yaml`

## Breaking changes

- None in validated runtime behavior
- None in Global Project Memory write authority or schema-migration behavior
- Supported runtimes remain `codex-cli` and `github-copilot-cli`

## Additive changes

- Added a versioned pack metadata schema at
  `packages/spec-core/schemas/pack-metadata.schema.yaml`
- Added a versioned pack registry schema at
  `packages/spec-core/schemas/pack-registry.schema.yaml`
- Added the registry manifest at `packages/spec-core/registry/packs.yaml`
- Added formal pack metadata for `pairslash-plan` at
  `packs/core/pairslash-plan/pack.yaml`
- Added formal team-pack metadata and source artifacts for `pairslash-backend`,
  `pairslash-frontend`, `pairslash-devops`, and `pairslash-release`
- Added validation coverage to keep spec, contract, pack metadata, registry,
  and compatibility docs aligned

## Documentation and compatibility updates

- Updated `README.md` to present the repo as release `0.2.0`
- Updated `docs/compatibility/compatibility-matrix.md` to state that registry
  membership is authoritative for formalized-pack support
- Added release summary, upgrade notes, and release checklist artifacts under
  `docs/releases/`

## Pack version summary

- `pairslash-plan`: `0.2.0` (`active`, registry-backed, formalized)
- `pairslash-backend`: `0.2.0` (`active`, registry-backed, runtime surfaces unverified`)
- `pairslash-frontend`: `0.2.0` (`active`, registry-backed, runtime surfaces unverified`)
- `pairslash-devops`: `0.2.0` (`active`, registry-backed, runtime surfaces unverified`)
- `pairslash-release`: `0.2.0` (`active`, registry-backed, runtime surfaces unverified`)

## Validation status captured by this draft

- Validated locally: `python scripts/phase2_checks.py --all`
- Validated locally: `python -m unittest discover -s tests -p "test_*.py"`
- Still manual: live runtime verification steps in
  `docs/compatibility/runtime-verification.md`
