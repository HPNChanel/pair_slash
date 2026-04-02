# ADR 0002: Keep Phase 11 Retrieval Lane Non-Authoritative and Outside Core Install Path

Status: Accepted
Date: 2026-04-02

## Context

PairSlash core is already opinionated about trust and installation boundaries:

- Global Project Memory is authoritative project truth.
- `/skills` is the canonical front door.
- Core pack discovery reads from `packs/core/`.
- Root workspaces only include `packages/core/*`, `packages/runtimes/*`, and
  `packages/tools/*`.
- The current core capability enum does not include retrieval-specific flags.
- Candidate extraction already requires authoritative reconciliation and blocks
  implicit promotion.

That means a Retrieval Lane can be useful only if it improves read-time context
lookup without diluting the existing source-of-truth model.

## Decision

Phase 11 Retrieval is defined as an advanced optional lane with these rules:

1. Retrieval is supplemental context only.
2. Retrieval is not authoritative memory.
3. Retrieval must not write Global Project Memory, task memory, session memory,
   staging, runtime roots, or repo files.
4. Retrieval must not auto-promote any fact into Global Project Memory.
5. Retrieval must not become a required dependency of any core workflow.
6. Retrieval must stay outside the current core install path and default pack
   discovery path.
7. Retrieval capability flags remain lane-local in the first slice instead of
   being added to the core capability enum.
8. The only allowed path from retrieved fact to authoritative fact is:
   `retrieval -> pairslash-memory-candidate -> pairslash-memory-write-global`.

Allowed first-slice retrieval sources:

- local repo files
- local docs snapshots
- explicit artifact indexes

Disallowed first-slice retrieval sources:

- live external retrieval
- background crawlers or daemons
- silent MCP-backed network fetch

Optional retrieval indexes may exist, but only as explicit advanced-lane state
stored outside core runtime install roots and outside `.pairslash/project-memory/`.

## Consequences

- Root `package.json` workspaces remain unchanged.
- Core pack discovery remains unchanged.
- Core installer, doctor, lint, and runtime adapters remain unchanged in this
  slice.
- Retrieval design can be documented and scaffolded under `packages/advanced/*`
  and `packs/advanced/*` without changing core behavior.
- Any future implementation that blurs the Memory vs Retrieval boundary is out
  of scope and must be rejected or redesigned.

## Follow-up

1. Keep Retrieval Lane details in `docs/phase-11/retrieval-lane.md`.
2. Use non-core scaffolding only until an isolated prototype is explicitly
   approved.
3. Do not add retrieval manifests to `packs/core/` or retrieval packages to the
   root workspaces until a later accepted decision changes that boundary.
