---
title: Phase 11 Advanced Optional Lanes
phase: 11
status: experimental-docs
owner_file: docs/phase-11/README.md
baseline_source: docs/phase-11/advanced-optional-lane-charter.md
---

# Phase 11 Advanced Optional Lanes

Phase 11 is a secondary documentation surface for advanced optional lanes.
It does not widen the PairSlash core story, install path, or trust boundary.

Core PairSlash remains the main product story:

- exactly two runtimes: Codex CLI and GitHub Copilot CLI
- `/skills` as the canonical front door
- Global Project Memory as authoritative memory
- explicit-write-only and preview-first as the trust boundary

Every Phase 11 lane is opt-in, capability-gated, and outside default core
discovery and install flow.

## Read This First

- [Advanced Optional Lane Charter](advanced-optional-lane-charter.md)
- [Core PairSlash vs Advanced Optional Lanes](core-vs-advanced.md)

## Lane Index

| Lane | Slice status | Public release label | Runtime support expectation |
| --- | --- | --- | --- |
| Retrieval | `prototype-slice` | `experimental` | `design-only` |
| CI Agents / Runners | `prototype-slice` | `experimental` | `design-only` |
| Delegation / Subagents | `scaffold-only` | `experimental` | `design-only` |

No lane in this directory is part of the default first-run experience.
No lane in this directory should be presented as a broad supported runtime
feature until live evidence exists.

## Lane Documents

- Retrieval:
  [retrieval-lane.md](retrieval-lane.md),
  [retrieval-addon-usage.md](retrieval-addon-usage.md)
- CI:
  [ci-lane.md](ci-lane.md),
  [ci-addon-usage.md](ci-addon-usage.md)
- Delegation:
  [delegation-lane.md](delegation-lane.md),
  [delegation-addon-usage.md](delegation-addon-usage.md)

## Reference Docs

- [ADR 0002: Retrieval Boundary](../architecture/adr-0002-phase-11-retrieval-lane-boundary.md)
- [Phase 9 Public Docs Index](../phase-9/README.md)
- [Compatibility Matrix](../compatibility/compatibility-matrix.md)
- [Runtime Verification](../compatibility/runtime-verification.md)
- [Phase 3.5 Messaging Guardrails](../validation/phase-3-5/messaging-narrative.md)

## Guardrails

- Core onboarding, README copy, and wedge workflow narrative stay in
  [docs/phase-9](../phase-9/README.md) and the root [README](../../README.md).
- Advanced lanes do not add a new front door beside `/skills`.
- Advanced lanes do not enter `packs/core/`, root npm workspaces, or the core
  install path by default.
- Advanced lane docs must state risk, prerequisites, and support level
  explicitly.
