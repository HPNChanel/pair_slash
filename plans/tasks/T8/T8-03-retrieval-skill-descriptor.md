---
id: T8-03
track: T8
title: retrieval-skill — opt-in descriptor + explicit --pack install path
status: done
depends_on: [T8-02]
est_size: S
claimed_by: devin
claimed_at: 2026-09-29
completed_at: 2026-09-29
evidence: "Explicit install lane wired: manifestSelection resolves missing core ids against loadAdvancedPackManifestRecords into a separate advancedSelection bucket (core compile/trust/lint pipelines untouched). install --packs pairslash-retrieval-addon plans + applies SKILL.md (verbatim from pack dir, so /skills picks it up) + deterministic pairslash.addon.yaml descriptor into the pack skill dir; state/uninstall machinery tracks it unchanged. Gating: opt_in_required required, core_discovery/core_pack_set must stay false, --emit plugin denied, runtime_support declared label surfaced as warning (stays honest: no live-evidence tier). In-place update denied with update-unsupported (advanced packs change via uninstall+reinstall). Manifest status: prototype -> experimental; runtime_support: design-only -> unverified; packs.yaml regenerated (excluded-advanced-surface intact). Negative coverage: default selection, --pack-set/--all equivalence, and named core packs never include the addon; unknown ids still pack-not-found. 3 new installer tests (50/50 green); typecheck/lint/test/test:release green."
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
