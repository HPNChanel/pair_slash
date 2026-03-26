# pairslash-plan -- Workflow Contract

**Version:** 0.2.0
**Phase:** 2
**Class:** read-oriented
**Status:** active

## Purpose

`pairslash-plan` creates a structured execution plan before code changes.

It reads repository context and Global Project Memory to produce a plan with
explicit assumptions, risks, and rollback notes.

## Activation

Canonical activation path on both supported runtimes:

```text
/skills
```

Select `pairslash-plan` from the skill picker.

Phase 4 does not rely on runtime-specific direct slash invocation as a product
surface.

## Input contract

- `goal` (required): what needs to be achieved.
- `scope_hint` (optional): subsystem or path prefix.
- `constraints` (optional): extra constraints for this task.

## Output contract

Returns structured markdown with:

1. Goal
2. Constraints
3. Relevant project memory
4. Proposed steps
5. Files likely affected
6. Tests and checks
7. Risks
8. Rollback
9. Open questions

## Memory contract

- Global Project Memory: read-only
- Task memory/session context: read-only
- Any memory writes: prohibited

If durable project truth should be written, use
`pairslash-memory-write-global` explicitly in a separate step.

## Compatibility authority

- Pack metadata: `packs/core/pairslash-plan/pack.manifest.yaml`
- Runtime support lane: `docs/runtime-mapping/`
- Release surface for installability: `docs/workflows/phase-4-install-commands.md`
