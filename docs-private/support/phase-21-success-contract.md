# Phase 21 Success Contract

This contract governs internal Phase 21 exit only.
It does not widen public support claims, compatibility truth, release truth,
or product-validation truth.
Companion truth roots remain:

- `docs/phase-12/authoritative-program-charter.md`
- `docs/releases/public-claim-policy.md`
- `docs/releases/scoped-release-verdict.md`
- `docs/compatibility/runtime-verification.md`

If any KPI, artifact, or counted case is `unknown / needs verification`, the
default verdict is `NO-SHIP`.

## Required Outputs

Phase 21 is not complete unless all required outputs exist as repo-local
artifacts, not just planning notes or narrative docs.

1. End-to-end support playbook covering intake, triage, repro, patch decision,
   and reporter communication.
2. Unified failure taxonomy that supports routing and issue-state tracking.
3. Bundle intake policy with explicit redaction, share-safety, and public-share
   boundary rules.
4. Workflow issue flow that requires, for every counted issue:
   - `owner`
   - `severity`
   - `failure_domain`
   - `repro_status`
   - `patch_decision_status`
   - `communication_status`
5. Phase 21 issue ledger / scorecard for a rolling 30-day evidence window.
6. Truth-conflict audit note showing support docs do not conflict with release
   truth, compatibility truth, or public-claim truth.

Required issue-state enums:

- `repro_status`: `needs-info`, `in-progress`, `reproduced`,
  `deterministically-guarded`, `not-reproducible`
- `patch_decision_status`: `open`, `fix`, `docs-downgrade`, `known-issue`,
  `evidence-gap`, `not-a-code-change`
- `communication_status`: `pending`, `waiting-reporter`,
  `reporter-informed`, `closed`

## Optional But Recommended Outputs

These improve Phase 21, but they do not count as completion on their own:

- label/bootstrap automation for `surface:*`, `type:*`, `severity:*`,
  `status:*`, and lane labels
- saved maintainer triage views or dashboards
- sanitized sample support bundle
- reason-code or Ship Gate mapping note
- release-readiness cross-check hook for supportability drift

## Exit Gate

Phase 21 is `SHIP` only when all of the following are true:

1. All required outputs exist and are current.
2. The rolling 30-day evidence window contains at least 4 counted end-to-end
   cases.
3. The evidence window contains at least 1 Codex lane case and at least
   1 Copilot lane case.
4. Every counted case has complete issue-state fields:
   `owner`, `severity`, `failure_domain`, `repro_status`,
   `patch_decision_status`, `communication_status`.
5. All internal supportability KPIs meet threshold.
6. `truth_conflict_count = 0`.
7. `unsafe_share_incidents = 0`.
8. All must-fix blockers are closed.

A counted Phase 21 case is an install, runtime-mismatch, workflow, or memory
issue in the current 30-day window with:

- intake timestamp
- runtime, target, and lane facts
- exact command or claim path
- `doctor` output and/or safe support-bundle metadata
- first-classification timestamp
- repro outcome
- patch decision or final non-code disposition
- reporter communication outcome
- artifact refs

If a case is missing any required field, it does not count toward ship.

## Evidence Required

The exit decision requires repo-local evidence, not verbal assurance:

1. A Phase 21 issue ledger / scorecard covering the current 30-day window.
2. Artifact refs for every counted case:
   - `doctor` output and/or safe support bundle
   - session id or bundle id when available
   - repro summary
   - final disposition
3. A truth-conflict audit note that checks support docs against:
   - release truth
   - compatibility truth
   - public-claim truth
4. A share-safety note confirming zero public-share incidents from unsafe
   bundles.
5. Runtime-coverage proof that the evidence window includes both core runtimes
   without claiming broad runtime parity.

## Supportability KPIs

KPI denominators use counted Phase 21 cases only.
Pack requests and pure docs-navigation issues are not part of the phase KPI
rollup.

| KPI | Definition | Threshold | Measurement source |
| --- | --- | --- | --- |
| `bundle_assisted_fast_classification_rate` | Share of safe bundle-backed reports that receive valid first-pass classification without asking for a second artifact | `>= 80%` | issue ledger + artifact refs |
| `issue_record_completeness_rate` | Share of counted cases with complete required issue-state fields | `100%` | issue ledger |
| `new_maintainer_low_guess_repro_rate` | Share of counted bug issues that a maintainer who did not open the issue can reproduce or deterministically classify with `<= 1` clarification round | `>= 75%` | repro summaries + issue ledger |
| `issue_reproducibility_rate` | Share of counted bug issues with `repro_status = reproduced` or `deterministically-guarded` | `>= 70%` | repro summaries + issue ledger |
| `median_time_to_first_classification` | Median time from issue creation to valid first-pass classification | `<= 1 business day` | timestamped issue ledger |
| `median_rescue_burden` | Median number of maintainer clarification rounds needed before repro path or final non-bug disposition is clear | `<= 1` | issue ledger comment/state log |
| `truth_conflict_count` | Open conflicts between support truth and release/compatibility/public-claim truth | `0` | truth audit note |
| `unsafe_share_incidents` | Public-share incidents where `safe_to_share != true` or `redaction_state != shareable` | `0` | bundle review log + issue ledger |

Fast classification is valid only when the issue has exactly one assigned:

- `surface`
- `type`
- `severity`
- `status`
- `failure_domain`

## Must-Fix Blockers

Phase 21 cannot be called done while any of these remain open:

1. Share-safety is not fail-closed at schema, validation, or release-gate
   level.
2. Workflow and memory intake still miss repro-critical fields such as
   `OS/shell`, exact command, session id, canonical `/skills` yes/no, or
   artifact refs.
3. The issue ledger / scorecard does not exist or cannot support KPI
   measurement.
4. Support bundle lineage is still too weak to carry failure-domain and
   reason-code evidence toward future Ship Gate supportability checks.
5. Support truth roots still drift against release truth or compatibility
   truth.

## Non-Goals

Phase 21 does not do any of the following:

- claim broad runtime parity
- claim product validation or market validation
- widen PairSlash into a generic agent-platform support story
- make support artifacts authoritative memory
- imply hidden writes, auto-triage, auto-fix, or background learning
- force support bundles as the default intake for every issue
- use one successful issue to widen release truth or compatibility truth
- call docs/checklists alone "operational supportability"

## What Counts As Done That vs Chi Co Narrative

`Done that` means:

- required outputs exist as repo-local artifacts
- counted end-to-end cases exist in the current evidence window
- maintainers can classify and reproduce issues with low guesswork
- issue-state completeness is enforced
- share safety stays fail-closed in practice
- truth-conflict audit is clean
- all KPIs pass with artifact-backed measurement

`Chi co narrative` means one or more of these are true:

- docs or checklists exist, but no issue ledger or scorecard exists
- KPIs are declared but unmeasured
- counted cases are missing required fields
- support bundle exists, but real issues still need heavy guessing
- truth conflicts remain open
- support evidence is used to imply parity, validation, or broader support than
  the truth roots allow

## Phase 21 Ship/No-Ship Checklist

- [ ] All required outputs exist.
- [ ] The current evidence window contains at least 4 counted end-to-end cases.
- [ ] The current evidence window contains at least 1 Codex case.
- [ ] The current evidence window contains at least 1 Copilot case.
- [ ] Every counted case has `owner`.
- [ ] Every counted case has `severity`.
- [ ] Every counted case has `failure_domain`.
- [ ] Every counted case has `repro_status`.
- [ ] Every counted case has `patch_decision_status`.
- [ ] Every counted case has `communication_status`.
- [ ] `bundle_assisted_fast_classification_rate` passes.
- [ ] `issue_record_completeness_rate` passes.
- [ ] `new_maintainer_low_guess_repro_rate` passes.
- [ ] `issue_reproducibility_rate` passes.
- [ ] `median_time_to_first_classification` passes.
- [ ] `median_rescue_burden` passes.
- [ ] `truth_conflict_count = 0`.
- [ ] `unsafe_share_incidents = 0`.
- [ ] All must-fix blockers are closed.

If any box is unchecked, or any box is still `unknown / needs verification`,
the verdict is `NO-SHIP`.
