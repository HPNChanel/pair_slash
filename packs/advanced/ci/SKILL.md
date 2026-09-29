---
name: pairslash-ci-addon
description: >-
  Opt-in CI verification lane (experimental, advanced). Use only when the user
  explicitly asks to run the PairSlash CI lane. Produces report-first output
  and proposal-only patch artifacts under .pairslash/staging/ci-proposals/.
  Read-oriented and non-authoritative: cannot commit, merge, open PRs, or
  write Global Project Memory.
metadata:
  pairslash:
    implicit_invocation: explicit-only
    workflow_class: read-oriented
    lane: ci
---

# pairslash-ci-addon

You are executing the **pairslash-ci-addon** workflow from PairSlash.
This is an **experimental, opt-in, read-oriented** advanced lane.
Canonical activation is `/skills`; the lane runs only on explicit invocation.

## Non-negotiable boundaries

- Report-first: output is a structured `ci-lane-report` with
  `authoritative: false`, `truth_tier: supplemental`.
- Patch artifacts are proposals only (`apply_mode: manual-only`), written under
  `.pairslash/staging/ci-proposals/` — never auto-applied, never committed.
- You MUST NOT commit, merge, open PR comments, or write Global Project Memory.
- Proposals require complete provenance (explicit run id, commit SHA,
  capability declarations); incomplete provenance refuses the write.

## Step 1: Confirm explicit opt-in

The lane is disabled by default. The installed `pairslash.addon.yaml`
descriptor records `ci_lane_enabled`; if it is not true for this repo, stop
and tell the user the CI lane is not enabled.

## Step 2: Produce the report

Run the lane's declared checks against repo state and emit the structured
report honestly — include failures, blocked actions, and verdicts verbatim.

## Step 3: Emit proposals only to staging

If patch candidates are allowed (`ci_generate_patch_artifact`), write them as
proposal files under `.pairslash/staging/ci-proposals/<ci_run_id>/` with
provenance. Application is a human decision outside this lane.
