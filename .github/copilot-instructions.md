# Copilot Instructions for PairSlash

## Product boundary

- PairSlash core targets exactly two runtimes:
  - Codex CLI
  - GitHub Copilot CLI
- Canonical entrypoint is `/skills`.
- Do not introduce third runtime references into core workflows.

## Memory authority model

- Global Project Memory (`.pairslash/project-memory/`) is authoritative.
- Task/session memory is non-authoritative.
- Read workflows must never write Global Project Memory.
- Only `pairslash-memory-write-global` may mutate authoritative memory.

## Core workflows

- `pairslash-plan`
- `pairslash-review`
- `pairslash-onboard-repo`
- `pairslash-command-suggest`
- `pairslash-memory-candidate`
- `pairslash-memory-write-global`
- `pairslash-memory-audit`

## Write-authority safety requirements

`pairslash-memory-write-global` must enforce:

1. Structured input validation
2. Duplicate/conflict/scope checks
3. Preview patch generation
4. Explicit user acceptance
5. Authoritative write
6. Memory index update
7. Audit log append

No silent writes. No hidden conflict resolution.

## Source-of-truth locations

- Workflow packs: `packs/core/`
- Specs/schemas: `packages/core/spec-core/`
- Authoritative memory: `.pairslash/project-memory/`
- Validation gates: `npm run lint`, `npm run test`, `npm run test:release`

Runtime install locations (`.agents/skills/`, `.github/skills/`) are derived
artifacts, not source-of-truth.
