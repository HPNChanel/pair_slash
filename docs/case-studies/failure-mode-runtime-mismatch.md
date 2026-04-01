---
title: Failure Mode Runtime Mismatch
phase: 9
asset_type: case-study
evidence_status: not-measured
workflow_name: pairslash-plan plus doctor/support path
runtime_lane_primary: github-copilot-cli prompt-mode known-broken
runtime_lane_secondary: windows prep lanes
classification: failure-case-placeholder
---

# Reality Scan

## Asset Metadata

| Field | Value |
| --- | --- |
| Workflow | `pairslash-plan` via `/skills` plus doctor/support escalation |
| Runtime lane (primary) | `github-copilot-cli` prompt-mode direct invocation (`known-broken`) |
| Runtime lane (secondary) | Windows prep lanes (`codex-cli` repo, `github-copilot-cli` user) |
| Evidence status | `not-measured` |
| Claim scope allowed now | failure-handling path intent only |

## Evidence Status

- Current status: `not-measured`
- Official run IDs linked: none
- Artifact refs linked: none
- Included in benchmark rollup: no

# Decisions

## Measured Before/After Slots

Fill when measured:

- `run_id`:
- `runtime`:
- `target`:
- `os_lane`:
- `failure_trigger`:
- `doctor_verdict`:
- `time_to_diagnosis_seconds`:
- `support_bundle_created`:
- `redaction_state`:
- `safe_to_share`:
- `issue_template_used`:
- `resolution_path`:

## Anecdotal Notes

Do not use this section as benchmark proof.

- Operator note:
- User confusion note:
- Maintainer triage note:

## Not-Yet-Validated Example Notes

- What can be shown safely before measurement:
  - doctor-first failure flow
  - support-bundle capture flow
  - lane-specific caveat wording
- What cannot be claimed:
  - mean-time-to-resolution
  - support throughput
  - cross-lane reliability

# File/Path Plan

## Required Artifact Links

- Doctor output artifact:
- Debug report artifact:
- Trace export artifact:
- Support bundle manifest:
- Privacy note:
- Issue URL or local issue draft:

## Evidence Sources To Align With

- `docs/compatibility/compatibility-matrix.md`
- `docs/workflows/phase-4-doctor-troubleshooting.md`
- `docs/support/phase-7-support-ops.md`
- `.github/ISSUE_TEMPLATE/pairslash-support-bundle.md`

# Risks / Bugs / Drift

- Risk: phrasing this failure asset as parity proof.
- Risk: omitting privacy/redaction status in failure reporting.
- Risk: using unsupported prompt-mode direct invocation as onboarding path.

# Acceptance Checklist

- Failure lane and workflow are explicit.
- Measured fields remain empty until artifacts are captured.
- Anecdotal and not-yet-validated sections are clearly separated.
- Support capture paths are linked and concrete.

# Next Handoff

- When measured, append corresponding entry to
  `docs/validation/phase-3-5/evidence-log.md` with failure-context notes.
