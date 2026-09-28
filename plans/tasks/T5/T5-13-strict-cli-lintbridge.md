---
id: T5-13
track: T5
title: Strict batch — cli + lint-bridge (final package batch)
status: todo
depends_on: [T5-12]
est_size: M
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Fix all strict errors in `packages/tools/cli/` and `packages/tools/lint-bridge/` — the last package batch before the strict flip.

## Context & sources

- CLI: `bin/pairslash.ts` dispatcher + `handlers.ts`, `options.ts`, `explain.ts`, `formatters.ts`, `internals.ts`, `trace-events.ts` (post-M1 decomposition). CLI code touches every package's public API — errors here are mostly missing param annotations + nullable option handling.
- lint-bridge: rule engine over packs — typing errors in rule plumbing could weaken lint enforcement.
- After this task: `typecheck:strict` total = 0 expected (verify).

## Files to touch

- `packages/tools/cli/src/*.ts`, `packages/tools/lint-bridge/src/*.ts`
- Do NOT touch: command semantics, output formats, lint rule verdicts

## Work steps

1. Baseline count.
2. Mechanical → null-safety pass.
3. Scrutiny: CLI option parsing (nullable handling — flags legitimately absent), formatter null paths, lint rule result plumbing.
4. Count → 0; gates green.
5. Verify `typecheck:strict` repo-total = 0 (if not, the stragglers' files become a T5-13b scope in the same commit or a follow-up — do not proceed to T5-14 until 0).
6. Commit `refactor(cli,lint-bridge): strict typing — final package batch`.

## Constraints (STRICT)

- MUST NOT `as any`/`ts-ignore`; no behavior change; no output-format changes (CLI output is scripted-against + golden-tested).
- Lint verdict text changes are forbidden unless a real bug (X3).
- If total count ≠ 0 at task end → fix stragglers in this task; do NOT mark done at non-zero.

## Acceptance gates

- [ ] `npm run typecheck:strict` repo-total = 0
- [ ] All gates green

## Evidence to record

- Final count = 0 output; per-package final tallies.

## Rollback

`git revert`.
