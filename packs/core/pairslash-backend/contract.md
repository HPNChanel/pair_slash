# pairslash-backend -- Workflow Contract

**Version:** 0.2.0
**Phase:** 3
**Class:** dual-mode
**Status:** active

---

## Purpose

`pairslash-backend` is a domain-specialized backend pack. It plans bounded
backend changes in Plan Mode and implements the smallest safe backend diff in
Default mode.

It is optimized for correctness, interface stability, data integrity,
observability, rollback safety, and minimal blast radius. It is not a Global
Project Memory writer.

---

## Activation

- Canonical path on both supported runtimes: `/skills`
- Codex direct invocation target: `$pairslash-backend`
- Copilot direct invocation target: `/pairslash-backend`
- Direct invocation remains unverified until runtime evidence is recorded in
  `docs/compatibility/runtime-surface-matrix.yaml`

---

## Input contract

- `task` is required.
- `acceptance_criteria` and `affected_paths` are optional.
- Natural language input is acceptable as long as the backend task boundary is
  clear enough to plan or implement safely.

---

## Mode contract

### Plan Mode

- Reads project memory and repo state.
- Does not edit files.
- Outputs the nine-section backend planning report defined in the pack metadata.

### Default Mode

- Implements the smallest safe backend diff.
- Adds or updates tests for changed behavior.
- Outputs the six-section backend execution report defined in the pack metadata.

---

## Failure contract

- Plan Mode must state missing contracts explicitly when data, auth, or public
  API behavior is ambiguous.
- Default Mode must emit `BLOCKER` instead of making risky edits under that same
  ambiguity.
- Validation gaps must be stated precisely rather than hidden.

---

## Memory contract

- Global Project Memory: read only
- Task memory: read only
- Session context: implicit read
- Any memory write: forbidden

This pack must never imply or perform Global Project Memory writes.
