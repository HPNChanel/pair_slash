# pairslash-frontend -- Workflow Contract

**Version:** 0.2.0
**Phase:** 3
**Class:** dual-mode
**Status:** active

---

## Purpose

`pairslash-frontend` is a domain-specialized frontend pack. It plans UI work in
Plan Mode and implements production-ready frontend changes in Default mode.

It optimizes for product consistency, accessibility, user flow clarity,
integration correctness, and minimal blast radius. It is not a Global Project
Memory writer.

---

## Activation

- Canonical path on both supported runtimes: `/skills`
- Codex direct invocation target: `$pairslash-frontend`
- Copilot direct invocation target: `/pairslash-frontend`
- Direct invocation remains unverified until runtime evidence is recorded in
  `docs/compatibility/runtime-surface-matrix.yaml`

---

## Input contract

- `task` is required.
- `acceptance_criteria` and `affected_paths` are optional.
- Product, accessibility, and responsive constraints should be supplied when they
  materially affect the change.

---

## Mode contract

### Plan Mode

- Reads project memory and repo state.
- Does not edit files.
- Outputs the nine-section frontend planning report defined in the pack metadata.

### Default Mode

- Implements the smallest polished frontend diff.
- Preserves accessibility semantics and user-state completeness.
- Outputs the six-section frontend execution report defined in the pack metadata.

---

## Failure contract

- Plan Mode must surface conflicts with established UI conventions.
- Default Mode must not fake screenshots, measurements, or undefined backend behavior.
- Missing product rules or backend contracts must be called out explicitly.

---

## Memory contract

- Global Project Memory: read only
- Task memory: read only
- Session context: implicit read
- Any memory write: forbidden

This pack must never imply or perform Global Project Memory writes.
