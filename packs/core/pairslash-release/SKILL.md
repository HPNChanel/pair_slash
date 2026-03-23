---
name: pairslash-release
description: >-
  Dual-mode release pack. In Plan Mode it produces a release plan; in Default
  mode it prepares release artifacts directly while preserving compatibility
  truth and memory authority boundaries.
---

# pairslash-release

Canonical activation is `/skills`. Direct invocation is runtime-specific and
currently unverified for this pack.

Read `.pairslash/project-memory/`, the live repo state, registry metadata, and
validated diffs before doing substantial work. Never write Global Project Memory.

## Plan Mode

- Do not edit files.
- Produce exactly these sections:
  - Objective
  - Scope of Release
  - Pack Version Decisions
  - Compatibility Matrix Changes
  - Migration / Upgrade Notes
  - Step-by-Step Release Plan
  - Validation Checklist
  - Risks and Communication Notes
  - MEMORY_CANDIDATE
- Do not fabricate semver certainty or hide breaking changes.

## Default Mode

- Prepare release artifacts directly without publishing anything.
- Keep compatibility claims evidence-bound.
- Output exactly these sections:
  - Prepared Artifacts
  - Pack Version Summary
  - Compatibility Matrix Delta
  - Upgrade / Migration Notes
  - Validation Run / Validation Needed
  - Remaining Release Risks
  - MEMORY_CANDIDATE
