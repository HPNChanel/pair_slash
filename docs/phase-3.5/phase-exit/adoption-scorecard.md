# PairSlash 30-Day Adoption Scorecard

Date: 2026-03-31
Status: active scorecard for the current product-validation phase

This scorecard decides whether PairSlash is earning repeated use on real wedge
jobs. It does not reward breadth, package count, installability polish, or
architecture maturity by themselves.

## KPI table

| KPI | Threshold | Current state | Measurement source | Owner | Why it matters |
|---|---|---|---|---|---|
| Trusted Weekly Reuse Rate | `>= 60%` overall; onboarding and memory each `>= 50%` | Unmeasured: no official runs logged under the current benchmark system | `docs/validation/phase-3-5/evidence-log.md`, `north-star-metric.md` | product + validation | This is the north-star for habit plus trust |
| Task success without manual rescue | `>= 70%` overall | Unmeasured | official evidence log | validation | A workflow that needs rescue is not a repeatable wedge |
| Median time-to-first-success delta vs raw CLI | `> 0%` overall; onboarding strong signal at `>= 20%` | Unmeasured | paired benchmark runs | product | PairSlash must reduce cold-start or cleanup cost in a visible way |
| Memory trust-boundary pass rate | `100%` on `W2a` and `W2b` across both runtimes | Unmeasured | memory artifacts plus official evidence log | validation + runtime | The trust-memory moat breaks if the boundary leaks even once |
| Preview-to-write fidelity rate | `100%` on memory happy-path runs | Unmeasured | preview artifact, written record, audit ref, index ref | validation | Preview is not enough if the write diverges from what was previewed |
| Review/fix issue reproducibility rate | `>= 70%` on `W3` | Unmeasured | official evidence log | workflow owner | Review/fix only matters if it reproduces the real issue before fixing |
| Review/fix rework reduction vs raw CLI | `>= 20%`; strong at `>= 30%` | Unmeasured | paired review/fix runs | workflow owner + product | This measures whether PairSlash removes almost-right cleanup burden |
| Evidence completeness | `100%` of official runs logged within 24 hours | Unmeasured | run roster vs evidence log | validation ops | Prevents selective logging and phase inflation |

## Decision rules

- Do not move phase on a strong overall number if onboarding or memory misses
  its workflow floor.
- Do not move phase if memory trust-boundary pass rate or preview-to-write
  fidelity is below `100%`.
- Do not move phase if `review/fix loop` is the only clear win.
- Do not move phase if evidence completeness is below `100%`.

## Current read

- `Trusted Weekly Reuse Rate` remains the correct north-star, but it is still
  unmeasured under the current benchmark method.
- The two historical installability acceptance runs are excluded from this
  scorecard because they are technical evidence, not wedge evidence.
- The next 30 days should focus on official onboarding, memory, and review/fix
  runs before any broader claim is expanded.
