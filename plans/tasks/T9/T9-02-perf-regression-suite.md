---
id: T9-02
track: T9
title: Perf regression suite (nightly-only)
status: done
depends_on: []
est_size: M
claimed_by: devin
claimed_at: 2026-10-01
completed_at: 2026-10-01
evidence: |
  tests/perf/run-perf.mjs measures 5 deterministic operations
  (catalog snapshot load, codex/copilot compile, install preview,
  memory-write preview) on a shared createTempRepo fixture —
  warmup + N runs, median, sample list in the report. Baselines are
  keyed per environment class (os + node major) in
  tests/perf/baseline.json with node/platform/runs/warmup provenance;
  comparisons flag >2x as "regression" and <0.5x as
  "suspiciously-fast" — review signals only, exit code always 0.
  Wired into compat-lab-nightly.yml as a separate informational job
  (linux + windows, node 24) that uploads the JSON report artifact.
  Not part of `npm run test` default lane beyond a 1-iteration shape
  smoke test (tests/perf/perf-suite.test.js). Manual runs:
  `npm run test:perf`, baseline refresh via --update-baseline.
  Gates: typecheck, lint, npm test, test:release green.
---

## Objective

Add `tests/perf/` with a small benchmark suite pinning latency baselines for install/preview/memory-write paths, wired into `nightly-smoke` only — never gating PRs.

## Context & sources

- Paths worth pinning: compile pack (both runtimes), install preview generation, memory-write preview pipeline (the ~28s memory test block suggests heavier paths worth a baseline), pack-catalog load.
- Approach: measure → record baseline file → compare with tolerance band (e.g., >2x regression = report line, not fail — or warn-level first; decide threshold policy and record it).
- Nightly workflow: `compat-lab-nightly.yml` — add a perf job or fold into existing nightly steps.

## Files to touch

- `tests/perf/` — new suite + baseline file
- `.github/workflows/compat-lab-nightly.yml` — perf job
- `scripts/` — runner if needed (prefer reusing `run-tests.mjs` patterns)
- Do NOT touch: PR-blocking gates (perf is informational)

## Work steps

1. Pick 3–5 highest-value paths; write micro-benchmarks with fixed fixtures (deterministic inputs).
2. Persist baseline JSON (committed) + comparison logic with explicit tolerance + iteration counts (warmup + N runs, report median).
3. Nightly wiring; report artifact upload for trend visibility.
4. Document interpretation: regressions are signals for review, not automatic failures (until baselines prove stable enough to hard-gate — later decision).
5. Gates (must not slow `npm run test` materially — perf suite not in it).

## Constraints (STRICT)

- MUST be nightly-only — PR `npm run test` duration may not regress.
- MUST use deterministic fixtures — a perf test on random input is noise.
- MUST record baseline provenance (Node version, OS) — baselines are per-environment-class; don't compare across OS blindly.
- MUST NOT assert hard timing thresholds in PR lanes.
- Report MUST be honest about variance — include run counts + medians, not single samples.

## Acceptance gates

- [ ] Perf suite runs in nightly; baselines recorded; `npm run test` unchanged
- [ ] Gates green

## Evidence to record

- Baseline file + first nightly report artifact ref.

## Rollback

`git revert` — additive suite.
