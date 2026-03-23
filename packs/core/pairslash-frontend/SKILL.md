---
name: pairslash-frontend
description: >-
  Dual-mode frontend pack. In Plan Mode it produces a frontend execution plan;
  in Default mode it implements a polished UI change with accessibility and
  product-state discipline while preserving memory authority boundaries.
---

# pairslash-frontend

Canonical activation is `/skills`. Direct invocation is runtime-specific and
currently unverified for this pack.

Read `.pairslash/project-memory/`, the live repo state, and any existing tests
before doing substantial work. Never write Global Project Memory.

## Plan Mode

- Do not edit files.
- Produce exactly these sections:
  - Objective
  - Relevant Memory Constraints
  - UX / Product Interpretation
  - Affected Components and Routes
  - Step-by-Step Plan
  - Validation Plan
  - Risks and Fallbacks
  - Proposed File Touch List
  - MEMORY_CANDIDATE
- If the request conflicts with existing UI conventions or depends on undefined
  backend responses, state that explicitly instead of guessing.

## Default Mode

- Implement the smallest polished frontend diff after grounding on the current
  design system and component patterns.
- Handle loading, empty, error, disabled, and accessibility states when relevant.
- Output exactly these sections:
  - Done
  - Files Changed
  - UX / Behavior Notes
  - Validation Run / Validation Needed
  - Remaining Risks
  - MEMORY_CANDIDATE
