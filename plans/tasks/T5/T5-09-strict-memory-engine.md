---
id: T5-09
track: T5
title: Strict batch — memory-engine
status: todo
depends_on: [T5-07]
est_size: L
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Fix all strict errors in `packages/core/memory-engine/` — the authoritative write pipeline (preview, apply, conflict, audit, candidate, records).

## Context & sources

- Already decomposed in M1: `apply.ts`, `audit.ts`, `candidate.ts`, `conflict.ts`, `index.ts`, `internal.ts`, `pipeline.ts`, `preview.ts`, `records.ts`, `request.ts`.
- This is the highest-risk package: it owns the write pipeline for `.pairslash/project-memory/`. Null-safety errors here are potential preview/audit bugs — every fix in conflict-detection or staging paths gets scrutinized.
- Depends on contract-engine + policy-engine + spec-core — all three prerequisite batches must be done.
- Contract: memory-engine tests (preview/apply/conflict/audit suite — the 10-test block that takes ~28s) unmodified.

## Files to touch

- `packages/core/memory-engine/src/*.ts`
- Do NOT touch: tests, `.pairslash/` data, audit log formats

## Work steps

1. Baseline count.
2. Mechanical pass → null-safety pass.
3. Scrutiny zones: `conflict.ts` (conflict detection — a wrong narrow silently permits a conflicting write), `preview.ts` (staging artifact handling — TS18048 on artifact paths could mask missing-file paths), `audit.ts` (audit entry writing must not silently no-op), `apply.ts` (write orchestration).
4. Bugs → regression test + note — flag any fix in the write path loudly in commit body.
5. Count → 0; gates green.
6. Commit `refactor(memory-engine): strict typing`.

## Constraints (STRICT)

- MUST NOT weaken the write pipeline's checks to satisfy the compiler — if a type forces the question, the answer is more precise types, not looser validation.
- MUST NOT change audit-log entry shape or staging-artifact paths (they're durable formats — C.7).
- MUST NOT `as any`/`ts-ignore`.
- Any semantic suspicion in write-path code → stop, prove with a test, then fix (X3).

## Acceptance gates

- [ ] 0 strict errors; memory-engine tests green unmodified
- [ ] Gates green
- [ ] Audit/staging formats byte-unchanged (verify by running preview/apply fixture and diffing artifacts)

## Evidence to record

- Counts; write-path fixes (if any) flagged with regression test refs.

## Rollback

`git revert`.
