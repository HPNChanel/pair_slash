---
id: T8-02
track: T8
title: retrieval-index — deterministic indexer over .pairslash read surfaces
status: done
depends_on: [T8-01]
est_size: M
claimed_by: devin
claimed_at: 2026-09-29
completed_at: 2026-09-29
evidence: "Implemented packages/advanced/retrieval-index in strict TS. Index location decision: .pairslash/observability/indexes/retrieval/ — collision check confirmed observability/indexes/ is the trace session-index dir (sess-*.json, packages/tools/trace/src/store.ts); retrieval/ subdir is namespace-disjoint. Determinism: sorted sources/files + stableJson, no wall-clock timestamps; byte-identical across runs (sha256 assert). Atomic write tmp+rename; writes confined to index dir, repo-root escape throws fail-closed. Staleness: assessIndexStaleness reports missing/stale/fresh with per-file reasons (changed/added/removed). 6 package tests, registered in run-compat-lab-tests.mjs. Gates: typecheck/lint/test/test:release green."
---

## Objective

Implement `packages/advanced/retrieval-index`: a deterministic on-disk index over `.pairslash/project-memory/`, `task-memory/`, `sessions/` enabling retrieval-engine lookups — writing only to its own index dir, never to memory surfaces.

## Context & sources

- July plan proposed `.pairslash/observability/` as index location — open question flagged then: possible collision with trace storage under the same prefix. Verify actual layout; prefer `.pairslash/index/` or `observability/indexes/` (observability already has `indexes/` subdir — confirmed by `ls`: `.pairslash/observability/indexes` exists).
- Index content: memory record ids, kinds, tags, scopes, file paths, timestamps — derived read-only metadata, NOT the memory content itself (index is a lookup aid).
- Determinism is mandatory (C.7): same inputs → byte-identical index.

## Files to touch

- `packages/advanced/retrieval-index/src/` — implement indexer (TS, strict)
- `packages/advanced/retrieval-index/package.json`, tests
- `.pairslash/observability/indexes/` layout doc if the dir convention is defined — check trace's usage first
- Do NOT touch: `project-memory/` content, trace store internals, sessions content

## Work steps

1. Verify `.pairslash/observability/` usage: what's under `indexes/` already (trace artifacts?) — choose non-colliding subdir, e.g., `observability/indexes/retrieval/`.
2. Implement indexer: walk memory dirs → parse YAML frontmatter/records → emit deterministic index JSON (sorted keys, stable ids, content hashes for staleness detection).
3. Index writes atomic (tmp + rename) — partial index never readable.
4. Staleness: index carries source-file hashes; lookup layer reports stale when hash mismatch (honest staleness, not silent).
5. Tests: determinism (same input → same bytes), staleness detection, atomic-write behavior, no writes outside index dir.
6. Gates.

## Constraints (STRICT)

- MUST write only to its own index dir — any write targeting project-memory/task-memory/sessions is a hard violation (C.3).
- MUST be deterministic (sorted keys, stable ordering, no timestamps-in-output unless they're source-derived).
- MUST mark stale index explicitly — lookup MUST NOT silently serve stale results (C.10).
- Atomic writes only (tmp+rename).
- MUST NOT index files excluded from reading (respect `.gitignore`-style boundaries + private markers if they exist in memory schema).

## Acceptance gates

- [ ] Deterministic index output (byte-stable across runs)
- [ ] Staleness detection tested
- [ ] Zero writes outside index dir (test asserts via fs spy/fixture)
- [ ] Gates green

## Evidence to record

- Index location decision + collision check result; determinism test output.

## Rollback

`git revert`; index dir is derived data — safe to delete.
