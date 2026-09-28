---
id: T4-04
track: T4
title: Codex daemon-aware doctor check (detect/report exec-server)
status: todo
depends_on: []
est_size: S
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Doctor detects and reports Codex's daemon reality (auto-starting `exec-server` since v0.157) as informational state — so lane reports reflect the actual environment — without ever managing the daemon.

## Context & sources

- Codex v0.157: daemon auto-start is stable default; sessions share a persistent `exec-server`; stale-server recovery choices exist.
- PairSlash constraint: detect/report only, never spawn/kill/manage (C.8 — no daemon management inside PairSlash-owned code).
- Relevant: long-running installs/preview flows could interact with a warm daemon; doctor's job is truthful environment reporting.

## Files to touch

- `packages/tools/doctor/src/` — new check (environment/runtime-state group)
- `packages/tools/doctor/tests/` — fixture coverage
- `docs/runtime-mapping/codex-cli.md` — surface note if T1-03 didn't already cover
- Do NOT touch: anything that would start/stop/exec the daemon

## Work steps

1. Design detection: how to detect a running codex exec-server without spawning one (process scan? socket/config presence? — choose the least invasive reliable signal; document choice).
2. Add doctor check `runtime-daemon-state` (informational severity): reports absent/present/undetectable + interpretation guidance.
3. Wire into doctor report aggregation as non-verdict-affecting info (it informs; it doesn't change support verdicts).
4. Tests: fixtures for all three states; determinism.

## Constraints (STRICT)

- MUST NOT spawn, connect to, signal, or manage `exec-server` — detection by passive observation only (C.8).
- MUST be informational — daemon presence is not a support verdict input unless evidence later proves otherwise.
- MUST handle undetectable state honestly ("could not determine", not silent skip).
- MUST NOT degrade performance materially (detection must be cheap/local).

## Acceptance gates

- [ ] Doctor reports daemon state across absent/present/undetectable fixtures
- [ ] No process-spawn/manage code paths added
- [ ] Gates green

## Evidence to record

- Detection method choice + rationale; fixture results.

## Rollback

`git revert` — additive check.
