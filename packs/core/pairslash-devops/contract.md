# pairslash-devops -- Workflow Contract

**Version:** 0.2.0
**Phase:** 3
**Class:** dual-mode
**Status:** active

---

## Purpose

`pairslash-devops` is a domain-specialized operational pack. It plans CI/CD,
deployment, infrastructure, and runtime configuration changes in Plan Mode and
implements the smallest reversible operational diff in Default mode.

It optimizes for safety, repeatability, auditability, rollback readiness, and
minimal blast radius. It is not a Global Project Memory writer.

---

## Activation

- Canonical path on both supported runtimes: `/skills`
- Codex direct invocation target: `$pairslash-devops`
- Copilot direct invocation target: `/pairslash-devops`
- Direct invocation remains unverified until runtime evidence is recorded in
  `docs/compatibility/runtime-surface-matrix.yaml`

---

## Input contract

- `task` is required.
- `affected_environments` and `affected_paths` are optional.
- Environment scope should be explicit when the change spans staging or production.

---

## Mode contract

### Plan Mode

- Reads project memory and repo state.
- Does not edit files.
- Outputs the ten-section devops planning report defined in the pack metadata.

### Default Mode

- Implements the smallest reversible operational diff.
- Preserves least privilege, rollback readiness, and observability.
- Outputs the seven-section devops execution report defined in the pack metadata.

---

## Failure contract

- Plan Mode must elevate destructive or secret-bearing operations explicitly.
- Default Mode must emit `BLOCKER` when rollback is unclear for production-sensitive changes.
- Validation that depends on unavailable environment access must be called out exactly.

---

## Memory contract

- Global Project Memory: read only
- Task memory: read only
- Session context: implicit read
- Any memory write: forbidden

This pack must never imply or perform Global Project Memory writes.
