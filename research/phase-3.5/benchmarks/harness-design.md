# PairSlash Phase 3.5 Benchmark Harness Design

## Objective

Run comparable benchmark sessions that measure whether PairSlash improves real terminal workflows versus raw CLI usage.

Comparison arms:

- `raw_cli`: direct Codex CLI or GitHub Copilot CLI usage
- `pairslash`: same task using PairSlash workflow conventions

## Execution Protocol

### 1) Session setup

- Select participant and ICP segment.
- Assign runtime lane: `codex_cli` or `github_copilot_cli`.
- Select 3 required tasks per participant:
  - one `onboard_repo` task
  - one `review_fix_loop` task
  - one `memory_candidate_write_global` task
- Optional 4th task from supporting group when time permits.
- Prepare repo snapshot and seed state for selected task.

### 2) Run order

- Use AB/BA crossover per task:
  - half participants run `raw_cli -> pairslash`
  - half run `pairslash -> raw_cli`
- Randomize order at participant level to reduce learning bias.
- Reset repo state between arms to the same snapshot.

### 3) Run capture

- Capture start timestamp at first actionable prompt.
- Capture first-success timestamp when observer confirms minimum success condition.
- Capture end timestamp at task completion or timeout.
- Record rescues, re-prompts, and outcome tags in real time.
- Ask weekly reuse question immediately after each task:
  - "Would you use this path again next week for the same trigger? Why?"

### 4) Timeout and abort rules

- Hard timeout per task: 30 minutes.
- Abort if participant cannot progress for 7 consecutive minutes.
- Mark aborted runs as `failed` unless observer documents non-product blocker.

## Observer Instructions

Observer responsibilities:

- Enforce protocol consistency and timekeeping.
- Classify rescue events and reasons.
- Confirm first success is usable, not merely plausible.
- Capture verbatim participant reasons for reuse or rejection.

Observer must not:

- coach commands or fix strategy
- suggest prompts unless run is already tagged as rescue
- reinterpret participant intent after the fact without notes

Rescue reason tags:

- `tool_limit`
- `prompt_clarity`
- `runtime_env_issue`
- `participant_error`
- `unknown`

## Human Observation vs Machine Logging

Machine-loggable data:

- runtime, model, prompt variant
- timestamps and elapsed durations
- prompt count and re-prompt count
- outcome tag
- install/doctor and issue reproducibility success flags

Human-observed data:

- first-success usability check
- rescue reason classification
- trust-boundary violation interpretation
- novelty-vs-reuse interpretation from participant rationale

Mixed (both required):

- rework minutes and rework event attribution
- weekly reuse confidence
- practical workflow reusability judgment

## Before/After Comparison Method

Pairing rule:

- Compare runs only when they share:
  - same participant
  - same task ID
  - same runtime lane
  - same repo snapshot seed

Primary deltas:

- `ttfs_delta_vs_raw`
- `rescue_delta_vs_raw`
- `reprompt_delta_vs_raw`
- `rework_minutes_delta_vs_raw`
- `weekly_reuse_delta_vs_raw`

Aggregate views:

- by task
- by wedge
- by ICP segment
- by runtime lane

## PairSlash vs Raw CLI Comparison Rules

Raw CLI arm:

- no PairSlash slash workflows or templates
- user may use normal CLI prompts and tools

PairSlash arm:

- use slash-first entrypoint and PairSlash workflow semantics
- enforce explicit-write-only behavior in memory tasks
- enforce runtime scope to Codex CLI and GitHub Copilot CLI only

Invalid comparison conditions:

- different repo snapshots between arms
- hidden setup help given in one arm only
- uncontrolled runtime/toolchain changes between arms

## Pilot Cohort Design

Target cohort size:

- 12 to 20 participants

Recommended distribution:

- 5 to 7 `p1_power_user_terminal`
- 3 to 5 `p1_tech_lead_maintainer_staff`
- 2 to 4 `p2_platform_devex_internal_tooling`
- 1 to 3 `p3_oss_maintainer_consultant`

Minimum runs:

- 36 paired runs (12 participants x 3 required tasks)
- ideal 48 to 64 paired runs

## Bias Controls

Order bias control:

- AB/BA crossover randomization

Novelty bias control:

- ask weekly reuse question after each task
- classify novelty-only answers as score `1` or lower

Selection bias control:

- enforce screener criteria with recent incident requirement

Observer bias control:

- use fixed rescue and first-success definitions
- require verbatim evidence for contested judgments

Setup friction distortion control:

- record setup pain separately from core workflow outcomes

## Artifact Capture Rules

Required artifacts per run:

- transcript file path
- benchmark log entry conforming to `log-schema.yaml`
- observer notes
- prompt variant ID
- runtime and model metadata
- outcome evidence (pass/fail details)

Recommended artifacts:

- terminal recording
- repo state hash or commit reference
- diff or patch references when task mutates code

Retention rule:

- keep raw run artifacts immutable
- write synthesis outputs to separate files
- never overwrite run logs after scoring without append-only correction notes
