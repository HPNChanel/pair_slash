---
id: T1-01
track: T1
title: Verify current runtime versions and surfaces (evidence capture)
status: done
depends_on: []
est_size: M
claimed_by: devin-session
claimed_at: 2026-09-28
completed_at: 2026-09-28
evidence: docs-private/compatibility/runtime-reverification-2026-09.md
---

## Objective

Establish verified ground truth for both runtimes as of execution date — exact install source, current version, and which new surfaces exist — before any truth file is edited. This is the evidence-gathering task every other T1 task cites.

## Context & sources

- Known staleness: matrix says Codex 0.116/0.118 + Copilot "2.50.x". Web evidence shows Codex ~0.157.0 (2026-09-25) and Copilot CLI v1.0.88 (2026-09-21).
- **The "2.50.x" entry is suspect** — real Copilot CLI versions are `v1.0.x`. Determine what "2.50.x" measured (wrong binary? `gh copilot` extension? a typo?). Fix requires understanding what was measured.
- Check authoritative sources: `npm view @openai/codex version`, `gh extension list`/`copilot --version`, GitHub releases, official docs (`developers.openai.com/codex`, `docs.github.com/copilot`).

## Files to touch

- `docs/evidence/live-runtime/` — may add dated verification notes if a real runtime is available to the executor
- `docs-private/` maintainer-local notes if live runtime is unavailable (record as research evidence, not lane evidence)
- Do NOT touch: `runtime-surface-matrix.yaml` (that's T1-02, armed by this task's findings), lane support levels, README

## Work steps

1. Detect installed runtimes: `codex --version`, `copilot --version`, `gh extension list`. Record exact strings + install mechanism (npm/brew/native).
2. If a runtime isn't installed locally, capture registry truth instead: `npm view @openai/codex version` + GitHub releases for Copilot CLI. Label evidence `registry-observed`, NOT `live`.
3. For each runtime record: current stable version, version at the last pairslash-verified pin (0.116/0.118, "2.50.x"), and the feature surfaces observed since (plugins, hooks, daemon, dashboard).
4. Resolve the Copilot "2.50.x" mystery: check git history of `runtime-surface-matrix.yaml` (`git log -p`/`git blame`) for when that string entered and what evidence record supported it.
5. Write findings as a dated research note: `docs-private/compatibility/runtime-reverification-2026-09.md` (maintainer-local) OR a lane-record update if the evidence qualifies as live.
6. Produce a per-lane recommendation table for T1-02 (recommended_version, deterministic_baseline, surface notes).

## Constraints (STRICT)

- MUST NOT promote any lane's `support_level` — this task captures evidence only.
- MUST NOT write "live" evidence class for registry/npm-observed data — the label must match the observation class (C.6 claim discipline).
- MUST NOT edit `runtime-surface-matrix.yaml` or `compatibility-matrix.md` here.
- MUST record what "2.50.x" was measuring before correcting it — if the original measurement basis can't be determined, the record says "origin undetermined, corrected to observed v1.0.x series" — never silently rewrite.
- Live runtime observation requires the real binary; if unavailable, mark the task's live-capture sub-steps as deferred-to-T6 (they're human-in-loop).

## Acceptance gates

- [x] Verified version strings captured with source attribution for both runtimes — Codex `0.153.4` live + `0.158.0` registry; Copilot `1.0.88` registry-observed (`copilot` binary absent on host)
- [x] "2.50.x" origin investigated and documented — resolved: commit `d8bcc70` faked `gh version 2.50.0` (gh CLI version conflated with Copilot CLI version)
- [x] Research/evidence note written to the correct path — `docs-private/compatibility/runtime-reverification-2026-09.md` (maintainer-local; no live copilot capture)
- [x] No truth-file edits in this task
- [x] `npm run lint`, `npm run test` still green

## Evidence to record

- The dated verification note path; npm/GitHub observed versions; git-history finding on "2.50.x".

## Rollback

Pure docs — revert the note file. Nothing else changes.
