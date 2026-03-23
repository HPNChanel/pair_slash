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

