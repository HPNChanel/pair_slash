---
id: T8-06
track: T8
title: Advanced README/catalog sync + experimental labeling
status: done
depends_on: [T8-01, T8-02, T8-03, T8-04, T8-05]
est_size: S
claimed_by: devin
claimed_at: 2026-09-29
completed_at: 2026-09-29
evidence: all three advanced manifests + generated packs.yaml at status=experimental; READMEs synced to implemented-experimental truth (explicit install lane, non-authoritative invariants, unverified runtime support); installer exclusion tests 50/50 incl. advanced negative-selection; sync --check/lint/typecheck/npm test/test:release green
---

## Objective

Sync `packages/advanced/README.md`, `packs/advanced/README.md`, and `registry/packs.yaml` advanced-exclusion metadata with the implemented-but-experimental reality after T8-01…05.

## Context & sources

- Advanced packages went from design-only scaffolds to implemented slices — docs and catalog metadata must say "implemented + experimental + opt-in" rather than "scaffold-only" (where true) or anything stronger (never).
- `registry/packs.yaml` `excluded_repo_manifests` records each advanced pack's `status` (`prototype`/`scaffold-only`) — update status values honestly.

## Files to touch

- `packages/advanced/README.md`, `packs/advanced/README.md`
- `packages/core/spec-core/registry/packs.yaml` — regenerate via tooling or careful edit per its generator
- `packs/advanced/*/pack.manifest.yaml` — status fields (`prototype` → `experimental` where implemented)
- Do NOT touch: core manifests, maturity labels beyond honest `experimental` level

## Work steps

1. Update both READMEs: per-slice status (implemented/experimental), opt-in install path, boundary notes (non-authoritative, explicit-only).
2. Update manifests' status fields honestly.
3. Regenerate/sync registry metadata.
4. Verify lint's exclusion machinery still treats advanced as excluded (negative test).
5. Gates; mark T8 done.

## Constraints (STRICT)

- MUST label everything `experimental` — implemented ≠ stable; no overclaim (C.6).
- MUST keep exclusion from default surfaces — the sync describes status, not promotion.
- MUST NOT imply marketplace/distribution availability (T3/T7-gated separately).

## Acceptance gates

- [x] Docs/manifests reflect implemented-experimental truth
- [x] Exclusion negative tests green
- [x] Gates green; T8 marked done

## Evidence to record

- Status-field diffs; README updates.

## Rollback

`git revert`.
