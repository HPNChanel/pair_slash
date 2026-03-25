# PairSlash Phase 3.5 Benchmark Scoring Rubric

This rubric is designed for before/after comparison:

- `raw_cli`: direct Codex CLI or GitHub Copilot CLI usage
- `pairslash`: PairSlash workflow usage

The rubric measures value outcomes, not output polish.

## Core Task Metrics (Required)

These metrics are required for every benchmark run.

| Metric | Definition | How to measure | Acceptable range | Warning threshold | Why this metric matters |
|---|---|---|---|---|---|
| `time_to_first_success_seconds` | Seconds from first prompt to first usable output that meets task minimum success checkpoint | Log timestamps (`start_ts`, `first_success_ts`), observer confirms first output is usable | `must_win <= 900`, `should_win <= 780`, `supporting <= 660` | Any run above acceptable + 20% | Measures time-to-value for real workflows |
| `manual_rescue_count` | Number of times human must intervene to recover blocked/incorrect flow | Observer marks rescue events in log | `must_win = 0`, `should_win <= 1`, `supporting <= 1` | `must_win >= 1` or others `>= 2` | Direct trust and automation boundary signal |
| `reprompt_count` | Number of corrective prompts needed to complete same task | Count prompts tagged as correction/recovery | `must_win <= 3`, `should_win <= 4`, `supporting <= 4` | `>= 6` | Proxy for almost-right churn and operator effort |
| `weekly_reusability_score` | Likelihood user reuses same flow next week, anchored 0-3 | End-of-run participant answer + observer anchoring | `>= 2` for must/should, `>= 1` for supporting | `< 1.5` average in any wedge | Distinguishes real habit potential from novelty |

Anchors for `weekly_reusability_score`:

- `0`: would not reuse
- `1`: maybe once, mostly novelty
- `2`: likely reuse if same trigger recurs
- `3`: would make this default for that workflow

## Operating KPI Metrics

These metrics are tracked per run and rolled up by cohort.

| KPI metric | Definition | How to measure | Acceptable range | Warning threshold | Why this metric matters |
|---|---|---|---|---|---|
| `task_success_without_manual_rescue` | Task completed successfully with zero rescues | Derived from outcome and rescue count | `>= 0.75` on must-win tasks, `>= 0.70` overall | `< 0.60` on must-win or `< 0.55` overall | Core roadmap KPI for reliable workflow execution |
| `rework_reduction_pct_vs_raw` | Percent reduction in rework minutes vs raw CLI baseline on same task | Compare paired runs (AB/BA) | `>= 30%` reduction | `< 10%` reduction | Captures reduction of almost-right AI cleanup |
| `repeated_weekly_use_rate` | Share of runs with `weekly_reusability_score >= 2` | Aggregate by wedge and overall | `>= 60%` overall, `>= 65%` on must-win | `< 45%` overall | Retention proxy for Phase 3.5 gate |
| `install_doctor_success_rate` | Success rate for install + doctor tasks | Aggregate `BM-OPS-01` outcomes | `>= 90%` | `< 75%` | Required for adoption at scale |
| `issue_reproducibility_rate` | Success rate reproducing reported issues | Aggregate `BM-RFL-03` outcomes | `>= 70%` | `< 50%` | Operational reliability signal for maintainer workflows |

## Per-Run Scoring Bands (0-3)

Use these bands to convert core metrics into comparable scores.

### `time_to_first_success_seconds` score

- `3`: within acceptable range
- `2`: acceptable range + 10%
- `1`: acceptable range + 20%
- `0`: worse than acceptable range + 20%

### `manual_rescue_count` score

- Must-win tasks:
  - `3`: 0 rescues
  - `0`: >= 1 rescue
- Should-win and supporting:
  - `3`: 0 rescues
  - `2`: 1 rescue
  - `0`: >= 2 rescues

### `reprompt_count` score

- `3`: within acceptable range
- `2`: acceptable + 1
- `1`: acceptable + 2
- `0`: acceptable + 3 or more

### `weekly_reusability_score` score

- same as raw value (`0-3`)

## Weighted Task Score

Per-run base score:

- `core_score = ttfs_score + rescue_score + reprompt_score + weekly_score` (0-12)

Priority multipliers:

- `must_win`: `1.5`
- `should_win`: `1.2`
- `supporting`: `1.0`

Weighted score:

- `weighted_task_score = core_score * priority_multiplier`

## Gate Conditions (Benchmark-Level)

A benchmark cycle is `NO-GO` if any condition is true:

- any must-win task has run with hidden write behavior
- any must-win task fails `task_success_without_manual_rescue`
- overall `rework_reduction_pct_vs_raw < 10%`
- overall `repeated_weekly_use_rate < 45%`
- runtime scope drifts outside Codex CLI and GitHub Copilot CLI

A benchmark cycle is `GO-candidate` only if all are true:

- all three must-win tasks pass on both runtimes
- overall `task_success_without_manual_rescue >= 0.70`
- overall `rework_reduction_pct_vs_raw >= 30%`
- overall `repeated_weekly_use_rate >= 60%`
- no trust-boundary violation in memory-write tasks

## Human Observation vs Machine Logging

Machine-loggable:

- timestamps
- prompt counts
- rescue count
- outcome tags
- install and issue reproduction outcomes

Requires human observation:

- first-success usability judgment
- rescue reason classification
- whether weekly-reuse claim is credible or novelty-driven
- trust-boundary interpretation for ambiguous events
