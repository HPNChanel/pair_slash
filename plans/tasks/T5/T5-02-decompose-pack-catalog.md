---
id: T5-02
track: T5
title: Decompose spec-core/pack-catalog.ts into catalog/ modules + barrel
status: done
depends_on: [T5-01]
est_size: L
claimed_by:
claimed_at:
completed_at: 2026-09-28
evidence:
  - "Export list diff: empty — 14 public names identical pre/post (4 DEFAULT_PUBLIC_* consts + 10 functions), verified mechanically."
  - "Module map: catalog/constants.ts (4 public frozen objects), catalog/helpers.ts (40 private consts+helpers), catalog/workflow-maturity.ts (18), catalog/lane-records.ts (3), catalog/builders.ts (15 incl. all public builders/loaders). pack-catalog.ts is a 21-line named-re-export barrel only."
  - "Import graph is acyclic: helpers→(constants,utils); constants→helpers; workflow-maturity→helpers; lane-records→helpers+workflow-maturity; builders→helpers+lane-records+workflow-maturity. No catalog/*→validate/* edge."
  - "Split tool: .pairslash/tmp/split-pack-catalog.mjs (depth-aware relative imports, default-import handling, comment/string-stripped usage scan)."
  - "Gates: npm run typecheck clean; npm run lint clean; npm test all files green (spec-core 127/127 across 7 test files); npm run test:release passed (11/11 packs, gh publish dry-run verdict pass)."
---

## Objective

Split `packages/core/spec-core/src/pack-catalog.ts` (~86KB, ~66 functions) into `catalog/` submodules with a barrel preserving the public API.

## Context & sources

- Boundaries (per mega-plan): `catalog/constants.ts` (DEFAULT_PUBLIC_* frozen objects), `catalog/helpers.ts` (clone..normalizeEvidenceScopeCollectionForCompare), `catalog/workflow-maturity.ts` (normalizeWorkflowMaturity..resolveWorkflowMaturity, `collect*MaturityBlockers`, `deriveDemotionTriggers`), `catalog/lane-records.ts` (validate* runbook/iso/lane), `catalog/builders.ts` (buildCatalogRuntimeSupport..renderPackCatalogIndexYaml).
- Contract tests: `spec-core/tests/spec-core.test.js` + pack-catalog-related tests — unmodified.

## Files to touch

- `packages/core/spec-core/src/pack-catalog.ts` → barrel
- New: `packages/core/spec-core/src/catalog/{constants,helpers,workflow-maturity,lane-records,builders}.ts`
- Do NOT touch: tests, importers, registry output format

## Work steps

1. Snapshot export list.
2. Create `catalog/` modules; move bodies verbatim per boundary table.
3. Barrel re-exports.
4. Export diff = empty; tests green unmodified.
5. Gates; commit `refactor(spec-core): decompose pack-catalog.ts`.

## Constraints (STRICT)

- Same refactor rules as T5-01: byte-identical API, no test edits, no behavior change, single commit.
- MUST preserve deterministic ordering — catalog builders have ordering-sensitive output; moved code must not reorder (G8).
- Circular-import risk between catalog/* and validate/* — keep dependency direction consistent with existing imports (check before moving).

## Acceptance gates

- [x] Export diff empty
- [x] Tests green unmodified
- [x] Gates green

## Evidence to record

- Export list diff; module map.

## Rollback

`git revert`.
