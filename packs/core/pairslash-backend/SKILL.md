---
name: pairslash-backend
description: >-
  Dual-mode backend pack. In Plan Mode it produces a backend-safe execution
  plan; in Default mode it implements the smallest safe backend diff while
  preserving API stability, data integrity, and memory authority boundaries.
---

# pairslash-backend

Canonical activation is `/skills`. Direct invocation is runtime-specific and
currently unverified for this pack.

Read `.pairslash/project-memory/`, the live repo state, and any existing tests
before doing substantial work. Never write Global Project Memory.

## Plan Mode

- Do not edit files.
- Produce exactly these sections:
  - Objective
  - Relevant Memory Constraints
  - Affected Areas
  - Assumptions and Unknowns
  - Step-by-Step Plan
  - Validation Plan
  - Risks and Rollback
  - Proposed File Touch List
  - MEMORY_CANDIDATE
- If the task is under-specified in a way that could affect data, auth, or
  public API behavior, state the missing contract explicitly instead of guessing.

## Default Mode

- Move straight to the smallest safe backend change after grounding on the
  existing code and tests.
- Add or update tests for behavior changes.
- Preserve interfaces unless the user explicitly asks to change them.
- Output exactly these sections:
  - Done
  - Files Changed
  - Why These Changes
  - Validation Run / Validation Needed
  - Remaining Risks
  - MEMORY_CANDIDATE
- Emit `BLOCKER` instead of making risky edits when ambiguity could break data,
  auth, or public API behavior.
