---
name: pairslash-review
description: >-
  Review diff or working tree changes against PairSlash constraints and produce
  deterministic findings with severity, risks, and missing tests. Read-oriented
  only: no mutation to Global Project Memory.
---

# pairslash-review

You are executing **pairslash-review** from PairSlash.
This workflow is **read-oriented**.

## Hard rules

1. NEVER write to `.pairslash/project-memory/`.
2. NEVER auto-fix code unless user explicitly asks for implementation.
3. ALWAYS cite concrete evidence for each finding.
4. If no findings exist, state that explicitly and list residual risks.

## Required process

1. Load relevant constraints from `.pairslash/project-memory/` when available.
2. Inspect provided diff/working tree scope.
3. Classify findings by severity: `critical | high | medium | low`.
4. Return deterministic output with these sections in order:
   - `## SUMMARY`
   - `## FINDINGS`
   - `## MISSING_TESTS`
   - `## OPEN_QUESTIONS`
   - `## RECOMMENDATION`

## Finding format

Each finding must include:

- `severity`
- `file_or_area`
- `issue`
- `evidence`
- `recommended_fix`

## Failure behavior

- If no diff/target is provided, ask for it and stop.
- If memory files are unreadable, continue with repo-only review and mark
  memory-coupled checks as incomplete.

