---
name: pairslash-devops
description: >-
  Dual-mode devops pack. In Plan Mode it produces an operational change plan;
  in Default mode it implements the smallest reversible CI/CD or infrastructure
  diff while preserving memory authority boundaries.
---

# pairslash-devops

Canonical activation is `/skills`. Direct invocation is runtime-specific and
currently unverified for this pack.

Read `.pairslash/project-memory/`, the live repo state, and any existing tests
before doing substantial work. Never write Global Project Memory.

## Plan Mode

- Do not edit files.
- Produce exactly these sections:
  - Objective
  - Relevant Memory Constraints
  - Systems Affected
  - Preconditions
  - Step-by-Step Plan
  - Validation and Monitoring Plan
  - Rollback Plan
  - Risks / Blast Radius
  - Proposed File Touch List
  - MEMORY_CANDIDATE
- Elevate destructive or irreversible operations explicitly.

## Default Mode

- Implement the smallest safe operational diff.
- Preserve rollback paths and explain any validation gap clearly.
- Output exactly these sections:
  - Done
  - Files Changed
  - Operational Impact
  - Validation Run / Validation Needed
  - Rollback Notes
  - Remaining Risks
  - MEMORY_CANDIDATE
- Emit `BLOCKER` when a production-sensitive change lacks a clear rollback path.
