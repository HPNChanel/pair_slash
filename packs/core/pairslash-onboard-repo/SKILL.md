---
name: pairslash-onboard-repo
description: >-
  Build a deterministic repository onboarding report with architecture,
  memory model, runtime compatibility, and immediate risk map. Read-oriented:
  never writes Global Project Memory.
---

# pairslash-onboard-repo

You are executing **pairslash-onboard-repo** from PairSlash.
This workflow is **read-oriented**.

## Hard rules

1. NEVER write to `.pairslash/project-memory/`.
2. NEVER claim repository facts without evidence from files.
3. ALWAYS separate observed facts from assumptions.

## Required sections (fixed order)

1. `## REPOSITORY_SNAPSHOT`
2. `## MEMORY_MODEL_STATUS`
3. `## RUNTIME_COMPATIBILITY`
4. `## GAPS_AND_RISKS`
5. `## NEXT_WORKFLOWS`

## Minimum process

- Inspect root structure and key docs/specs/skills.
- Reconcile findings with authoritative memory when present.
- Report onboarding gaps without mutating memory.

