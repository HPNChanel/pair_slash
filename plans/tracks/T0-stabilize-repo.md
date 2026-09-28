# Track T0 — Stabilize the repository

**Status:** Done (2026-09-28) | **Priority:** P0 — hard prerequisite for every other track
**Goal:** Return the working tree to a clean, all-gates-green baseline and remove accumulated drift artifacts so every later track starts from truth, not from a red repo.

## Context

The tree is currently carrying uncommitted strict-typing WIP in `packages/tools/trace` that breaks `npm run typecheck` (7 errors: missing fields on `TraceEvent`, arithmetic on unknowns). Stray files (`firebase-debug.log`, `.git_commit_msg`, empty `dist/` dir) pollute the root. Dependencies are behind: valibot 1.3.1→1.5.0, yaml 2.8.3→2.9.1, @types/node 24.13.3→24.19.0, `packageManager` npm@11.7.0 vs installed 11.14.1.

## Entry gate

- None. This track is the entry point.

## Tasks (ordered)

| Task | Title | Depends on |
| --- | --- | --- |
| T0-01 | Triage uncommitted trace WIP — fix forward to green typecheck | — |
| T0-02 | Remove stray artifacts and harden ignores | T0-01 |
| T0-03 | Bump dependencies (valibot, yaml, @types/node) and realign packageManager | T0-01 |
| T0-04 | Full baseline gate run + commit baseline | T0-01, T0-02, T0-03 |

## Exit gate

- `git status` clean on `main`.
- `npm run lint`, `npm run test`, `npm run typecheck`, `npm run sync:compat-lab -- --check` all green.
- `npm run typecheck:strict` error count ≤ pre-T0 baseline (it must not regress).
- No public wording changes; no claim-ladder movement.

## Risks

- The trace WIP may encode intended behavior, not just typing noise — T0-01 requires reading the diff carefully before deciding fix-forward vs revert; prefer fix-forward since the changes are additive typing.
- Dependency bumps can subtly change YAML/validation output — T0-03 must run full test suite plus golden regeneration checks.
