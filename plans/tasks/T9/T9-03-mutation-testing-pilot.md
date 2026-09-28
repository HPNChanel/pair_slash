---
id: T9-03
track: T9
title: Mutation testing pilot — memory-engine scope, report-only
status: todo
depends_on: []
est_size: M
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Pilot mutation testing scoped to `packages/core/memory-engine` (highest-value package) — measure mutation score, publish report artifact, do NOT gate CI.

## Context & sources

- Mutation testing reveals test-suite weakness: mutants (inverted conditions, removed calls) that tests don't catch = coverage illusion. memory-engine's write pipeline is where weak tests are most dangerous.
- Tooling: Stryker (`@stryker-mutator/core`) is the standard for JS/TS — but it expects a build/test setup; Node type-stripping + node:test may need config care. Alternative: hand-rolled mutation runner is NOT recommended (scope). Verify Stryker + node:test compat; if incompatible, record the blocker honestly and choose the minimal viable alternative.
- Report-only: mutation score informs future hardening tasks; not a gate.

## Files to touch

- `package.json` devDeps — stryker or equivalent (G9 review)
- `stryker.conf.mjs` (or equivalent config) scoped to memory-engine
- `.github/workflows/compat-lab-nightly.yml` — mutation job (nightly)
- `docs/maintainers/` — how to read the report
- Do NOT touch: memory-engine source (mutants are generated, not committed), PR gates

## Work steps

1. Evaluate Stryker vs repo stack (node:test + type-stripping + ESM). Spike it: can it mutate `.ts` directly or need instrumenting transform?
2. Configure scope: memory-engine only; mutate `src/**` not tests.
3. Run; produce mutation score + survivor list report artifact.
4. Nightly job + artifact upload.
5. Doc: interpreting survivors; survivors become future test-hardening task inputs.
6. Gates (`npm run test` unaffected).

## Constraints (STRICT)

- MUST be report-only — mutation score never gates CI in this pilot.
- MUST scope to memory-engine only — repo-wide mutation is too slow/noisy for a pilot.
- MUST NOT weaken tests to game the score (C.10 — honest signal).
- New devDeps need G9 review (pinned ≥7 days, license OK).
- MUST handle timeout/killed-mutant accounting honestly in the report.

## Acceptance gates

- [ ] Pilot runs in nightly; report artifact produced
- [ ] Survivor list documented for follow-up
- [ ] `npm run test` unaffected

## Evidence to record

- First mutation report summary + score.

## Rollback

`git revert` — additive tooling.
