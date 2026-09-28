# Observability notes — runtime surfaces and PairSlash trace

Status: documentation note. PairSlash ships **no** observability integration;
this page records what the runtimes already surface about PairSlash-installed
workflows and how the local PairSlash trace vocabulary maps onto it.

## What the runtimes surface

### Codex CLI

- `/usage` (TUI): account token activity — `daily`, `weekly`, `cumulative`
  views with per-model breakdown (verified in the official command reference).
- Since v0.156 the usage dashboard also reports **plugin and skill
  activity** (CX-15): which skills ran and how often. PairSlash-installed
  skills appear under their skill directory name — which is the pack id,
  since emitted skill dirs are named `<pack-id>` (e.g. `pairslash-plan`).
- `/status` shows session-level model/policy/context, not skill history.
- The app-server daemon (v0.157+, see `runtime.daemon_state` doctor check)
  records session state locally; PairSlash does not read or manage it.

### GitHub Copilot CLI

- `/usage` slash command: token usage and session activity breakdown.
- `copilot --usage-output-file <path>` exports a JSON usage report with
  **per-agent metrics** — custom agents emitted via T4-03
  (`.agent.md`, `name: <pack-id>`) appear under that name.
- Session exit prints a usage estimate (premium requests, per-model tokens);
  `session.shutdown` events persist usage stats under
  `~/.copilot/session-state/`, and `~/.copilot/session-store.db` aggregates
  local history. These are runtime-owned stores — PairSlash never writes to
  them.

## PairSlash trace vocabulary vs runtime naming

PairSlash trace (`packages/tools/trace`, local-only files under
`.pairslash/`) was reviewed against the runtime surfaces above:

| PairSlash field | Runtime surface equivalent | Alignment |
| --- | --- | --- |
| `pack_id` | skill name in Codex `/usage`; agent `name` in Copilot per-agent metrics | aligned by construction — emitted skill/agent names equal `pack_id` |
| `command_name` | none | PairSlash CLI surface only; runtimes see skill/agent invocations, not `pairslash` commands |
| `session_id` / `workflow_id` / `correlation_id` | runtime session ids | no join key — PairSlash ids are local-only by design; correlating trace to `/usage` rows is not possible and not attempted |
| `event_type`, `outcome` | invocation counts, token totals | different granularity — runtimes aggregate per skill/agent; PairSlash events are per command run. No 1:1 mapping, no mismatch bug |
| `telemetry_eligible` | n/a | PairSlash-side flag, unchanged (default `false`); runtime surfaces are the user's own runtime telemetry |
| `redaction_tags` | n/a | unchanged — runtime surfaces expose skill/agent names and descriptions, never PairSlash trace payloads |

### Recorded alignment gaps

1. **No shared correlation identifier.** Runtime usage rows cannot be joined
   to PairSlash trace sessions. Accepted limitation; closing it would require
   runtime-side telemetry hooks, which is out of scope.
2. **Codex `/usage` skill-activity granularity is undocumented** — whether it
   distinguishes explicit `$skill` vs implicit selection is unverified.
   Recorded here, not claimed in user-facing docs.
3. **Agent-name collision surface**: a Copilot `.agent.md` shim and the skill
   share the pack id, so per-agent metrics and skill activity may be hard to
   tell apart in dashboards. This is inherent to name reuse, by design.

## Privacy posture

- Runtime observability surfaces belong to the runtime and the user's own
  account; PairSlash installs only declarative files and adds no telemetry
  plumbing to them.
- Treat SKILL.md `name` and `description` as user-visible metadata: they are
  what activity dashboards attribute usage to. Do not embed secrets,
  internal ticket ids, or identifying phrases in them.
- PairSlash trace stays local; `telemetry_eligible` remains opt-in and
  redaction discipline is unchanged by this work.

## Author guidance

If you author a pack, assume every invocation is attributable: the pack id
is the label users (and admins reviewing usage) will see in `/usage`
activity and per-agent metrics. Choose pack ids and descriptions
accordingly.
