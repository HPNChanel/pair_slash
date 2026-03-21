# pair_slash

PairSlash is an open-source slash-triggered workflow kit for two runtimes:

- Codex CLI
- GitHub Copilot CLI

Its core idea is explicit, file-based **Global Project Memory** that is durable,
reviewable by Git, and separate from temporary session context.

## Current status

- Version: `0.1.0`
- Phase: `0` (Compatibility Spike)
- State: artifact-complete, runtime verification in progress

Phase 0 proves architecture direction and workflow contracts. It does not claim
production readiness.

## What this repository contains

This repository currently focuses on Phase 0 artifacts:

- Project constitution: `CLAUDE.md`
- Global memory scaffold: `.pairslash/`
- Skill definitions:
  - `phase-0/skills/pairslash-plan/`
  - `phase-0/skills/pairslash-memory-write-global/`
- Specs, schema, and compatibility artifacts:
  - `phase-0/specs/`
  - `phase-0/schemas/`
  - `phase-0/compatibility/`
- Documentation and verification guides:
  - `docs/phase-0/`
  - `checklists/phase-0-acceptance.md`

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

Phase 0 uses manual installation.

### Install skills for Codex CLI

```bash
mkdir -p .agents/skills
cp -r phase-0/skills/pairslash-plan .agents/skills/
cp -r phase-0/skills/pairslash-memory-write-global .agents/skills/
```

### Install skills for GitHub Copilot CLI

```bash
mkdir -p .github/skills
cp -r phase-0/skills/pairslash-plan .github/skills/
cp -r phase-0/skills/pairslash-memory-write-global .github/skills/
```

Windows PowerShell equivalents are documented in:

- `phase-0/install-guide.md`
- `docs/phase-0/runtime-verification.md`

## Verification workflow

Use these files to verify runtime behavior and gate completion:

- Runtime test procedure: `docs/phase-0/runtime-verification.md`
- Acceptance gates source: `phase-0/compatibility/acceptance-gates.yaml`
- Runtime matrix source: `phase-0/compatibility/runtime-surface-matrix.yaml`
- Master checklist: `checklists/phase-0-acceptance.md`

Phase 0 completion target:

- All MUST gates `G1-G10` pass
- WILL-NOT gates `G15-G18` remain pass
- Verification items `V1-V7` resolved with recorded status

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
|- phase-0/
|  |- skills/
|  |- specs/
|  |- schemas/
|  |- compatibility/
|  `- install-guide.md
|- docs/
|  `- phase-0/
`- checklists/
```

## Phase roadmap (high level)

- Phase 0: compatibility spike (current)
- Phase 1: core product scaffolding (`spec-core`, compilers, installer, doctor)
- Phase 2: memory hardening and write pipeline robustness
- Phase 3: team packs and expanded packaging

## License

License is currently marked `TBD` in the project charter.
