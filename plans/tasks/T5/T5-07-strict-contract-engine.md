---
id: T5-07
track: T5
title: Strict batch — contract-engine
status: done
depends_on: [T5-05]
est_size: M
claimed_by: devin
claimed_at: 2026-10-XX
completed_at: 2026-10-XX
evidence:
  strict_baseline_in_scope: 64
  strict_after_in_scope: 0
  typecheck: pass
  lint: pass
  tests: pass
---

## Objective

Fix all strict errors in `packages/core/contract-engine/` — the workflow output-contract validation layer.

## Context & sources

- Smaller package than spec-core; errors likely concentrated in contract validation + fixture handling.
- Depends on spec-core types — T5-05 must be done so imported types resolve cleanly.
- Same ordering: implicit-any class first, null-safety second.

## Files to touch

- `packages/core/contract-engine/src/*.ts`
- Do NOT touch: tests, other packages

## Work steps

1. Baseline count for contract-engine.
2. Mechanical pass → null-safety pass.
3. Contract verdict types must be precise — verdict enums/reason codes typed as literal unions, not `string`.
4. Bugs → regression test + note. Count → 0; gates green.
5. Commit `refactor(contract-engine): strict typing`.

## Constraints (STRICT)

- MUST NOT widen verdict/reason-code types to `string` — the literal unions are the contract surface.
- MUST NOT `as any`/`ts-ignore`.
- MUST keep `evaluate*`/`validate*` signatures identical for callers.
- Real bugs → regression tests.

## Acceptance gates

- [x] 0 strict errors in scope (64 -> 0); gates green; no API change

## Evidence to record

- Before/after counts.

## Rollback

`git revert`.
