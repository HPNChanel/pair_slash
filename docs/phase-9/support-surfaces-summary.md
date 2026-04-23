---
title: Phase 9 Support Surfaces Summary
phase: 9
status: active-draft
owner_file: docs/phase-9/support-surfaces-summary.md
baseline_source: docs/phase-9/issue-taxonomy.md
---

# Reality Scan

Phase 9 support and maintainer-scaling implementation now has concrete intake and handoff surfaces in-repo:

- Multiple issue templates exist under `.github/ISSUE_TEMPLATE/`.
- Contributor guidance exists at `CONTRIBUTING.md`.
- Maintainer operations now have explicit docs under `docs/support/` and `docs/maintainers/`.

# Decisions

## Templates Created

- `.github/ISSUE_TEMPLATE/install-bug.md`
- `.github/ISSUE_TEMPLATE/runtime-mismatch.md`
- `.github/ISSUE_TEMPLATE/workflow-bug.md`
- `.github/ISSUE_TEMPLATE/memory-bug.md`
- `.github/ISSUE_TEMPLATE/pack-request.yml`
- `.github/ISSUE_TEMPLATE/docs-problem.yml`
- `.github/ISSUE_TEMPLATE/config.yml`

Existing template retained and aligned:

- `.github/ISSUE_TEMPLATE/pairslash-support-bundle.md`

## Labels And Taxonomy Expected

Expected taxonomy from `docs/phase-9/issue-taxonomy.md`:

- `surface:*`: `install-lifecycle`, `runtime-mismatch`, `workflow`, `memory`, `pack-discovery`, `docs-nav-wording`
- `type:*`: `support`, `bug`, `docs-drift`, `pack-request`, `evidence-gap`
- `lane:*`: runtime/target lane label per issue
- `severity:*`: `s0`, `s1`, `s2`, `s3`
- `status:*`: `needs-info`, `triage`, `repro`, `waiting-docs`, `waiting-code`, `closed`

Templates currently seed lightweight defaults and rely on maintainer first-pass labeling.

## Contributor Entry Points

- `CONTRIBUTING.md`
- `docs/phase-9/contributor-model.md`
- `.github/ISSUE_TEMPLATE/`

## Maintainer Entry Points

- `docs/support/triage-playbook.md`
- `docs/support/repro-assets.md`
- `docs/maintainers/README.md`
- `docs/phase-9/maintainer-playbook.md`
- `docs/phase-9/issue-taxonomy.md`

# File/Path Plan

Created:

- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/ISSUE_TEMPLATE/install-bug.md`
- `.github/ISSUE_TEMPLATE/runtime-mismatch.md`
- `.github/ISSUE_TEMPLATE/workflow-bug.md`
- `.github/ISSUE_TEMPLATE/memory-bug.md`
- `.github/ISSUE_TEMPLATE/pack-request.yml`
- `.github/ISSUE_TEMPLATE/docs-problem.yml`
- `CONTRIBUTING.md`
- `docs/support/triage-playbook.md`
- `docs/support/repro-assets.md`
- `docs/maintainers/README.md`
- `docs/phase-9/support-surfaces-summary.md`

Patched:

- `.github/ISSUE_TEMPLATE/pairslash-support-bundle.md`
- `docs/phase-9/contributor-model.md`
- `docs/phase-9/README.md`
- `docs/phase-9/issue-taxonomy.md`
- `docs/phase-9/maintainer-playbook.md`
- `README.md`

# Risks / Bugs / Drift

- Label automation is not yet implemented; maintainers must apply taxonomy labels manually.
- Issue forms do not auto-route assignees yet.
- CI drift validation now exists through `scripts/verify-supportability-surfaces.mjs`, but label family expansion still requires keeping template expectations updated.
- Existing `docs/support/phase-7-support-ops.md` and `docs/support/triage-playbook.md` can drift if updates skip the supportability verification gate.

# Acceptance Checklist

- Mandatory issue templates are present for install, runtime mismatch, workflow, memory, pack request, and docs reports.
- Contributor lane guidance includes pack authors, runtime adapter contributors, docs contributors, and release/triage contributors.
- Maintainer surfaces include triage flow, release hygiene/regression notes, and evidence-alignment rules.
- Support evidence requests are scoped by issue type and do not require impossible artifacts from casual users.
- Docs make it explicit when a report is docs/support-claim mismatch vs code bug.

# Next Handoff

- Add GitHub label bootstrap automation for the `surface:*`, `type:*`, `lane:*`, `severity:*`, and `status:*` families.
- Expand `scripts/verify-supportability-surfaces.mjs` when new issue templates or taxonomy labels are introduced.
- Add maintainer saved queries and triage dashboards keyed to `status:*` and `severity:*`.
- Add periodic docs-claim audit to keep README/onboarding/support wording aligned with compatibility and runtime-verification evidence.
