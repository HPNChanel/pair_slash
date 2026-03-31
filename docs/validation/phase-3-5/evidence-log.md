# PairSlash Product-Validation Evidence Log

This log is the authoritative record for official product-validation benchmark
runs. It does not accept installability-only, doctor-only, or preview-only
technical acceptance evidence as if that evidence proved a winning wedge.

## Official run summary

No official product-validation benchmark runs are recorded yet under the
current benchmark system.

## Excluded legacy evidence

These historical entries are preserved for provenance but are excluded from the
current product scorecard.

| Run ID | Date | Runtime | What it actually tested | Include in rollup | Exclusion reason |
|---|---|---|---|---|---|
| `20260326-codex-phase4-acceptance` | 2026-03-26 | `codex-cli` | Managed installability and doctor acceptance slice | `false` | Technical installability evidence mislabeled as `B3/B4 scoped` |
| `20260326-copilot-phase4-acceptance` | 2026-03-26 | `github-copilot-cli` | Managed installability and doctor acceptance slice | `false` | Technical installability evidence mislabeled as `B3/B4 scoped` |

## Required schema

| Field | Required | Purpose |
|---|---|---|
| `run_id` | yes | Unique identifier for one recorded run |
| `paired_group_id` | yes | Joins the baseline arm and PairSlash arm for the same benchmark |
| `run_date` | yes | Supports weekly and 30-day rollups |
| `workflow` | yes | `onboard-repo`, `memory-flow`, or `review-fix-loop` |
| `scenario` | yes | `baseline`, `pairslash`, `memory-happy-path`, `memory-rejection`, or `review-fix` |
| `runtime` | yes | `codex-cli` or `github-copilot-cli` |
| `repo_snapshot_ref` | yes | Commit SHA, snapshot label, or fixture identifier |
| `arm_order` | yes | `AB`, `BA`, or `single` |
| `task_statement` | yes | The user job being benchmarked |
| `success_criteria` | yes | Frozen pass criteria written before the run |
| `baseline_method` | yes | Raw CLI or manual baseline used for comparison |
| `pairslash_method` | yes | Exact PairSlash workflow path used |
| `ttfs_seconds` | yes | Time-to-first-success in seconds |
| `task_success` | yes | Whether frozen success criteria were met |
| `manual_rescue_count` | yes | How often the evaluator had to step in to rescue the run |
| `reprompt_count_after_first_answer` | yes | Cleanup burden after the first useful output |
| `issue_reproduced` | conditional | Required for `review-fix-loop` runs |
| `rework_units` | yes | Input for rework reduction calculations |
| `trust_boundary_result` | yes | `pass`, `fail`, or `not_applicable` |
| `preview_fidelity_result` | conditional | Required for memory happy-path runs |
| `artifact_refs` | yes | Transcript, trace, preview, audit, and verification artifact refs |
| `weekly_reuse_answer` | yes | `no`, `maybe`, `likely_yes`, or `default_path` |
| `weekly_reuse_reason` | yes | Short explanation or quote-level note |
| `score_summary` | yes | Rollup-ready metric values for the run |
| `include_in_rollup` | yes | Defaults to `true`; prevents silent exclusion |
| `exclude_reason` | conditional | Required if `include_in_rollup = false` |
| `negative_evidence_note` | yes | Records what did not work, even on mixed or failed runs |

## Official entry template

```yaml
run_id: 2026-04-xx-onboard-codex-01
paired_group_id: grp-2026-04-xx-onboard-01
run_date: 2026-04-xx
workflow: onboard-repo
scenario: pairslash
runtime: codex-cli
repo_snapshot_ref: <commit-or-snapshot-id>
arm_order: AB
task_statement: "Return cold to this repo and identify what matters first."
success_criteria:
  - "State the canonical entrypoint correctly"
  - "Identify the supported runtimes correctly"
  - "Recommend the right next workflow"
baseline_method: "Raw CLI repo summary prompt with manual grep follow-up"
pairslash_method: "/skills -> pairslash-onboard-repo"
ttfs_seconds: 420
task_success: true
manual_rescue_count: 0
reprompt_count_after_first_answer: 1
issue_reproduced: null
rework_units: 1
trust_boundary_result: pass
preview_fidelity_result: not_applicable
artifact_refs:
  - <baseline-transcript-path>
  - <pairslash-transcript-path>
  - <trace-export-path>
weekly_reuse_answer: likely_yes
weekly_reuse_reason: "Gets me to the right files and constraints faster than raw summary prompts."
score_summary:
  trusted_weekly_reuse_eligible: true
  ttfs_delta_vs_baseline: 0.24
  task_success_without_rescue: true
include_in_rollup: true
exclude_reason: null
negative_evidence_note: "None"
```

## Legacy entry notes

### Legacy Run ID: `20260326-codex-phase4-acceptance`

- Kept for provenance only.
- Actual scope: managed installability and doctor acceptance on Codex lane.
- Excluded because it does not benchmark repo onboarding, trust-memory flow, or
  review/fix utility against the required raw CLI baseline.

### Legacy Run ID: `20260326-copilot-phase4-acceptance`

- Kept for provenance only.
- Actual scope: managed installability and doctor acceptance on Copilot lane.
- Excluded because it does not benchmark repo onboarding, trust-memory flow, or
  review/fix utility against the required raw CLI baseline.
