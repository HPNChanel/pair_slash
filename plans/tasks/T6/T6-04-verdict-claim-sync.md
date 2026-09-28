---
id: T6-04
track: T6
title: Update verdict docs + claim sync (only if evidence moved)
status: todo
depends_on: [T6-01, T6-02, T6-03]
est_size: S
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Synchronize every claim-bearing doc with whatever T6 evidence actually produced — verdict files, program charter stage statement, README support table — staying exactly at the evidence boundary.

## Context & sources

- Claim-bearing surfaces: `docs/validation/phase-3-5/verdict.md`, `docs/releases/scoped-release-verdict.md`, `docs/phase-12/authoritative-program-charter.md` (stage sentence), `README.md` (support status block), `.pairslash/project-memory/00-project-charter.yaml` (`stage_statement`, `truth_sources` pointers).
- Rule: wording moves ONLY as far as evidence moved. R1/R2/R3 partial completion → partial wording updates + dated gaps.
- EXECUTION §6 sync duty applies across all downstream renderings.

## Files to touch

- The verdict/charter/README files listed above — surgical edits only where evidence moved
- `compatibility-matrix.md` regenerated if lanes moved
- Do NOT touch: files whose evidence didn't move (leave them; they're still true)

## Work steps

1. For each verdict file: if its gate evidence landed in T6, update per the file's own update rules; else leave with dated "still holds" note where the convention requires one.
2. Charter stage sentence + stack/project-memory `stage_statement`: update only to the true new stage.
3. README support table: mirror the matrix exactly (it's derived truth — no editorializing).
4. Truth-governance tests (`tests/truth-governance.test.js` etc.) verify no claim outruns evidence — they must pass.
5. Gates; commit `docs(t6): sync claims to recorded evidence`.

## Constraints (STRICT)

- MUST NOT strengthen any claim without the evidence record existing in-repo first (C.6 — ladder enforced by truth-governance tests).
- MUST NOT soften a NO-GO to ambiguous language — either it flips on evidence or stays explicit.
- MUST keep charter truth-source pointers accurate — if files moved, pointers update.
- MUST NOT update `.pairslash/project-memory/` outside the memory-write conventions used in T1-02 (same precedent applies).

## Acceptance gates

- [ ] All claim surfaces consistent with recorded evidence
- [ ] Truth-governance tests green
- [ ] Gates green

## Evidence to record

- Per-file claim deltas + evidence refs in commit body.

## Rollback

`git revert`.
