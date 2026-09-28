---
id: T1-07
track: T1
title: Regenerate compatibility-matrix + sync derived artifacts + record drift evidence
status: todo
depends_on: [T1-02, T1-03, T1-04, T1-05, T1-06]
est_size: S
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Final T1 consistency pass: regenerate every derived artifact, verify all truth-layer files are mutually consistent, and record the drift-correction event so the next staleness audit has a baseline.

## Context & sources

- EXECUTION §6 truth-layer sync duty: source files (`runtime-surface-matrix.yaml`, manifests, stack profile) → derived (`compatibility-matrix.md`, `registry/packs.yaml`, `90-memory-index.yaml` if touched).
- T1 made several truth edits; this task is the "close the loop" verification — nothing may be left inconsistent.
- Charter `truth_sources` in `00-project-charter.yaml` lists every sync target — check none were orphaned by T1 edits.

## Files to touch

- `docs/compatibility/compatibility-matrix.md` (regenerated)
- `packages/core/spec-core/registry/packs.yaml` (if manifest fields changed)
- `.pairslash/project-memory/90-memory-index.yaml` (if records were touched in T1-02)
- A drift-audit note: `docs-private/compatibility/drift-audit-2026-09.md` (maintainer-local) summarizing staleness found + corrected
- Do NOT touch: source files' meaning — this is consistency verification, not new edits (any inconsistency found routes back to the owning task)

## Work steps

1. `npm run sync:compat-lab` regenerate; diff review — expected deltas only.
2. `npm run sync:compat-lab -- --check` green.
3. Consistency sweep: grep all truth files for stale version strings (`0.116`, `0.118`, `2.50`), stale surface names (legacy picker references), orphaned references.
4. Write `docs-private/compatibility/drift-audit-2026-09.md`: what was stale, what it was corrected to, what remains deferred (e.g., K1/K3 if retests pending).
5. Full gates: lint, test, typecheck, test:release, test:compat.
6. Mark T1 track status `done`.

## Constraints (STRICT)

- MUST NOT leave mixed-version references anywhere — partial realignment is worse than none (it looks verified when it isn't).
- MUST NOT edit verdict docs (`scoped-release-verdict.md`, `phase-3-5/verdict.md`) — T6 owns those.
- Drift-audit note is maintainer-local — do NOT publish it into public docs (D2).
- If the sweep finds something T1 tasks should have changed, fix it in this commit with a note — don't ship known inconsistency.

## Acceptance gates

- [ ] `sync:compat-lab -- --check` green
- [ ] Zero stale version strings in truth files (verified by grep output in evidence)
- [ ] All gates green
- [ ] Drift-audit note written; T1 marked done

## Evidence to record

- Sweep grep outputs; final gate results; drift-audit path; commit hash.

## Rollback

`git revert` — additive consistency commit.
