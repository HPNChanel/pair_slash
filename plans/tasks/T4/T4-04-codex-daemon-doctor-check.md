---
id: T4-04
track: T4
title: Codex daemon-aware doctor check (detect/report exec-server)
status: done
depends_on: []
est_size: S
claimed_by: devin
claimed_at: 2026-09-28
completed_at: 2026-09-28
evidence:
  - "detection method: passive filesystem observation of CODEX_HOME daemon artifacts only — no process scan (spawning tasklist/ps is platform-fragile), no socket connect (C.8 prohibits connect), no codex subcommand spawn (could trigger daemon behavior)"
  - "verified artifact layout (openai/codex app-server-daemon README + codex doctor output in issues #35295/#37893): ~/.codex/app-server-daemon/{settings.json,app-server.pid,app-server-updater.pid}, ~/.codex/app-server-control/app-server-control.sock, ~/.codex/packages/app-server-daemon/ managed payload; [daemon] auto_start/port=40022 in config.toml (v0.157 stable default)"
  - "check runtime.daemon_state (group runtime, informational): states present/absent/undetectable; reads app-server.pid JSON for recorded_pid (no liveness probe); parses [daemon] auto_start for interpretation; codex-only, skips on copilot"
  - "undetectable = CODEX_HOME unreadable/not-a-dir or all artifact stats error; reported as pass+honest summary since informational checks must not move support_verdict (aggregateVerdict treats warn as verdict-affecting)"
  - "existing codex.daemon_state surface probe candidates corrected to verified artifact paths (was guessed daemon/ + exec-server.log)"
  - "live host: codex 0.153.4 (<0.157) -> 'codex daemon artifacts absent (informational, lifecycle unmanaged)'"
  - "tests: 4 new cases (present+pid+auto_start, absent+auto_start=false, undetectable via file-as-home, copilot skip); doctor 39/39; fixture goldens show deterministic absent/skip lanes"
  - "docs: codex-cli.md daemon surface note extended"
  - "gates: typecheck pass, lint pass, npm test all pass, test:release pass"
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

- [x] Doctor reports daemon state across absent/present/undetectable fixtures
- [x] No process-spawn/manage code paths added
- [x] Gates green

## Evidence to record

- Detection method choice + rationale; fixture results.

## Rollback

`git revert` — additive check.
