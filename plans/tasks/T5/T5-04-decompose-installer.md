---
id: T5-04
track: T5
title: Decompose installer/index.ts into lifecycle modules + barrel
status: done
depends_on: []
est_size: L
claimed_by:
claimed_at:
completed_at: 2026-09-28
evidence:
  - "Export diff: empty — public surface identical: 7 exported fns (planInstall/applyInstall/planUpdate/applyUpdate/planUninstall/applyUninstall/loadStateForDoctor) + re-exports (resolveStatePath; detectRuntimeSelection+satisfiesRuntimeRange; 6 semantics fns) preserved verbatim in barrel."
  - "Module map: installer/helpers.ts (16 private consts + cross-cutting helpers incl. applyMutationWithRollback, digest/ownership utils), installer/plan.ts (14 preview-plan builders + createPlan/compileSelection), installer/state.ts (5: state-pack builders + loadStateForDoctor), installer/environment.ts (7: boundary inspection, tool checks, resolve*Environment), installer/journal.ts (4: journal path/build/write/rollback), installer/install.ts (3), installer/update.ts (5), installer/uninstall.ts (3). helpers.ts added vs plan list to hold private consts+cross-module helpers without kitchen-sink coupling."
  - "Journal-path spot-check: resolveJournalPath/buildMutationJournal/writeJournal/rollbackInstallJournal moved verbatim into installer/journal.ts; rollback semantics exercised by unmodified tests (install/update/uninstall rollback cases all pass)."
  - "Split tool: .pairslash/tmp/split-installer.mjs; bare `export { X };` tail statements rewritten to `export { X } from \"<source>\";` in barrel."
  - "Gates: installer tests 47/47 unmodified; typecheck clean; lint clean; npm test all green; test:release pass (11/11 packs)."
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

- [x] Export diff empty
- [x] Installer tests green unmodified
- [x] `npm run test:release` green
- [x] Gates green

## Evidence to record

- Module map; export diff; journal-path spot-check note.

## Rollback

`git revert`.
