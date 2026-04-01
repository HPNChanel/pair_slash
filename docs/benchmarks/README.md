# Phase 9 Benchmark Asset Index

This page is the index for public-facing benchmark assets planned in Phase 9.

It does not contain benchmark outcomes.
It tracks what exists, what is measured, and what is still unmeasured.

## Benchmark Asset Registry

| Asset | Wedge workflow | Scenario | Runtime lane | Evidence status | Rollup status |
| --- | --- | --- | --- | --- | --- |
| `docs/case-studies/onboard-repo-before-after.md` | `pairslash-onboard-repo` | cold repo re-entry vs raw CLI | primary: `codex-cli` repo | `not-measured` | excluded |
| `docs/case-studies/memory-write-global-trust-event.md` | `pairslash-memory-candidate -> pairslash-memory-write-global` | memory happy path | primary: `codex-cli` repo | `not-measured` | excluded |
| `docs/case-studies/failure-mode-runtime-mismatch.md` | `pairslash-plan` plus doctor/support path | runtime mismatch failure mode | `copilot-cli` prompt-mode and Windows prep lanes | `not-measured` | excluded |

## Required Measurement Fields

Fill all fields before any public benchmark claim:

- `paired_group_id`
- `runtime`
- `repo_snapshot_ref`
- `task_statement`
- `success_criteria`
- `baseline_method`
- `pairslash_method`
- `ttfs_seconds`
- `task_success`
- `manual_rescue_count`
- `reprompt_count_after_first_answer`
- `weekly_reuse_answer`
- `artifact_refs`
- `negative_evidence_note`

## Instrumentation And Evidence Sources

- Official schema and doctrine:
  - `docs/validation/phase-3-5/benchmark-tasks.md`
  - `docs/validation/phase-3-5/scoring-rubric.md`
  - `docs/validation/phase-3-5/runbook.md`
  - `docs/validation/phase-3-5/evidence-log.md`
- Support capture for failure-mode benchmarks:
  - `docs/support/phase-7-support-ops.md`
  - `.github/ISSUE_TEMPLATE/pairslash-support-bundle.md`

## Guardrails

- Do not relabel installability-only or doctor-only runs as wedge benchmarks.
- Do not include any asset in rollup until measured fields and artifact links
  are complete.
- Keep lane-specific support wording aligned with
  `docs/compatibility/compatibility-matrix.md`.
