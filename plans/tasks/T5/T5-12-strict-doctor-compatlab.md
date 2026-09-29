---
id: T5-12
track: T5
title: Strict batch — doctor + compat-lab
status: done
depends_on: [T5-03, T5-11]
est_size: L
claimed_by:
claimed_at:
completed_at: 2026-09-session
evidence:
  baseline: "doctor 16 strict errors; compat-lab 187 strict errors (203 total)"
  final: "0 strict errors in both packages (npm run typecheck:strict)"
  check_coverage: "CHECKS registry 28 entries before=after (57 run* refs identical at HEAD vs worktree; runtime CHECKS.length=28); doctor output ordering unchanged"
  tests: "doctor 44/44; compat-lab 21/21 (acceptance 5, compat-lab 10, docs-surface 3, evals 1, matrix 2); npm run test:compat green; npm run typecheck/lint/test/test:release all green"
  constraints: "no as any/ts-ignore/ts-expect-error in diff; fixture semantics, verdict logic, tests untouched; shim lanes unchanged"
---

## Objective

Fix all strict errors in `packages/tools/doctor/` (post-T5-03 decomposition) and `packages/tools/compat-lab/` — diagnostics + fixture-based compatibility testing.

## Context & sources

- Doctor post-decomposition: `doctor/helpers.ts`, `doctor/checks/*`, `doctor/report.ts` — 69-fns worth of checks incl. new T1-05/T4-04 checks.
- compat-lab: acceptance/matrix/runtime-fixtures modules; shims fake runtime binaries — typing fixture builders correctly matters for lane evidence quality.
- Doctor checks must remain fail-closed (a `Possibly undefined` on an evidence path is a real finding to fix properly, not bypass).

## Files to touch

- `packages/tools/doctor/src/doctor/*.ts`, `packages/tools/compat-lab/src/*.ts`
- Do NOT touch: fixture data files' semantics, verdict logic, tests

## Work steps

1. Baseline count both packages.
2. Mechanical → null-safety pass.
3. Scrutiny: doctor check aggregation (a dropped check = silently weaker doctor — MUST NOT happen), lane-record reading, fixture-shim typing.
4. Count → 0; gates incl. test:compat.
5. Commit `refactor(doctor,compat-lab): strict typing`.

## Constraints (STRICT)

- MUST NOT drop/weaken a doctor check to satisfy types — every check must still run and report.
- MUST NOT `as any`/`ts-ignore`.
- compat-lab fake/shim lanes remain regression-confidence only — typing must not accidentally wire them into live-evidence paths.
- Doctor output ordering preserved.

## Acceptance gates

- [ ] 0 strict errors; doctor + compat-lab tests green; `npm run test:compat` green

## Evidence to record

- Counts; check-coverage preserved (check count before/after equal — assert in evidence).

## Rollback

`git revert`.
