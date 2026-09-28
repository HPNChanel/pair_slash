---
id: T0-02
track: T0
title: Remove stray artifacts and harden ignores
status: todo
depends_on: [T0-01]
est_size: S
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Delete stray root artifacts (`firebase-debug.log`, `.git_commit_msg`, empty `dist/`) and ensure `.gitignore` prevents recurrence without over-ignoring legitimate outputs.

## Context & sources

- `firebase-debug.log` (14.5KB, Jul 25) — Firebase tooling log with no corresponding firebase config in repo; leak-risk and noise.
- `.git_commit_msg` (Jul 12) — leftover commit-message scratch file.
- `dist/` exists but is empty — the publish-lane `dist/` is T7's concern; an empty tracked dir serves nothing. Check `git ls-files dist` before deleting: if nothing is tracked inside, simply remove the directory from disk; if `.gitkeep` or similar is tracked, evaluate intent.
- `.gitignore` already covers OS/editor noise — verify it covers `firebase-debug.log`, `*.log`, `.git_commit_msg`-style scratch files.

## Files to touch

- Delete: `firebase-debug.log`, `.git_commit_msg`, `dist/` (if untracked-or-empty)
- Edit: `.gitignore` (add `firebase-debug.log`, `*.log` if absent, scratch-file patterns)
- Do NOT touch: `.pairslash/`, `trust/`, any generated artifact that's actually tracked content (verify each delete with `git ls-files <path>`)

## Work steps

1. `git ls-files firebase-debug.log .git_commit_msg dist` — determine tracked vs untracked status of each.
2. Delete the untracked strays; for any tracked stray, `git rm` it in this commit with justification.
3. Add ignore rules to `.gitignore`: `firebase-debug.log`, `*-debug.log` (if not covered by `*.log`), `.git_commit_msg`, `dist/` — BUT check whether `dist/` is referenced by release scripts as an output dir; if so, ignore `dist/` content but keep the dir creatable (ignore `dist/*` + `!dist/.gitkeep` only if needed).
4. `git status` clean; run lint + test + typecheck.
5. Commit: `chore(repo): remove stray artifacts and harden .gitignore`.

## Constraints (STRICT)

- MUST NOT delete anything tracked that a script produces intentionally (check `scripts/` references first — e.g., `dist/sbom.cyclonedx.json` expectations).
- MUST NOT add ignore rules that would hide source (e.g., do not blanket-ignore `*.yaml`/`*.md`).
- Every deleted path MUST be verified against `git ls-files` before removal — destructive-op discipline.
- No public wording changes.

## Acceptance gates

- [ ] `git status` clean after commit
- [ ] `npm run lint` green
- [ ] `npm run test` green
- [ ] `.gitignore` diff reviewed — only additive ignore patterns

## Evidence to record

- Commit hash; `git ls-files` output for deleted paths recorded in commit body.

## Rollback

`git revert` restores tracked deletions; untracked log files are unrecoverable noise (acceptable — they are debug output, not source).
