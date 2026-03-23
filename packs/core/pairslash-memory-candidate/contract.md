# pairslash-memory-candidate -- Workflow Contract

**Version:** 0.1.0  
**Phase:** 2  
**Class:** candidate-producing (read-only memory behavior)  
**Status:** hardening baseline

---

## Purpose

`pairslash-memory-candidate` extracts potential durable facts from task/session
context and proposes them as candidates for future promotion.

It is designed to reduce noise and prevent accidental promotion by enforcing:

- evidence-first extraction,
- mandatory reconciliation with authoritative memory,
- deterministic classification,
- strict fail-fast gates.

What it is not:

- It is not a write-authority workflow.
- It is not a substitute for `pairslash-memory-write-global`.
- It is not allowed to mutate Global Project Memory.

---

## Activation

Canonical path (both runtimes):

```text
/skills
```

Select `pairslash-memory-candidate`.

Direct invocation (when available):

| Runtime | Syntax |
|---------|--------|
| Codex CLI | `$pairslash-memory-candidate` |
| GitHub Copilot CLI | `/pairslash-memory-candidate` |

---

## Input contract

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `task_scope` | yes | string | Concrete scope of extraction for this run. |
| `evidence_sources` | no | array[string] | Optional source hints to prioritize. |
| `strictness` | no | enum | `strict-gate-fail-fast` (default), `balanced`, `lenient`. |
| `max_candidates` | no | integer | Cap the number of returned candidates. Default 20. |

Hard input rule:

- If `task_scope` is missing or ambiguous, stop and request clarification.

---

## Output contract

The workflow output is structured markdown with exactly these sections:

1. `## PLAN`
2. `## CANDIDATES`
3. `## RECONCILIATION`
4. `## NEXT_ACTION`

Each candidate entry must include:

- `id`
- `kind`
- `title`
- `statement`
- `scope`
- `evidence`
- `confidence`
- `novelty`
- `classification`
- `reason_to_promote`
- `reason_not_to_promote_yet`
- `target_file_hint`

Allowed classification values:

- `keep-as-candidate`
- `duplicate-existing`
- `needs-supersede-review`
- `too-weak-do-not-promote`

Allowed NEXT_ACTION values:

- `USE_PAIRSLASH_MEMORY_WRITE_GLOBAL`
- `KEEP_IN_TASK_MEMORY`
- `REJECT_CANDIDATES`

---

## Failure contract

| Failure condition | Behavior |
|-------------------|----------|
| Missing `task_scope` | Stop and ask for a concrete scope. |
| Missing evidence for a claim | Classify as `too-weak-do-not-promote`. |
| Cannot reconcile against project-memory | Block `keep-as-candidate`; downgrade or reject. |
| Output misses required fields/sections | Return validation error, not partial success. |
| Contradiction with active record | Classify as `needs-supersede-review`. |

Fail-fast posture:

- Do not hide weak evidence.
- Do not output optimistic classifications when reconciliation is incomplete.

---

## Memory contract

| Layer | Permission | Purpose |
|-------|------------|---------|
| `.pairslash/project-memory/` | read | Authoritative reconciliation |
| `.pairslash/task-memory/` | read | Task-level signals |
| `.pairslash/sessions/` | read | Session artifacts |
| `.pairslash/staging/` | read | Pending candidate overlap |
| `.pairslash/audit-log/` | read | Durable historical evidence |
| Any memory layer | no write | This workflow is non-mutating |

Invariant:

- Candidate extraction must never mutate `.pairslash/project-memory/`.
- Promotion must be explicit via `pairslash-memory-write-global`.

---

## Side-effect contract

- Filesystem writes: none
- Git mutation: none
- Network calls: none

---

## Classification and decision policy

- `keep-as-candidate`:
  reusable claim, concrete evidence, no authoritative conflict.
- `duplicate-existing`:
  materially same as an active authoritative record.
- `needs-supersede-review`:
  conflicts with active memory and needs explicit supersede decision.
- `too-weak-do-not-promote`:
  weak/ambiguous evidence or task-local guidance only.

Default decision mapping:

- At least one high-quality keep candidate and no unresolved conflict ->
  `USE_PAIRSLASH_MEMORY_WRITE_GLOBAL`.
- Mostly weak or context-local candidates -> `KEEP_IN_TASK_MEMORY`.
- No viable candidate or evidence quality unacceptable -> `REJECT_CANDIDATES`.
