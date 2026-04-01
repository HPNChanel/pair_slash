---
title: Onboard Repo Before/After
phase: 9
asset_type: case-study
evidence_status: not-measured
workflow_name: pairslash-onboard-repo
runtime_lane_primary: codex-cli repo
runtime_lane_secondary: github-copilot-cli user
classification: measured-before-after-placeholder
---

# Reality Scan

## Asset Metadata

| Field | Value |
| --- | --- |
| Workflow | `pairslash-onboard-repo` |
| Runtime lane (primary) | `codex-cli` + repo target |
| Runtime lane (secondary) | `github-copilot-cli` + user target |
| Evidence status | `not-measured` |
| Claim scope allowed now | none beyond workflow intent |

## Evidence Status

- Current status: `not-measured`
- Official run IDs linked: none
- Artifact refs linked: none
- Included in benchmark rollup: no

# Decisions

## Measured Before/After Slots

Fill when measured:

- `paired_group_id`:
- `run_id_baseline`:
- `run_id_pairslash`:
- `repo_snapshot_ref`:
- `runtime`:
- `task_statement`:
- `success_criteria`:
- `baseline_method`:
- `pairslash_method`:
- `ttfs_seconds_baseline`:
- `ttfs_seconds_pairslash`:
- `task_success_baseline`:
- `task_success_pairslash`:
- `manual_rescue_count_baseline`:
- `manual_rescue_count_pairslash`:
- `reprompt_count_after_first_answer_baseline`:
- `reprompt_count_after_first_answer_pairslash`:
- `weekly_reuse_answer`:
- `weekly_reuse_reason`:

## Anecdotal Notes

Do not use this section as benchmark proof.

- User quote or note 1:
- User quote or note 2:
- Evaluator observation:

## Not-Yet-Validated Example Notes

- What can be shown safely before measurement:
  - `/skills` entrypoint
  - workflow invocation path
  - expected output sections from contract
- What cannot be claimed:
  - time improvement
  - correctness improvement
  - weekly reuse outcome

# File/Path Plan

## Required Artifact Links

- Baseline transcript:
- PairSlash transcript:
- Trace export path:
- Evaluation notes:
- Support bundle ref (if failure occurred):

## Evidence Sources To Align With

- `docs/validation/phase-3-5/benchmark-tasks.md`
- `docs/validation/phase-3-5/scoring-rubric.md`
- `docs/validation/phase-3-5/evidence-log.md`
- `docs/compatibility/compatibility-matrix.md`

# Risks / Bugs / Drift

- Risk: using a polished onboarding output as evidence without paired baseline.
- Risk: claiming cross-runtime result from one runtime lane.
- Risk: including run in rollup with incomplete artifacts.

# Acceptance Checklist

- Measured section has complete paired fields or remains explicitly empty.
- Anecdotal section is labeled non-benchmark.
- Not-yet-validated section states claim boundaries.
- Runtime lane and workflow are explicit.

# Next Handoff

- When measured, copy final run record into
  `docs/validation/phase-3-5/evidence-log.md`.
