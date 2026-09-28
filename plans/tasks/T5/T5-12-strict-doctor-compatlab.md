---
id: T5-12
track: T5
title: Strict batch — doctor + compat-lab
status: todo
depends_on: [T5-03, T5-11]
est_size: L
claimed_by:
claimed_at:
completed_at:
evidence:
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
