---
id: T5-08
track: T5
title: Strict batch — policy-engine
status: done
depends_on: [T5-05]
est_size: M
claimed_by: devin
claimed_at: 2026-10-XX
completed_at: 2026-10-XX
evidence:
  strict_baseline_in_scope: 134
  strict_after_in_scope: 0
  typecheck: pass
  lint: pass
  tests: pass
---

## Objective

Fix all strict errors in `packages/core/policy-engine/` — risk taxonomy, verdict evaluation, `explainPolicyVerdict`, `deriveRiskProfile`.

## Context & sources

- Policy engine decides allow/deny/preview-required verdicts — type errors here are safety-critical surfaces. Null-safety pass gets maximum scrutiny.
- Contract tests exist: policy fixtures tests (`policy fixtures keep read-only...`, `authoritative write preview gate stable`) — unmodified.

## Files to touch

- `packages/core/policy-engine/src/*.ts`
- Do NOT touch: tests, callers

## Work steps

1. Baseline count.
2. Mechanical pass → null-safety pass.
3. Special attention: verdict derivation paths — a wrong default could flip allow/deny. Any ambiguous narrowing → check against fixture expectations.
4. Bugs → regression test + note. Count → 0; gates green.
5. Commit `refactor(policy-engine): strict typing`.

## Constraints (STRICT)

- MUST NOT change verdict semantics — deny/preview/allow decisions are behavior-locked by fixtures.
- MUST fail closed in type design: unknown risk inputs → deny-typed paths, not permissive.
- MUST NOT `as any`/`ts-ignore`.
- Deterministic ordering of risk factors/reason codes preserved.

## Acceptance gates

- [x] 0 strict errors in scope; policy fixture tests green unmodified; gates green

## Evidence to record

- Counts; any verdict-path fixes flagged.

## Rollback

`git revert`.
