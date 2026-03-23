# PairSlash 0.2.0 Upgrade Notes

## Who needs to act

- Existing source-pack users: no install-path change required
- Tooling integrators that want formalized pack metadata: update discovery logic
- Release operators: use `docs/releases/release-checklist-0.2.0.md`

## What changed

- The registry-backed formalized pack set is now:
  - `pairslash-plan`
  - `pairslash-backend`
  - `pairslash-frontend`
  - `pairslash-devops`
  - `pairslash-release`
- Formalized-pack metadata now resolves through
  `packages/spec-core/registry/packs.yaml`
- Runtime support claims remain bounded by
  `docs/compatibility/runtime-surface-matrix.yaml`

## Manual upgrade steps

1. Keep existing source-pack installation paths unchanged.
2. If your tooling enumerates packs, read `packages/spec-core/registry/packs.yaml`
   first and treat registry membership as the authority for which packs are
   formalized.
3. Follow each registry entry's `metadata_file` to load pack metadata rather
   than inferring formal support from directory presence under `packs/core/`.
4. Use `docs/compatibility/compatibility-matrix.md` and
   `docs/compatibility/runtime-surface-matrix.yaml` before making runtime
   support claims.

## Validation commands

Run from repo root:

```bash
python scripts/phase2_checks.py --all
python -m unittest discover -s tests -p "test_*.py"
```

## No migration required

- No Global Project Memory migration is required
- No data migration or destructive operation is required
- No runtime expansion is included in this release

## Manual verification still required

- Live CLI verification remains a separate operator step in
  `docs/compatibility/runtime-verification.md`
- Newly added team-pack runtime surfaces remain `unverified` until live checks
  land in the compatibility matrix
- Copilot direct invocation paths remain `unverified` or `blocked` where the
  compatibility matrix says so; this release does not promote them
