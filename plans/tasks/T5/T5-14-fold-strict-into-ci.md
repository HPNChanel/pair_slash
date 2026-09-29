---
id: T5-14
track: T5
title: Flip root tsconfig strict, delete tsconfig.strict.json, wire CI + evidence
status: done
depends_on: [T5-13]
est_size: S
claimed_by:
claimed_at:
completed_at: 2026-09-session
evidence:
  strict_total: "npm run typecheck = strict pass, 0 errors (single config after fold)"
  trajectory: "3,331 baseline (M3 plan) -> 778 spec-core schemas -> 0 after T5-05..T5-13 batches; repo-total 0 at flip"
  config_diff: "tsconfig.json strict/noImplicitAny/strictNullChecks true; tsconfig.strict.json deleted; run-typecheck.mjs single-pass strict; typecheck:strict script removed; CI gate npm run typecheck already covers strict"
  gates: "typecheck green (strict); lint 0 errors; npm test green; test:release pass"
---

## Objective

Fold strict flags into the root `tsconfig.json`, delete `tsconfig.strict.json`, retire `typecheck:strict`, and make strict typecheck a permanent CI gate — closing M3.

## Context & sources

- Mechanism per M3 plan: when all packages graduate, strict flags move into root config; the dual-config file is deleted.
- `scripts/run-typecheck.mjs` runs relaxed then strict-if-nonempty — after the flip it runs one strict pass; update the script + `package.json` scripts + `repo-checks.yml` accordingly.
- `.kilo/plans/*-ts-strictness-tightening.md` + mega plan describe the intended end state.

## Files to touch

- `tsconfig.json` — strict flags on; update the `"//"` comment to reflect end-state
- Delete `tsconfig.strict.json`
- `scripts/run-typecheck.mjs` — single-pass strict run
- `package.json` — `typecheck:strict` script retired or aliased to `typecheck` (decide: keep alias for muscle memory vs remove — prefer removal with a note, it's cleaner)
- `.github/workflows/repo-checks.yml` — confirm typecheck gate runs the strict config (it already runs `npm run typecheck`)
- `AGENTS.md`/docs referencing dual-config — update
- `plans/tracks/T5-*.md` status → done

## Work steps

1. Verify `typecheck:strict` total = 0 (T5-13 exit).
2. Move strict flags into `tsconfig.json`; delete `tsconfig.strict.json`; simplify `run-typecheck.mjs` to single pass; update scripts.
3. `npm run typecheck` → 0 errors on strict config.
4. Update doc references (`AGENTS.md`, tsconfig comment, any docs mentioning dual-config).
5. Full gates incl. test:release; commit `feat(m3): graduate all packages to strict TypeScript — fold config, retire dual-config`.
6. Mark T5 done; record final evidence (strict error trajectory 3,331 → 0).

## Constraints (STRICT)

- MUST NOT weaken any strict flag during the fold — all flags on: `strict`, `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`, existing flags preserved.
- MUST NOT leave orphaned references to `tsconfig.strict.json` anywhere (grep the repo).
- MUST record the error-count trajectory honestly in evidence.
- MUST NOT bundle this with unrelated changes — the flip commit is clean + revertible.

## Acceptance gates

- [ ] `npm run typecheck` = strict pass with 0 errors
- [ ] No `tsconfig.strict.json` references remain
- [ ] All gates green; T5 marked done

## Evidence to record

- Error trajectory table (baseline → 0); config diff; commit hash.

## Rollback

`git revert` — restores dual-config + relaxed gate if a regression surfaces.
