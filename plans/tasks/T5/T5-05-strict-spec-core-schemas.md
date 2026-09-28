---
id: T5-05
track: T5
title: Strict batch — spec-core (schemas/constants/utils)
status: todo
depends_on: [T5-01, T5-02]
est_size: L
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Fix all strict-mode TypeScript errors in spec-core's foundational modules (constants, utils, manifest schemas, project-memory, ir, runtime-asset-ir) — noImplicitAny-class first (mechanical), then null-safety class.

## Context & sources

- Strategy from mega-plan: fix TS7006/7031/7005/7053/7034 (parameter/binding/var/index implicit-any — ~2,577 of ~3,331 total across repo) first as mechanical annotation work; then TS2322/2339/2345/18046/18048/18047 (assignability + null-safety) with more care — these may reveal real bugs.
- Progress measure: `npm run typecheck:strict` total error count — record before/after.
- spec-core is dependency root — other packages' batches assume its types are clean.

## Files to touch

- `packages/core/spec-core/src/` — all non-catalog modules (catalog handled T5-06): `constants.ts`, `utils.ts`, `manifest*.ts`, `manifest-v2.*`, `project-memory.ts`, `ir.ts`, `runtime-asset-ir.ts`, `runtime-range.ts`, `runtime-support.ts`, `validate/*` (post-T5-01 layout), `compile.ts`, `ownership-receipt.ts`, `release-trust.ts`, `benchmark-truth.ts`, `validate-phase5.ts`, `index.ts`
- Do NOT touch: `pack-catalog.ts`/`catalog/*` (T5-06), tests (unless a real bug → regression test + note)

## Work steps

1. Baseline: `npm run typecheck:strict 2>&1 | grep spec-core | wc -l` → record.
2. Mechanical pass: annotate implicit-any params/bindings/vars (TS7006/7031/7005/7053/7034).
3. Null-safety pass: TS18048/18047/2322/2339/2345 — prefer proper narrowing (`if`, optional chaining, type guards) over `!` assertions; a `!` requires justification comment.
4. If a fix reveals a real bug → fix + regression test + commit note (X3).
5. `typecheck:strict` spec-core count → 0 for in-scope files; `npm run typecheck` green; tests green.
6. Commit `refactor(spec-core): strict typing for schemas/constants/utils`.

## Constraints (STRICT)

- MUST NOT use `as any`, `@ts-ignore`, `@ts-expect-error` — existing count is 0 and stays 0 (M3.2 landed `isOneOf<T>` helpers; reuse that pattern).
- MUST NOT change runtime behavior — annotate, don't refactor semantics; if semantics must change to type correctly, that's the "real bug" path.
- MUST keep public export signatures stable — typing changes must not alter call-site expectations downstream packages rely on (verify by running full test suite).
- Batch boundary: only in-scope files — don't bleed into catalog or other packages mid-task.
- Prefer precise types over `unknown` widening; where `unknown` is correct, add narrowing at use sites.

## Acceptance gates

- [ ] `typecheck:strict` reports 0 errors in in-scope files
- [ ] `npm run typecheck`, `npm run test`, `npm run lint` green
- [ ] No `as any`/`ts-ignore` additions
- [ ] Public API export names unchanged

## Evidence to record

- Before/after strict-error counts; bug fixes (if any) with regression test refs.

## Rollback

`git revert` — typing-only change.
