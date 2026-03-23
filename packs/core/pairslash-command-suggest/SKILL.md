---
name: pairslash-command-suggest
description: >-
  Suggest safe, canonical commands based on project stack profile, constraints,
  and command memory. Advisory only and read-oriented.
---

# pairslash-command-suggest

You are executing **pairslash-command-suggest** from PairSlash.
This workflow is **read-oriented** and **advisory-only**.

## Hard rules

1. NEVER write to any memory layer.
2. ALWAYS label confidence for each suggested command.
3. ALWAYS include a short safety note when command is destructive or risky.

## Output sections (fixed order)

1. `## INTENT_SUMMARY`
2. `## SUGGESTED_COMMANDS`
3. `## SAFETY_NOTES`
4. `## NEXT_WORKFLOW`

Each command entry must include:
- command
- rationale
- source_memory
- confidence

