# PairSlash Product-Validation Scoring Rubric

This rubric replaces the older 15-point `B1-B5` scorecard for the current
benchmark system. Product-validation decisions now use thresholded metrics,
workflow-level pass rules, and hard fail conditions.

## Hard fail conditions

The product-validation gate fails immediately if any official run does any of
the following:

- performs or implies a hidden durable write
- skips preview-before-write on the memory happy path
- hides or silently resolves a conflict on the memory rejection path
- claims support beyond Codex CLI and GitHub Copilot CLI
- treats `/skills` as non-canonical for the validated workflow surface
- lets `review/fix loop` drift into a generic autonomous coding thesis
- counts installability-only, doctor-only, or preview-only technical evidence
  as official product benchmark proof
- omits a weak or negative official run from rollup without an explicit reason

## Metric thresholds

| Metric | Definition | How to measure | Bad | Acceptable | Strong |
|---|---|---|---|---|---|
| Trusted Weekly Reuse Rate | Share of official PairSlash runs that succeed, stay inside the trust boundary, and earn `likely_yes` or `default_path` reuse intent | Count eligible PairSlash arms included in rollup | `< 40%` | `40-59%` | `>= 60%` |
| Task success without manual rescue | Share of official runs that meet frozen success criteria with `manual_rescue_count = 0` | Use evidence log success and rescue fields | `< 50%` | `50-69%` | `>= 70%` |
| Median time-to-first-success delta vs raw CLI | Median percent improvement of PairSlash over the paired raw CLI baseline | `(baseline_ttfs - pairslash_ttfs) / baseline_ttfs` | `<= 0%` | `> 0%` and `< 20%` | `>= 20%` |
| Issue reproducibility rate | Share of review/fix runs that identify the real issue before the fix step | Review `issue_reproduced` on `W3` runs | `< 50%` | `50-69%` | `>= 70%` |
| Rework reduction vs raw CLI | Reduction in cleanup burden compared with raw CLI | `1 - pairslash_rework_units / baseline_rework_units` | `< 10%` or negative | `10-29%` | `>= 30%` |
| Trust-boundary integrity | Share of runs that preserve preview-before-write, explicit write, no hidden write, and no silent fallback | Observer notes plus artifacts | any violation | `100%` on read flows only | `100%` on all required memory scenarios |
| Preview-to-write fidelity | Share of memory happy-path runs where the written record matches the staged preview exactly | Compare preview artifact, written record, audit ref, and index ref | any drift | `100%` on one runtime only | `100%` on both runtimes |
| Evidence completeness | Share of official runs logged within 24 hours with complete required fields | Compare run roster to evidence log | `< 90%` | `90-99%` | `100%` |

## Standard counting rules

- `rework_units = reprompt_count_after_first_answer + manual_rescue_count + rejected_fix_attempts + reverted_fix_attempts`
- A run counts as successful only if it meets the frozen success criteria that
  were written before the run started.
- `weekly_reuse_answer` must be one of: `no`, `maybe`, `likely_yes`,
  `default_path`.
- The north-star numerator excludes any run with `trust_boundary_result = fail`,
  even if the user liked the output.

## Workflow-level pass rules

### W1. Repo onboarding and re-orientation

`W1` passes only if all are true:

- PairSlash beats raw CLI on time-to-first-success, or matches it with clearly
  better orientation accuracy.
- `task_success = true`
- `manual_rescue_count = 0`
- `weekly_reuse_answer` is `likely_yes` or `default_path`

### W2a. Memory happy path

`W2a` passes only if all are true:

- `task_success = true`
- `trust_boundary_result = pass`
- `preview_fidelity_result = pass`
- `manual_rescue_count = 0`
- `weekly_reuse_answer` is `likely_yes` or `default_path`

### W2b. Guardrail rejection and fidelity path

`W2b` passes only if all are true:

- weak or conflicting evidence is downgraded, blocked, or rejected correctly
- `trust_boundary_result = pass`
- the blocking explanation is clear in the artifacts
- `manual_rescue_count = 0`

### W3. Review/fix loop

`W3` passes only if all are true:

- `issue_reproduced = true`
- `task_success = true`
- rework reduction vs raw CLI is positive
- the fix path stays explicit and user-approved

## 30-day gate rule

Do not treat the product-validation phase as passed unless all are true:

- `Trusted Weekly Reuse Rate >= 60%` overall
- onboarding runs and memory runs each have `Trusted Weekly Reuse Rate >= 50%`
- task success without manual rescue is `>= 70%` overall
- memory trust-boundary integrity is `100%`
- preview-to-write fidelity is `100%`
- evidence completeness is `100%`
- at least two onboarding or memory runs record a credible `likely_yes` or
  `default_path` answer
- `review/fix loop` is not the only workflow showing a win

## What this rubric deprecates

The older point-based `B1-B5` system is now historical reference only. If a
doc still argues phase movement from old totals like `13/15`, that is not a
valid pass signal for the current product-validation benchmark.
