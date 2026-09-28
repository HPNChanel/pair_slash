---
id: T0-04
track: T0
title: Full baseline gate run + record T0 completion
status: done
depends_on: [T0-01, T0-02, T0-03]
est_size: S
claimed_by: devin
claimed_at: 2026-09-28
completed_at: 2026-09-28
evidence: "all gates green in clean tree; typecheck:strict residual 3216; commits 9dd6b64 2651b6c b2502aa 5255c47"
---

## Objective

Run the complete gate suite on the stabilized tree, record the baseline evidence, and mark T0 exited — the formal unblocking event for all other tracks.

## Context & sources

- Baseline reference commands from `AGENTS.md` + `package.json` scripts.
- This task is deliberately small — it is the verification commit, not new work.

## Files to touch

- `plans/tracks/T0-stabilize-repo.md` — flip status to `done` in the track header if a status field exists, or add a completion note
- `plans/tasks/T0/*.md` — status fields set by their own commits; this task only verifies
- `.pairslash/audit-log/` — append a durable note ONLY if the repo convention records non-memory operational events there (check existing audit-log format first; if audit-log is write-authority-only, record evidence in the commit body instead — do NOT bypass memory authority rules)
- Do NOT touch: source code

## Work steps

1. `git status` — confirm clean on `main`.
2. Run in order and capture tail output: `npm run lint`, `npm run test`, `npm run typecheck`, `npm run typecheck:strict` (record error count), `npm run sync:compat-lab -- --check`, `npm run test:release`, `npm run test:compat`.
3. Record results + `typecheck:strict` residual error count into the commit body (this becomes the T5 progress baseline).
4. Update `plans/tracks/T0-stabilize-repo.md` status → `done` with date.
5. Commit: `chore(t0): baseline gate verification — all green, strict residual N`.

## Constraints (STRICT)

- MUST NOT mark T0 done with any gate red — if anything fails, fix-forward under the responsible earlier task (revert it to todo) rather than waving through.
- MUST NOT write to `.pairslash/project-memory/` (C.3 — this task is not a write-authority workflow).
- MUST record the residual strict error count accurately — this number drives T5.

## Acceptance gates

- [ ] All gates green in one clean tree
- [ ] `typecheck:strict` residual count recorded
- [ ] T0 track file marked done
- [ ] No source diffs in this commit except docs/status fields

## Evidence to record

- Gate outputs summarized in commit body; `typecheck:strict` residual count; commit hash.

## Rollback

Revert commit — other tracks simply don't start until re-verified.
