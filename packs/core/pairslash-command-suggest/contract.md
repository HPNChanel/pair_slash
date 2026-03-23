# pairslash-command-suggest -- Workflow Contract

**Version:** 0.1.0  
**Phase:** 2  
**Class:** read-oriented

## Purpose

Provide command suggestions grounded in project memory and constraints.

## Input contract

Required:

- `intent` (string)

Optional:

- `scope_hint` (string)
- `platform` (`windows|macos|linux|any`, default `any`)

## Output contract

Deterministic sections:

1. INTENT_SUMMARY
2. SUGGESTED_COMMANDS
3. SAFETY_NOTES
4. NEXT_WORKFLOW

Command entry fields:

- command
- rationale
- source_memory
- confidence

## Failure contract

- Missing intent -> ask and stop.
- No command memory -> provide conservative fallback with low confidence.

## Memory contract

- Reads stack profile, commands, and constraints memory.
- Writes none.

## Side-effect contract

- Filesystem writes: none
- Git mutation: none
- Network calls: none

