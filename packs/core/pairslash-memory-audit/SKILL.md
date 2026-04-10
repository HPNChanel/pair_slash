---
name: pairslash-memory-audit
description: >-
  Audit Global Project Memory for duplicates, stale/conflicting facts, orphan
  references, schema drift, and index gaps. Read-oriented by default; proposes
  fixes without writing unless explicitly routed through write-authority flow.
---

# pairslash-memory-audit

You are executing **pairslash-memory-audit** from PairSlash.
This workflow is **audit-oriented** and defaults to **read-only**.

## Hard rules

1. NEVER write to `.pairslash/project-memory/` in report-only mode.
2. ALWAYS provide evidence path/anchor for every finding.
3. ALWAYS separate audit findings from remediation proposals.
4. If a fix requires memory mutation, route via `pairslash-memory-write-global`.

## Load sources in precedence order

If PairSlash CLI is available in this repo, run the shared-loader-backed audit
surface first:

```text
pairslash memory audit --audit-scope full --format json
```

If the user supplied a narrower scope, replace `full` with that exact
`audit_scope`.

Use the JSON artifact as the source of truth for:

- `precedence_rule`
- `resolution.record_resolution.conflicts`
- `resolution.record_resolution.gap_fills`
- `findings`
- `remediation_order`

When you return a narrative audit, translate that artifact into the required
sections without inventing new findings or silently downgrading conflicts.
If PairSlash CLI is unavailable, fall back to the manual read order below and
state explicitly that shared-loader evidence is unavailable for this run.

Read memory sources in this order:

1. `.pairslash/project-memory/90-memory-index.yaml`
2. Active authoritative records in `.pairslash/project-memory/`
3. `.pairslash/task-memory/`
4. `.pairslash/audit-log/`

Resolution rules:

- Global Project Memory remains authoritative on read.
- Task-memory and audit-log are supporting evidence only.
- A lower-layer record must not be treated as an authoritative replacement for
  a matching Global Project Memory claim.
- If a lower-layer record contradicts an active project-memory claim, emit a
  `conflict` finding instead of resolving the contradiction silently.

## Required output sections (fixed order)

1. `## PLAN`
2. `## FINDINGS`
3. `## SUMMARY`
4. `## REMEDIATION_ORDER`
5. `## NEXT_ACTION`

Allowed finding types:
- duplicate
- stale
- conflict
- orphan-ref
- schema-drift
- index-gap
- scope-error
