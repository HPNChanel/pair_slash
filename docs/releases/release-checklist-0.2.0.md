# PairSlash 0.2.0 Release Checklist

Status legend:

- `[x]` validated on the current branch
- `[ ]` still requires manual verification before publish

## Artifact coherence

- [x] `README.md` presents release version `0.2.0`
- [x] `packages/core/spec-core/registry/packs.yaml` stays at version `0.2.0`
- [x] `packs/core/pairslash-plan/pack.yaml` stays aligned to pack version `0.2.0`
- [x] `packages/core/spec-core/specs/pairslash-plan.spec.yaml` stays aligned to pack version `0.2.0`
- [x] Registry-backed team packs declare explicit model pins and read-only Global
  Project Memory access in `pack.yaml`
- [x] `docs/compatibility/compatibility-matrix.md` states that registry
  membership is authoritative for formalized-pack support
- [x] Release docs enumerate the current registry-backed formalized pack set

## Validation commands

- [x] `npm run lint`
- [x] `npm run test`

## Manual verification before publish

- [ ] Review `git diff --stat` and confirm no unrelated files are included in
  the release cut
- [ ] Run the live runtime verification checklist in
  `docs/compatibility/runtime-verification.md`
- [ ] Reconfirm that no doc claims exceed the statuses recorded in
  `docs/compatibility/runtime-surface-matrix.yaml`
- [ ] Confirm the Phase 3 pack compatibility summary still marks Codex and
  Copilot support as `not yet validated` unless live runtime evidence was added
- [ ] Confirm release messaging does not imply that all `packs/core/` workflows
  are formalized registry entries
- [ ] Confirm new team-pack runtime surfaces are still described as `unverified`
  until live verification evidence exists

## Docs and examples that must ship together

- [x] `README.md`
- [x] `docs/compatibility/compatibility-matrix.md`
- [x] `docs/releases/phase-3-team-pack-update.md`
- [x] `docs/releases/changelog-0.2.0.md`
- [x] `docs/releases/upgrade-notes-0.2.0.md`
- [x] `docs/releases/release-checklist-0.2.0.md`

## Publish blockers

- [ ] Do not publish if runtime verification evidence has not been reviewed
- [ ] Do not publish if additional unregistered packs are described as
  formalized releases
- [ ] Do not publish if new team packs are described as runtime-supported before
  verification evidence exists
- [ ] Do not publish if the registry, metadata, and compatibility docs drift out
  of version alignment
