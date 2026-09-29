---
id: T5-13
track: T5
title: Strict batch — cli + lint-bridge (final package batch)
status: done
depends_on: [T5-12]
est_size: M
claimed_by:
claimed_at:
completed_at: 2026-09-session
evidence:
  baseline: "492 strict errors total: cli 112, lint-bridge 200, runtimes stragglers 184 (codex adapter 85 + compiler 4, copilot adapter 87 + compiler 4) — stragglers folded in as T5-13b per step 5"
  final: "npm run typecheck:strict repo-total = 0; npm run typecheck green"
  tests: "cli 55/55; lint-bridge 32/32; codex adapter 9/9; codex compiler 13/13; copilot adapter 10/10; copilot compiler 17/17; npm run test green; npm run lint 0 errors; npm run test:release pass"
  constraints: "no as any/ts-ignore/ts-expect-error; no output-format or verdict changes; runtime adapter resolvers made repoRoot-required (they crash on undefined anyway)"
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
