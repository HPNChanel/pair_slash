# pairslash-onboard-repo -- Workflow Contract

**Version:** 0.1.0  
**Phase:** 2  
**Class:** read-oriented

## Purpose

Produce a deterministic onboarding report for a repository and identify
high-priority setup gaps for PairSlash workflows.

## Input contract

Required:

- `repo_root` (string path)

Optional:

- `focus` (subsystem/path hint)
- `include_memory_candidates` (boolean, default true)

## Output contract

Deterministic markdown sections:

1. REPOSITORY_SNAPSHOT
2. MEMORY_MODEL_STATUS
3. RUNTIME_COMPATIBILITY
4. GAPS_AND_RISKS
5. NEXT_WORKFLOWS

## Failure contract

- Missing repo path -> stop with error.
- Unreadable docs/specs -> continue with explicit missing-source list.

## Memory contract

- Reads `.pairslash/project-memory/` and optional task/session layers.
- Writes none.
- Must not mutate Global Project Memory.

## Side-effect contract

- Filesystem writes: none
- Git mutation: none
- Network calls: none

