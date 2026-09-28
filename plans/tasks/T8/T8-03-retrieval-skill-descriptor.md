---
id: T8-03
track: T8
title: retrieval-skill — opt-in descriptor + explicit --pack install path
status: todo
depends_on: [T8-02]
est_size: S
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Wire `packs/advanced/retrieval/` + `retrieval-skill` package into an explicit-invocation install path: installable only via `pairslash install --pack pairslash-retrieval-addon` (explicit pack id), never via core sets, `--all`, or default discovery.

## Context & sources

- `packs/advanced/retrieval/pack.manifest.yaml` exists (status `prototype`, catalog `excluded-advanced-surface`).
- Pack catalog machinery explicitly excludes advanced manifests from default discovery — the exclusion must stay; this task adds the explicit-install lane.
- Contract: `packs/advanced/retrieval/contract.md` describes intended behavior.

## Files to touch

- `packs/advanced/retrieval/` — manifest updates (status stays `experimental`, maturity labels honest)
- `packages/tools/installer/src/` — explicit-pack-id path for advanced packs (if absent)
- `packages/core/spec-core/registry/packs.yaml` — advanced exclusion metadata stays accurate
- Tests — explicit install works; set-based discovery still excludes it
- Do NOT touch: default catalog selection, `--all`/`--pack-set core` semantics

## Work steps

1. Verify installer's pack-selection paths: can an explicitly-named advanced pack install today? If not, add the explicit-only path.
2. Update retrieval manifest to honest `experimental` status (not prototype-scaffold anymore once T8-01/02 land).
3. Tests: `install --pack pairslash-retrieval-addon --preview` produces plan; `--pack-set core` / `--all` / default catalog still exclude it (negative tests — regression guard for C.8).
4. Docs note in `packs/advanced/README.md`.
5. Gates.

## Constraints (STRICT)

- MUST remain excluded from every set-based selection path — negative tests required.
- MUST NOT auto-include via `default_discovery`/`default_recommendation` — stays off.
- Explicit path MUST respect preview/apply boundary (C.4) like core installs.
- Maturity labels MUST stay honest — `experimental`/`canary`-equivalent, not implied-stable.

## Acceptance gates

- [ ] Explicit install preview/apply works; set exclusion negative tests green
- [ ] Gates green

## Evidence to record

- Install-plan sample; exclusion test output.

## Rollback

`git revert`.
