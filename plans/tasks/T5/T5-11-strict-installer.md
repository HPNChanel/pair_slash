---
id: T5-11
track: T5
title: Strict batch — installer
status: done
depends_on: [T5-04, T5-09]
est_size: L
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Fix all strict errors in `packages/tools/installer/` post-decomposition (T5-04) — plan, state, environment, journal, install, update, uninstall modules.

## Context & sources

- Installer owns preview/apply/uninstall for all managed writes — the preview boundary + journal + ownership receipts live here. Null-safety errors in ownership/journal paths are the highest-value fixes.
- Depends on memory-engine (T5-09) for memory-write staging interplay + spec-core types.

## Files to touch

- `packages/tools/installer/src/installer/*.ts` (post-T5-04 layout)
- Do NOT touch: journal format, ownership receipt format, tests

## Work steps

1. Baseline count.
2. Mechanical → null-safety pass.
3. Scrutiny zones: `journal.ts` (rollback correctness — wrong narrow = failed rollback), `state.ts`/`update.ts` ownership checks (ownership false-negative = clobbering unmanaged files; false-positive = blocked legit update), `plan.ts` preview diff paths.
4. Bugs → regression tests + note.
5. Count → 0; gates incl. test:release.
6. Commit `refactor(installer): strict typing`.

## Constraints (STRICT)

- MUST NOT change ownership-receipt matching semantics — clobber protection is a hard invariant (uninstall removes only managed footprint).
- MUST NOT change journal format.
- MUST NOT `as any`/`ts-ignore`.
- Preview/apply parity: types must keep the "apply requires matching preview" invariant visible — don't type-launder it away.

## Acceptance gates

- [x] 0 strict errors; installer tests green unmodified; test:release green

## Evidence recorded

- Baseline strict errors (installer): ~548 pre-codemod -> 135 residuals -> 0 final.
- `npm run typecheck` (relaxed CI gate): PASS. `npm run typecheck:strict`: 0 errors in `packages/tools/installer/src/**`.
- `node packages/tools/installer/tests/installer.test.js`: 47/47 pass, unmodified.
- `npm run lint`: PASS. `npm test`: full suite green. `npm run test:release`: PASS.
- Ownership/journal-path decisions flagged:
  - `emit` params were codemod-misannotated as `boolean`; corrected to `string` (emit mode is a validated string union normalized via `normalizeEmitMode`).
  - `safeLstat`/`safeRealpath`/`safeCurrentDigest` annotated with flat `{ ok: boolean; ...?; error?: string }` shapes (discriminated-union narrowing interacts poorly with the relaxed config, so optional fields + `?.` call-site guards were used instead — same runtime semantics).
  - `errors`/`warnings`/`selectedPacks` params made required in the type annotations where bodies dereference them unconditionally (all callers already pass them).
  - `repoRoot` made required `string` where unconditionally `resolve()`d (`planInstall`, `planUpdate`, `planUninstall`, `resolveJournalPath`, `resolveStatePath`, `loadInstallState`, `loadStateForDoctor`, `inspectInstallDirBoundary`, `resolveUpdateSelection`, `compileSelection`, `buildUninstallOperations`, `applyLintPreflight`, `buildCandidateTrustReceipts`, `buildInstallOperations`).
  - `uninstall.ts` `selectedPacks` typed `any[]` (elements are pack objects, not strings — codemod mistyped as `string[]`).
  - `update.ts` ownership digest path: `digest === null || !digest.ok` guard preserves the exact control flow (null is unreachable post-`exists` check but keeps TS honest); `digest?.error` interpolation unchanged in reachable states.
  - `pickOverallVerdict` precedence map uses `keyof typeof` casts; `runtimeFlag` accepts `string | undefined`; `packId`/`path`/`relativePath` params typed `| null` where defaults are `null`.
  - Catch-site error messages use `error instanceof Error ? error.message : String(error)`.
- No `as any`/`@ts-ignore` introduced; journal format, ownership receipt format, and preview/apply parity unchanged (types only).

## Rollback

`git revert`.
