# pairslash-memory-write-global -- Workflow Contract

**Version:** 0.4.0
**Phase:** 4
**Class:** write-authority
**Status:** active

## Purpose

`pairslash-memory-write-global` is the only authorized workflow for writing
Global Project Memory records.

It enforces schema validation, duplicate/conflict checks, preview-before-write,
and explicit user acceptance.

## Activation

Canonical activation path on both supported runtimes:

```text
/skills
```

Select `pairslash-memory-write-global` from the skill picker.

Phase 4 does not rely on runtime-specific direct slash invocation as a product
surface.

## Required input fields

- `kind`: decision | command | glossary | constraint | ownership | incident-lesson | pattern
- `title`
- `statement`
- `evidence`
- `scope`: whole-project | subsystem | path-prefix
- `confidence`: low | medium | high
- `action`: append | supersede | reject-candidate-if-conflict

## Safety contract

- No memory write before preview patch is shown.
- No memory write without explicit user acceptance.
- On duplicate/conflict, halt and ask for explicit resolution.
- Always append audit entry for accepted or rejected write attempt.

## Memory contract

- Read:
  - `.pairslash/project-memory/`
  - `.pairslash/task-memory/`
  - `.pairslash/staging/`
- Write (after acceptance only):
  - `.pairslash/project-memory/*`
  - `.pairslash/project-memory/90-memory-index.yaml`
  - `.pairslash/audit-log/*.yaml`

No other workflow may write Global Project Memory as a side effect.

## Side-effect contract

- Filesystem writes are limited to:
  - `.pairslash/project-memory/*`
  - `.pairslash/project-memory/90-memory-index.yaml`
  - `.pairslash/audit-log/*.yaml`
- Writes are allowed only after preview is generated and explicit acceptance is obtained.
- No hidden write, no silent fallback, and no freeform authoritative blob is permitted.

## Compatibility authority

- Pack metadata: `packs/core/pairslash-memory-write-global/pack.manifest.yaml`
- Runtime support lane: `docs/runtime-mapping/`
- Installability surface: `docs/workflows/phase-4-install-commands.md`
