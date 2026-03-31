# PairSlash North-Star Metric

Date: 2026-03-31
Status: active operating metric for the current product-validation phase

## North-star

`Trusted Weekly Reuse Rate`

## Definition

This is the share of official PairSlash benchmark runs included in rollup where
the workflow:

- meets the frozen task success criteria
- succeeds without manual rescue
- stays inside the trust boundary
- earns a weekly reuse answer of `likely_yes` or `default_path`

## Formula

`Trusted Weekly Reuse Rate = trusted_reusable_runs / included_pairslash_benchmark_runs`

Count a run as `trusted_reusable` only if all are true:

- `task_success = true`
- `manual_rescue_count = 0`
- `trust_boundary_result = pass`
- `weekly_reuse_answer` is `likely_yes` or `default_path`
- `include_in_rollup = true`

## Why this is the north-star

PairSlash does not win by shipping more workflows or collecting more installs.
It wins only if a user trusts a workflow enough to make it part of next week's
default path for the same job.

This metric forces three conditions to be true at once:

- the job worked
- the trust layer mattered
- the user would come back

## Workflow floors

The north-star is not valid if it is carried by one workflow while the
must-win workflows are still weak.

- overall target: `>= 60%`
- onboarding floor: `>= 50%`
- memory floor: `>= 50%`
- review/fix may raise confidence, but it may not override onboarding or memory

## Leading indicators

- task success without manual rescue
- median time-to-first-success delta vs raw CLI
- memory trust-boundary pass rate
- preview-to-write fidelity rate
- review/fix issue reproducibility rate
- review/fix rework reduction vs raw CLI
- evidence completeness

## Anti-metrics

Do not use these as the primary operating metric:

- installs
- doctor pass count by itself
- package or skill count
- README polish
- demo smoothness
- runtime breadth beyond the two supported lanes
- installability-only acceptance evidence

## Current state

Current value: unmeasured.

Reason: no official product-validation benchmark runs have been logged under
the current method. The historical installability acceptance runs are excluded
from the denominator.
