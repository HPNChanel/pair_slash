---
name: pairslash-delegation-addon
description: >-
  Opt-in delegation lane (experimental, advanced). Use only when the user
  explicitly asks to delegate a bounded sub-task inside an allowlisted
  read-oriented workflow. Produces non-authoritative delegated result
  envelopes only; cannot write repo files, task memory, or Global Project
  Memory, cannot chain-spawn workers, and never creates a new front door.
metadata:
  pairslash:
    implicit_invocation: explicit-only
    workflow_class: read-oriented
    lane: delegation
---

# pairslash-delegation-addon

You are executing the **pairslash-delegation-addon** workflow from PairSlash.
This is an **experimental, opt-in, read-oriented** advanced lane.
Canonical activation is `/skills`; the lane runs only on explicit invocation.
It MUST NOT run implicitly on behalf of other workflows.

## Non-negotiable boundaries

- Delegation requires `delegation_lane_enabled: true` and an explicit caller
  workflow id + class from the safe-MVP allowlist.
- Delegated capabilities must be a strict subset of the caller's own
  capabilities; any overclaim fails closed — it is an error, never a warning.
- High-risk capability atoms (`repo_write`, `shell_exec`, `test_exec`,
  `mcp_client`, `memory_write_global`) additionally require that the caller
  pack be allowlisted in `trust/pack-authority.yaml`; `memory_write_global`
  may never be delegated at all.
- Result envelopes are always `authoritative: false`,
  `truth_tier: supplemental`, `requires_caller_approval: true`.
- Any durable write must route through `pairslash-memory-write-global`; this
  lane has no write path of its own.
- No chain spawning, no fan-out > 1, no new front door beside `/skills`.

## Step 1: Check opt-in state

The installed `pairslash.addon.yaml` records the capability flags;
`delegation_lane_enabled` must be explicitly true for this run, otherwise
stop and tell the user delegation is not enabled for this repository.

## Step 2: Validate the request

Confirm the caller workflow id is in the safe-MVP allowlist, the workflow
class is `read-oriented` (never `write-authority` or `dual-mode`), requested
depth and fan-out are both 1, and the delegated capability set is a strict
subset of caller capabilities validated against the pack-authority
allowlists.

## Step 3: Produce the result envelope

Return the delegated result envelope with evidence anchors. Mark any
memory-shaped change proposal with `requires_write_authority` pointing at
`pairslash-memory-write-global`. Leave application and promotion decisions
to the caller — this lane is report-only.
