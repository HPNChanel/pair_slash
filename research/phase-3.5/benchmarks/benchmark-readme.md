# PairSlash Phase 3.5 Benchmark README

## Purpose

This benchmark pack evaluates whether PairSlash creates measurable value on recurring terminal workflows, not demo quality.

Primary comparison:

- PairSlash workflow (`pairslash`)
- Raw CLI workflow (`raw_cli`) on the same task and repo snapshot

## Files in This Pack

- `benchmark-task-catalog.md`
- `benchmark-task-catalog.yaml`
- `scoring-rubric.md`
- `scoring-rubric.yaml`
- `harness-design.md`
- `log-schema.yaml`
- `results-template.csv`

## Must Win / Should Win / Supporting

Must win:

- `BM-ONB-01`
- `BM-RFL-01`
- `BM-MEM-02`

Should win:

- `BM-ONB-02`
- `BM-RFL-02`
- `BM-MEM-03`

Supporting:

- `BM-RFL-03`
- `BM-MEM-01`
- `BM-OPS-01`
- `BM-CONT-01`

## How to Run Benchmarks

1. Select participant and runtime lane.
2. Assign three required tasks:
   - one onboarding
   - one review/fix
   - one memory candidate/write
3. Run AB/BA paired comparison:
   - one run in `raw_cli`
   - one run in `pairslash`
4. Reset to same repo snapshot between arms.
5. Capture log fields using `log-schema.yaml`.
6. Append each run as one row in `results-template.csv`.

## How to Score

1. Compute core metrics per run:
   - `time_to_first_success_seconds`
   - `manual_rescue_count`
   - `reprompt_count`
   - `weekly_reusability_score`
2. Convert each core metric to score bands using `scoring-rubric.md`.
3. Compute:
   - `core_score = ttfs_score + rescue_score + reprompt_score + weekly_score`
   - `weighted_task_score = core_score * priority_multiplier`
4. Apply benchmark-level gate checks:
   - must-win pass on both runtimes
   - no hidden write behavior
   - KPI thresholds met

## How to Aggregate

Aggregate views required:

- by task ID
- by wedge workflow
- by runtime lane
- by ICP segment
- overall before/after deltas versus raw CLI

Required aggregate KPIs:

- `task_success_without_manual_rescue`
- `rework_reduction_pct_vs_raw`
- `repeated_weekly_use_rate`
- `install_doctor_success_rate`
- `issue_reproducibility_rate`

## How to Report

Include in benchmark report:

- sample size and cohort composition
- must/should/supporting pass rates
- paired deltas versus raw CLI
- KPI outcomes against thresholds
- strongest and weakest failure modes
- recommendation: `GO-candidate` or `NO-GO`

Use concrete evidence:

- run IDs
- transcript references
- participant quotes on weekly reuse
- rescue events and reasons

## Bias and Validity Warnings

- Do not treat polished output as success without rescue and reuse evidence.
- Do not compare runs with different repo snapshots.
- Do not ignore order effects; enforce AB/BA crossover.
- Do not let setup friction dominate interpretation of core wedge value.
- Do not infer demand from positive language without repeat-use triggers.
- Do not merge ICP segments before segment-level analysis.
- Do not count invalid runs toward KPI thresholds.
