---
id: T9-03
track: T9
title: Mutation testing pilot — memory-engine scope, report-only
status: done
depends_on: []
est_size: M
claimed_by: devin
claimed_at: 2026-10-01
completed_at: 2026-10-01
evidence: |
  Stryker evaluation: a direct Stryker sandbox is disproportionately
  cumbersome for this stack (ESM + Node type-stripping + file: workspace
  links + package-relative test imports under node:test), so the pilot
  uses a scoped in-place runner instead — recorded per the task's
  "minimal viable alternative" clause.
  tests/mutation/run-mutation.mjs enumerates deterministic mutation sites
  in packages/core/memory-engine/src/** (boolean flips, comparison swaps,
  logical-operator swaps), applies one mutant at a time in place, runs
  packages/core/memory-engine/tests/memory-engine.test.js, restores
  pristine source after every mutant, and registers an exit hook for
  best-effort restoration on interruption. Never commits mutants.
  Full pilot on win32-node24: 266 sites enumerated, 200 mutants run
  (66 truncated at the default --max-mutants cap), killed 38,
  survived 162, timeout 0, error 0 — score 0.19. Honest low score is
  expected pilot output: survivors cluster on report-field literals
  (committed/read_only markers) and untested branch polarity in
  apply.ts/candidate.ts/pipeline.ts — inputs for future hardening tasks,
  not a gate. Report artifact: artifacts/mutation-memory-engine.json
  (CI-uploaded; gitignored).
  Wired as nightly-only job nightly-mutation in
  .github/workflows/compat-lab-nightly.yml (ubuntu-latest, Node 24,
  artifact upload). tests/mutation/run-mutation.test.js is an
  enumerate-only smoke inside the compat runner — the full pilot is
  never in npm run test / PR gates. Docs: docs/maintainers/mutation-report.md.
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

- [x] Pilot runs in nightly; report artifact produced
- [x] Survivor list documented for follow-up
- [x] `npm run test` unaffected

## Evidence to record

- First mutation report summary + score.

## Rollback

`git revert` — additive tooling.
