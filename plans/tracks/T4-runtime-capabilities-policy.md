# Track T4 — Runtime capability policy layer

**Status:** Approved | **Priority:** P2 | **Depends on:** T1, T2
**Goal:** Model the runtimes' new capability surfaces — hooks, implicit invocation, custom agents, daemon awareness, observability — in the spec/policy layer with opt-in defaults that preserve charter boundaries.

## Context

New surfaces that need *policy*, not just docs:
- **Hooks** (both runtimes): Codex `hooks.json`/inline `[hooks]` (12 events incl. `Interrupt`, trust-by-hash); Copilot `hooks.json` in plugins. Write-authority preflight is a natural fit but must respect trust-review UX (unmanaged hooks skipped until trusted).
- **Implicit invocation**: Codex auto-selects skills by description match; Copilot's dashboard/routers similar. PairSlash workflows were designed explicit-first — the default stays explicit; per-pack opt-in is the policy question.
- **Custom agents**: Copilot `.agent.md` + subagents; Codex subagent infra. Charter §13.3 permits persona mapping but keeps write-authority skill-disciplined.
- **Daemon**: Codex `exec-server` auto-start is stable default — doctor must detect/report, never manage (C.8).
- **Observability**: `/usage` exposes skill activity — doc note for workflow authors.

## Entry gate

- T1 truth realigned (policy targets current surfaces); T2 schema tooling available.

## Tasks (ordered)

| Task | Title | Depends on |
| --- | --- | --- |
| T4-01 | Hook emission model: preflight hooks for write-authority packs (both runtimes) | — |
| T4-02 | `implicit_invocation` manifest field + opt-in policy + description-safety lint | — |
| T4-03 | Copilot `.agent.md` emission for persona workflows (non-authoritative only) | T4-02 |
| T4-04 | Codex daemon-aware doctor check (detect/report `exec-server`) | — |
| T4-05 | Observability notes: `/usage` skill activity + trace alignment | T4-04 |
| T4-06 | Trust/managed-hooks + toggles gap documentation in doctor guidance | T4-01 |

## Exit gate

- Manifest schema gains `implicit_invocation` (default `explicit-only`) and optional `hooks` declarations; lint enforces opt-in semantics.
- Write-authority packs may emit preflight hook configs; emitted hooks are advisory/detective (verify/lint before commit) and MUST NOT auto-commit memory (C.3).
- Doctor reports daemon state (informational) and hooks-disabled state (warning for write-authority packs).
- Agent emission is restricted to read-oriented/candidate workflows; write-authority remains skill-disciplined.

## Risks

- Hooks differ semantically across runtimes (trust-by-hash vs declarative) — emitter must abstract without pretending parity.
- Implicit invocation could bypass `/skills` intent — the lint rule must warn when a pack opts in without strong description hygiene.
- Agent/subagent surfaces risk scope creep toward a "third interaction model" — keep to charter §13.3 letter.
