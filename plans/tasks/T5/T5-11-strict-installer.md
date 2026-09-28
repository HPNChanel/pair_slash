---
id: T5-11
track: T5
title: Strict batch — installer
status: todo
depends_on: [T5-04, T5-09]
est_size: L
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Fix all strict errors in `packages/tools/installer/` post-decomposition (T5-04) — plan, state, environment, journal, install, update, uninstall modules.

## Context & sources

- Installer owns preview/apply/uninstall for all managed writes — the preview boundary + journal + ownership receipts live here. Null-safety errors in ownership/journal paths are the highest-value fixes.
- Depends on memory-engine (T5-09) for memory-write staging interplay + spec-core types.

## Files to touch

- `packages/tools/installer/src/installer/*.ts` (post-T5-04 layout)
- Do NOT touch: journal format, ownership receipt format, tests

## Work steps

1. Baseline count.
2. Mechanical → null-safety pass.
3. Scrutiny zones: `journal.ts` (rollback correctness — wrong narrow = failed rollback), `state.ts`/`update.ts` ownership checks (ownership false-negative = clobbering unmanaged files; false-positive = blocked legit update), `plan.ts` preview diff paths.
4. Bugs → regression tests + note.
5. Count → 0; gates incl. test:release.
6. Commit `refactor(installer): strict typing`.

## Constraints (STRICT)

- MUST NOT change ownership-receipt matching semantics — clobber protection is a hard invariant (uninstall removes only managed footprint).
- MUST NOT change journal format.
- MUST NOT `as any`/`ts-ignore`.
- Preview/apply parity: types must keep the "apply requires matching preview" invariant visible — don't type-launder it away.

## Acceptance gates

- [ ] 0 strict errors; installer tests green unmodified; test:release green

## Evidence to record

- Counts; ownership/journal-path fixes flagged.

## Rollback

`git revert`.
