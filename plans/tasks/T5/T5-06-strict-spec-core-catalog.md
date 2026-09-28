---
id: T5-06
track: T5
title: Strict batch — spec-core (pack-catalog + read-authority)
status: todo
depends_on: [T5-05]
est_size: L
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Fix all strict errors in `catalog/*` (post-T5-02) + `read-authority.ts` + `pack-catalog.ts` barrel — the truth-layer modules with the highest correctness value in the repo.

## Context & sources

- Post-decomposition layout: `catalog/{constants,helpers,workflow-maturity,lane-records,builders}.ts` + `read-authority.ts`.
- These modules compute effective workflow maturity, lane-record validation, catalog rendering — type errors here are truth-layer bugs waiting to happen; null-safety pass gets extra care.
- Same dual ordering: implicit-any class first, null-safety second.

## Files to touch

- `packages/core/spec-core/src/catalog/*.ts`, `read-authority.ts`, `pack-catalog.ts` barrel
- Do NOT touch: other spec-core modules (done T5-05), tests (unless real bug)

## Work steps

1. Baseline strict count for in-scope files.
2. Mechanical pass → null-safety pass (same rules as T5-05).
3. Extra scrutiny on: maturity-blocker collection functions, lane-record validators, evidence-scope normalizers — these decide truth-layer verdicts; type narrowing must be correct, not convenient.
4. Real bugs → fix + regression test + note.
5. Count → 0; gates green.
6. Commit `refactor(spec-core): strict typing for catalog + read-authority`.

## Constraints (STRICT)

- MUST NOT change verdict semantics — a wrong narrow that flips a demotion/blocker decision is a silent policy change (forbidden).
- MUST NOT use `as any`/`ts-ignore`.
- MUST verify deterministic ordering preserved (catalog output is diffed).
- Real bugs found → MUST get regression tests proving the buggy path.

## Acceptance gates

- [ ] 0 strict errors in scope
- [ ] Gates green; truth-governance tests green specifically
- [ ] No API changes

## Evidence to record

- Error counts; any semantics-affecting fixes flagged loudly in commit body.

## Rollback

`git revert`.
