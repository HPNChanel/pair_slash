---
id: T5-01
track: T5
title: Decompose spec-core/validate.ts into validate/ modules + barrel
status: todo
depends_on: []
est_size: L
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Split `packages/core/spec-core/src/validate.ts` (~155KB, ~55 exported functions) into focused submodules under `validate/`, keeping `validate.ts` as a barrel re-exporting the byte-identical public API.

## Context & sources

- Decomposition boundaries (from `.kilo/plans/1784473291765-mega-decompose-strict-o1-a1.md` §6): `validate/primitives.ts` (lines ~89–265: push, isObject, validateObject/NonEmptyString/Boolean/StringArray, reason-code validators), `validate/canonical.ts` (lines ~523–938: all `validateCanonical*`), `validate/records/*.ts` (one per exported `validate*Record` grouped: lifecycle, runtime-support, install, observability, explainability).
- Existing tests are the contract: `spec-core/tests/spec-core.test.js`, `manifest-v2.conformance.test.js` — must pass unmodified.

## Files to touch

- `packages/core/spec-core/src/validate.ts` → becomes barrel
- New: `packages/core/spec-core/src/validate/primitives.ts`, `validate/canonical.ts`, `validate/records/*.ts` (grouped per inventory), `validate/helpers.ts` if shared internals needed
- Do NOT touch: tests, importers of validate.ts (barrel keeps API identical), any other package

## Work steps

1. Snapshot current public exports: `grep -n "^export" validate.ts` → save the list (this is the API contract).
2. Create `validate/` dir; move function bodies verbatim into group modules; promote shared internals to `validate/helpers.ts` (unexported from barrel unless already public).
3. Rewrite `validate.ts` as `export * from "./validate/..."` re-exports.
4. Verify: diff exported names pre/post (must be identical); run spec-core tests unmodified.
5. `npm run typecheck` + `npm run lint` green.
6. Commit: `refactor(spec-core): decompose validate.ts into focused modules`.

## Constraints (STRICT)

- MUST preserve public API byte-identically: same export names, same signatures — verify mechanically (export-list diff).
- MUST NOT edit tests (G6) — they pass unmodified or the refactor is wrong.
- MUST NOT change behavior — pure relocation; if a "fix" tempts you, file a separate task (X3).
- MUST keep imports within package boundary rules (lint enforces — verify no cross-package relative imports appear).
- One commit for this file; no mixing with other decompositions.

## Acceptance gates

- [ ] Export-name diff empty (pre vs post)
- [ ] spec-core tests green unmodified
- [ ] `npm run lint`, `npm run test`, `npm run typecheck` green
- [ ] Barrel file is re-exports only (no logic left)

## Evidence to record

- Pre/post export-name list identical; module map in commit body.

## Rollback

`git revert` — single-commit pure refactor.
