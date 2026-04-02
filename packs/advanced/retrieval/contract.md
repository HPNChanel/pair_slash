# Retrieval Lane Contract (Phase 11 Slice)

## Scope

`pairslash-retrieval-addon` is a supplemental context lane.
It is read-only and non-authoritative.

## Memory Boundary

- Retrieved output is always `label: retrieved`.
- Retrieved output is always `authoritative: false`.
- Retrieval cannot write `.pairslash/project-memory`.
- Retrieval cannot auto-promote to Global Project Memory.
- If retrieved fact conflicts with Global memory, Global wins.

## Capability Flags

- `retrieval_enabled` default `false`
- `retrieval_repo_local` default `true`
- `retrieval_artifact_index` default `false`
- `retrieval_external_disabled_by_default` default `true`
- `retrieval_no_authoritative_write` forced `true`

## Policy Semantics

| Action | Decision |
| --- | --- |
| `retrieval.query.repo_local` | `allow` |
| `retrieval.query.artifact_local` | `allow` |
| `retrieval.query.external` | `deny` |
| `retrieval.index.build` | `require-preview` |
| `retrieval.index.refresh` | `require-preview` |
| `retrieval.memory.promote` | `deny` |
| `retrieval.hidden_write` | `deny` |

Additional guardrails:

- explicit invocation only
- sensitive paths require `ask`
- stale sources require `ask`
- sources outside declared repo boundary are denied
