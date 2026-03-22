# pair_slash

PairSlash is an open-source slash-triggered workflow kit for two runtimes:

- Codex CLI
- GitHub Copilot CLI

Its core idea is explicit, file-based **Global Project Memory** that is durable,
reviewable by Git, and separate from temporary session context.

## Current status

- Version: `0.1.0`
- Phase: Phase 0 complete (conditional), entering Phase 1
- State: Codex CLI verified, Copilot CLI deferred, G7 gap documented

Phase 0 proved architecture direction and workflow contracts on Codex CLI v0.116.0.
Phase 1 focuses on core product scaffolding.

## What this repository contains

- Project constitution: `CLAUDE.md`
- Global Project Memory: `.pairslash/project-memory/`
- Core skills pack: `packs/core/`
- Workflow specs and schemas: `packages/spec-core/`
- Compatibility and verification artifacts: `docs/compatibility/`
- Architecture and workflow docs: `docs/architecture/`, `docs/workflows/`

## Core principles

PairSlash in this repo is governed by these constraints:

- Slash-first interaction model
- `/skills` as canonical cross-runtime entrypoint
- Explicit-write-only memory mutation (no silent writes)
- File-based, schema-first memory records
- Two-runtime boundary only (Codex CLI and Copilot CLI)

## Supported runtimes

### Codex CLI

- Repo skill path: `.agents/skills/`
- User skill path: `~/.agents/skills/`
- Direct invocation: `$skill-name`
- Canonical invocation: `/skills`

### GitHub Copilot CLI

- Repo skill path: `.github/skills/`
- User skill path: `~/.copilot/skills/`
- Direct invocation: `/skill-name`
- Canonical invocation: `/skills`

## Included skills

### `pairslash-plan` (read-oriented)

Purpose:

- Build a structured execution plan before implementation
- Read project memory for constraints and conventions
- Separate facts from assumptions

Safety rule:

- Must not write to Global Project Memory

### `pairslash-memory-write-global` (write-authority)

Purpose:

- Write durable project truth into `.pairslash/project-memory/`
- Validate structured input
- Detect duplicates/conflicts
- Require preview patch + explicit acceptance before writing

Safety rules:

- No write without preview
- No write without user acceptance
- No silent conflict resolution

## Global memory layout

Current canonical memory shape in this repository:

```text
.pairslash/
  project-memory/
    00-project-charter.yaml
    10-stack-profile.yaml
    90-memory-index.yaml
  task-memory/
  sessions/
  audit-log/
  staging/
```

Notes:

- `project-memory/` is authoritative.
- `task-memory/` and `sessions/` are non-authoritative layers.
- `audit-log/` is for durable write history.
- `staging/` is for pre-authoritative or validation workflows.

## Quick start (manual install)

### Install skills for Codex CLI

```bash
mkdir -p .agents/skills
cp -r packs/core/pairslash-plan .agents/skills/
cp -r packs/core/pairslash-memory-write-global .agents/skills/
```

### Install skills for GitHub Copilot CLI

```bash
mkdir -p .github/skills
cp -r packs/core/pairslash-plan .github/skills/
cp -r packs/core/pairslash-memory-write-global .github/skills/
```

Windows PowerShell equivalents are documented in `docs/workflows/install-guide.md`.

## Verification and compatibility

- Runtime test procedure: `docs/compatibility/runtime-verification.md`
- Acceptance gates: `docs/compatibility/acceptance-gates.yaml`
- Runtime surface matrix: `docs/compatibility/runtime-surface-matrix.yaml`
- Phase 0 acceptance checklist: `docs/compatibility/phase-0-acceptance.md`

## Repository map

```text
.
|- CLAUDE.md
|- README.md
|- .pairslash/
|  |- project-memory/
|  |- task-memory/
|  |- sessions/
|  |- audit-log/
|  `- staging/
|- packages/
|  |- spec-core/
|  |  |- specs/
|  |  `- schemas/
|  |- cli/
|  |- compiler-codex/
|  |- compiler-copilot/
|  |- memory-engine/
|  |- installer/
|  |- doctor/
|  `- registry/
|- packs/
|  |- core/
|  |  |- pairslash-plan/
|  |  |- pairslash-memory-write-global/
|  |  `- pairslash-review/
|  |- backend/
|  |- frontend/
|  |- devops/
|  `- release/
|- templates/
|  |- skill/
|  |- memory/
|  `- repo/
|- docs/
|  |- architecture/
|  |- compatibility/
|  `- workflows/
|- examples/
|  |- monorepo/
|  |- rails-service/
|  `- node-api/
`- scripts/
```

## Phase roadmap (high level)

- Phase 0: compatibility spike (complete -- Codex CLI verified, Copilot deferred)
- Phase 1: core product scaffolding (`spec-core`, compilers, installer, doctor)
- Phase 2: memory hardening and write pipeline robustness
- Phase 3: team packs and expanded packaging

## License

License is currently marked `TBD` in the project charter.
