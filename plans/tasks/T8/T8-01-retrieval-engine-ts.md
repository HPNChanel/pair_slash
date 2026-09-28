---
id: T8-01
track: T8
title: retrieval-engine → TypeScript + policy gating + non-authoritative envelopes
status: todo
depends_on: []
est_size: M
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Migrate `packages/advanced/retrieval-engine` from `.js` scaffold to implemented TS slice: explicit-invocation read-only retrieval over PairSlash memory surfaces, policy-gated, with non-authoritative result envelopes.

## Context & sources

- Current: `src/index.js` scaffold, `private`, outside workspace include set (workspaces = core/runtimes/tools only).
- Requirements (July roadmap A1): read-only slice reusing `@pairslash/policy-engine`; result envelopes tagged `supporting` (Phase-17 read-authority truth tier), never `authoritative`; policy gating prevents any write path.
- Gate: T5 spec-core strict-clean (imports spec-core types).
- Workspace inclusion: stays outside root `workspaces` until test coverage exists — this task adds the package's own tests first, then decides inclusion (prefer: implement + test while still external; workspace add is its own line-item if coverage is met).

## Files to touch

- `packages/advanced/retrieval-engine/src/*.js` → `.ts` (migrate + implement)
- `packages/advanced/retrieval-engine/package.json` — types/exports + deps on `@pairslash/spec-core`/`policy-engine`
- `packages/advanced/retrieval-engine/tests/` — new tests
- Do NOT touch: root `workspaces` (inclusion is gated), core packages, memory-engine write paths

## Work steps

1. Read the scaffold + `packs/advanced/retrieval/contract.md` for the intended contract.
2. Implement: query interface over `.pairslash/project-memory/`, `task-memory/`, `sessions/` (read-only); results wrapped in envelopes tagged `supporting` truth tier with provenance (source file, record id, timestamp).
3. Policy gating: evaluate every request through policy-engine; any write-shaped request → deny verdict (fail closed).
4. TS strict-clean from day one (T5 is done — new code is strict by default).
5. Tests: policy denies write attempts; envelopes labeled correctly; read-path never opens write handles (assert no write syscalls — e.g., mock fs).
6. Gates.

## Constraints (STRICT)

- MUST be read-only — no write paths exist in this package at all (strongest guarantee: import nothing that can write project-memory; lint rule blocks memory-engine write-pipeline imports).
- Result envelopes MUST carry `truth_tier: "supplemental"`/supporting labeling — never `authoritative` (Phase-17 charter).
- MUST stay opt-in: not in default catalog, not in `--pack-set core`, not in `--all`.
- MUST NOT import from runtime packages (core/advanced dependency rules per lint-bridge boundary checks).
- New code MUST pass strict typecheck (the repo is strict by T8 start).

## Acceptance gates

- [ ] Package implemented + strict-clean + tested
- [ ] Write-attempt deny test passes
- [ ] Envelope tier labeling tested
- [ ] Gates green

## Evidence to record

- API surface; envelope example; policy-deny test output.

## Rollback

`git revert` — new package content, isolated.
