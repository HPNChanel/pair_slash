---
id: T2-03
track: T2
title: Adopt scripts/references/assets conventions in both compilers
status: todo
depends_on: [T2-01]
est_size: M
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Align emitted skill directory layouts with the spec's conventional subdirs — `scripts/`, `references/`, `assets/` — so pack auxiliary files (contract.md, example-*.md, validation-checklist.md, scripts) land in spec-conventional places instead of ad hoc roots.

## Context & sources

- Spec dirs: `scripts/` (executable code), `references/` (docs loaded on demand), `assets/` (templates/resources).
- Current pack source layout: `SKILL.md`, `contract.md`, `example-invocation.md`, `example-output.md`, `validation-checklist.md`, `pack.manifest.yaml`, `pack.trust.yaml`, `pack.yaml`, `phase-boundary.md`, `scripts/` (some packs).
- Installed layout (per runtime-mapping docs): assets land at source-relative root or under emitted subdirs — the emitted skill dir should map pack docs → `references/`, helpers → `scripts/`, templates → `assets/`.
- Ownership receipts (`pairslash.install.json`) must cover every emitted file — new layout changes the receipt surface; installer ownership logic must track the new paths.

## Files to touch

- `packages/runtimes/codex/compiler/src/` + `packages/runtimes/copilot/compiler/src/` — asset placement mapping
- `packages/tools/installer/src/` — ownership/uninstall coverage for new subdirs
- `packages/tools/doctor/src/` — owned-file checks may reference paths
- `tests/golden/`, `tests/fixtures/` — updated install plans/goldens
- Do NOT touch: pack *sources* in `packs/` (layout source of truth stays; emitters map it)

## Work steps

1. Inventory current emitted layout per runtime for a sample pack (e.g., pairslash-plan): what lands where today.
2. Design target layout: `SKILL.md` root; docs → `references/`; executables → `scripts/`; templates → `assets/`; manifest/trust remain internal (not emitted as skill files — they stay PairSlash-managed metadata like `pairslash.install.json`).
3. Update compiler asset-placement logic + ownership receipt generation for new paths.
4. Update installer plan/apply/uninstall to handle the subdirs (creation + owned removal only — C.4/C.5).
5. Update doctor owned-file/asset-placement checks.
6. Regenerate goldens + fixtures; diff review (expect path moves, no content changes).
7. Gates: compiler/installer/doctor tests, lint, test, typecheck, test:release (install surface touched).

## Constraints (STRICT)

- MUST keep uninstall footprint exact — PairSlash removes only what it installed (charter: remove only PairSlash-managed footprint); ownership receipts must cover new subdirs before any removal.
- MUST NOT emit PairSlash-internal files (`pack.manifest.yaml`, `pack.trust.yaml`) as user-facing skill content — internal metadata stays in `pairslash.*` receipts/bundles.
- MUST preserve `SKILL.md` at dir root (spec requires root placement).
- MUST keep install preview diffs meaningful — preview output shows the new paths clearly.
- MUST NOT break update path: update must handle old-layout → new-layout migration or fail closed with guidance (no orphaned files left unmanaged).

## Acceptance gates

- [ ] Compiled skills for all core packs follow spec dir conventions
- [ ] Install preview + apply + uninstall round-trip clean on fixtures (no orphans)
- [ ] `npm run test`, `npm run lint`, `npm run typecheck`, `npm run test:release`, `npm run test:compat` green
- [ ] Ownership receipts cover 100% of emitted paths

## Evidence to record

- Layout mapping table (source → emitted) in commit body; round-trip test results.

## Rollback

`git revert` — contained to emitters/installer/goldens; fixtures revert with it.
