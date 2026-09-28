---
id: T0-01
track: T0
title: Triage uncommitted trace WIP — restore green typecheck
status: done
depends_on: []
est_size: S
claimed_by: devin
claimed_at: 2026-09-28
completed_at: 2026-09-28
evidence: "commits 9dd6b64 (trace typing), 2651b6c (test-helper isolation fix, X3); typecheck 7->0, strict 3224->3216, lint+test+test:release green"
---

## Objective

Resolve the uncommitted modifications in `packages/tools/trace/src/{classify,events,ids,retention,store,telemetry}.ts` so `npm run typecheck` returns to green, landing the strict-prep typing work (or surgically reverting what cannot be fixed).

## Context & sources

- Current diff: `git diff packages/tools/trace/` — ~104 insertions of strict-prep typing (TraceContext type, EmitTraceOptions, NodeJS.ErrnoException casts, Map typings).
- `npm run typecheck` currently reports 7 errors: `export.ts` references `workflow_id`/`correlation_id`/`event_type`/`severity` on `TraceEvent`; `retention.ts` arithmetic on `unknown`.
- Prior plan context: `.kilo/plans/1784473291765-mega-decompose-strict-o1-a1.md` Phase 0 intended exactly this commit.

## Files to touch

- `packages/tools/trace/src/events.ts`, `retention.ts`, `store.ts`, `telemetry.ts`, `classify.ts`, `ids.ts`, `export.ts` (fix only)
- `packages/tools/trace/src/` — may add a `types.ts` for shared event typing if needed
- Do NOT touch: anything outside `packages/tools/trace/`; test files unless a real bug is found (then per CONSTRAINTS X3)

## Work steps

1. Run `npm run typecheck` and capture the full error list (baseline).
2. Read the full diff of the 6 modified files; understand the intended `TraceEvent` shape.
3. Extend the `TraceEvent` type/interface so `export.ts` field accesses (`workflow_id`, `correlation_id`, `event_type`, `severity`) are typed — do not weaken export.ts to `any`.
4. Fix `retention.ts` lines ~104/109: add proper type narrowing for the arithmetic (the `unknown` → `number` path needs a guard, not a cast to `any`).
5. Re-run `npm run typecheck` → 0 errors.
6. Run `npm run test` and `npm run lint` → green.
7. Commit: `fix(trace): complete strict-prep typing, restore typecheck gate` — include `Generated with Devin` trailer per repo convention.

## Constraints (STRICT — violations = task failure)

- MUST NOT silence errors with `as any`, `@ts-ignore`, `@ts-expect-error`, or type-loosening of `TraceEvent` to `any`/index signatures. The point of the WIP is stricter typing.
- MUST NOT change runtime behavior — this is a typing-only fix (CONSTRAINTS X3 exception does not apply unless a real bug is found and noted).
- MUST NOT regress `npm run typecheck:strict` error count.
- MUST preserve deterministic output ordering in trace/export code (G8).
- If a needed fix legitimately requires a semantic change, split it: fix typing here, file a separate task for the semantic change.

## Acceptance gates

- [ ] `npm run typecheck` exits 0
- [ ] `npm run test` exits 0
- [ ] `npm run lint` exits 0
- [ ] `git diff` contains no `as any`/`@ts-ignore` additions
- [ ] `npm run typecheck:strict` error count ≤ baseline

## Evidence to record

- Commit hash in task frontmatter `evidence`.
- Before/after error count pasted into commit body or task evidence note.

## Rollback

`git revert <commit>` — the change is typing-only; revert restores the prior (red) typecheck state, which is why landing it promptly matters.
