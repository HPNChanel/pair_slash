---
id: T5-04
track: T5
title: Decompose installer/index.ts into lifecycle modules + barrel
status: todo
depends_on: []
est_size: L
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Split `packages/tools/installer/src/index.ts` (~94KB, ~63 functions) into lifecycle submodules with a barrel preserving the public API.

## Context & sources

- Boundaries (per mega-plan): `installer/plan.ts` (createPlan, buildOperation, buildAssetDiff, manifestSelection, compileSelection), `installer/state.ts` (buildStatePack, trust receipts, loadStateForDoctor), `installer/environment.ts` (runRequiredToolChecks, resolve*Environment, boundary inspection), `installer/journal.ts` (mutation journal, rollback), `installer/install.ts` (buildInstallOperations, planInstall, applyInstall), `installer/update.ts` (buildUpdateOperations, planUpdate, applyUpdate, validateManagedOwnershipFile), `installer/uninstall.ts` (buildUninstallOperations, planUninstall, applyUninstall).
- Contract: `installer/tests/installer.test.js` unmodified.

## Files to touch

- `packages/tools/installer/src/index.ts` → barrel
- New: `packages/tools/installer/src/installer/{plan,state,environment,journal,install,update,uninstall}.ts`
- Do NOT touch: tests, CLI call sites, journal format, ownership receipt format

## Work steps

1. Snapshot exports.
2. Create submodules; move bodies verbatim per boundary table.
3. Barrel re-export; verify export diff empty.
4. Installer tests unmodified green; gates incl. `test:release` (installer is release-relevant).
5. Commit `refactor(installer): decompose index.ts into lifecycle modules`.

## Constraints (STRICT)

- MUST preserve journal/rollback semantics exactly — the mutation journal is a safety surface; a subtle reorder is a real bug.
- MUST keep operation ordering deterministic (install plans are diffed in previews — ordering drift breaks user trust).
- Byte-identical public exports; no test edits; single commit.
- If T3-07 (--emit plugin) touched installer first, integrate its additions into the same domain modules.

## Acceptance gates

- [ ] Export diff empty
- [ ] Installer tests green unmodified
- [ ] `npm run test:release` green
- [ ] Gates green

## Evidence to record

- Module map; export diff; journal-path spot-check note.

## Rollback

`git revert`.
