---
title: Phase 9 Public Docs Index
phase: 9
status: active-draft
owner_file: docs/phase-9/README.md
truth_source: docs/phase-12/authoritative-program-charter.md
---

# Phase 9 Public Docs Index

This directory defines the public Phase 9 narrative for PairSlash as a trust layer for terminal-native AI workflows.
Scope stays narrow: exactly two runtimes, `/skills` as canonical front door, and explicit-write-only Global Project Memory.

Official stage statement: PairSlash is currently at Phase 3.5 business
validation on top of a technically shipped Phase 4 installability substrate
with additional Phase 5/6 hardening in the repo. Source of truth:
[../phase-12/authoritative-program-charter.md](../phase-12/authoritative-program-charter.md).

These public docs are derivative surfaces.
They describe the shipped installability and trust substrate plus the current
lane-specific support boundary; they do not widen phase, validation, or runtime
claims beyond the authoritative sources below.
The PairSlash source repository is licensed under Apache-2.0, but
package-manager publication is not part of the current public surface.
Keep reuse and install wording aligned with
[Legal and Packaging Status](../releases/legal-packaging-status.md).

## Start Here

- [Onboarding Path](onboarding-path.md)
- [OSS Positioning](oss-positioning.md)

Advanced optional lanes are documented separately in
[../phase-11/README.md](../phase-11/README.md).
They are experimental and outside the default core docs, install, and wedge
workflow path.

## By Task

- Re-enter a repo: `pairslash-onboard-repo` (`canary`)
- Plan a change: `pairslash-plan`
- Write memory explicitly: `pairslash-memory-candidate` -> `pairslash-memory-write-global`
- Review work safely: `pairslash-review` (`canary`)

Task intent and wedge order source:

- [Wedge Workflows Decision](../phase-3.5/wedge-workflows-decision.md)
- [Workflow docs](../workflows/)
- [Canonical workflow packs](../../packs/core/)

## By Runtime

- [Compatibility Matrix](../compatibility/compatibility-matrix.md)
- [Runtime Verification](../compatibility/runtime-verification.md)
- [Runtime Mapping](../runtime-mapping/README.md)

Current support labels must be preserved exactly: `stable-tested`, `degraded`, `prep`, `known-broken`.

## Failure and Support

- Doctor-first troubleshooting: [Phase 4 Doctor Troubleshooting](../workflows/phase-4-doctor-troubleshooting.md)
- Support operations: [Phase 7 Support Ops](../support/phase-7-support-ops.md)
- Triage playbook: [Support Triage Playbook](../support/triage-playbook.md)
- Repro evidence matrix: [Support Repro Assets](../support/repro-assets.md)
- Issue templates: [`.github/ISSUE_TEMPLATE/`](../../.github/ISSUE_TEMPLATE/)
- Install bug template: [install-bug.md](../../.github/ISSUE_TEMPLATE/install-bug.md)
- Runtime mismatch template: [runtime-mismatch.md](../../.github/ISSUE_TEMPLATE/runtime-mismatch.md)
- Workflow bug template: [workflow-bug.md](../../.github/ISSUE_TEMPLATE/workflow-bug.md)
- Memory bug template: [memory-bug.md](../../.github/ISSUE_TEMPLATE/memory-bug.md)
- Pack request form: [pack-request.yml](../../.github/ISSUE_TEMPLATE/pack-request.yml)
- Docs problem form: [docs-problem.yml](../../.github/ISSUE_TEMPLATE/docs-problem.yml)
- Artifact-heavy support intake: [pairslash-support-bundle.md](../../.github/ISSUE_TEMPLATE/pairslash-support-bundle.md)

## Contribute and Maintain

- Contributor entrypoint: [Contributor Model](contributor-model.md)
- Contributor guide: [CONTRIBUTING.md](../../CONTRIBUTING.md)
- Issue taxonomy and support language boundaries: [Issue Taxonomy](issue-taxonomy.md)
- Maintainer and triage entrypoint: [Maintainer Playbook](maintainer-playbook.md)
- Maintainer index: [docs/maintainers/README.md](../maintainers/README.md)

## Claim Guardrails

Keep public wording aligned with:

- [Authoritative Program Charter](../phase-12/authoritative-program-charter.md)
- [Legal and Packaging Status](../releases/legal-packaging-status.md)
- [Phase 9 Baseline Reality Lock](phase-9-baseline-reality-lock.md)
- [Product-Validation Verdict](../validation/phase-3-5/verdict.md)
- [Scoped Release Verdict](../releases/scoped-release-verdict.md)
- [Public Claim Policy](../releases/public-claim-policy.md)
- [Phase 5 Shipped Scope](../releases/phase-5-shipped-scope.md)
- [Compatibility Matrix](../compatibility/compatibility-matrix.md)

Do not add public claims that imply:

- third runtime support
- hidden memory behavior
- autopilot behavior
- broad runtime parity beyond lane-level evidence
- advanced optional lanes are the default PairSlash story
- Apache-2.0 source licensing means PairSlash packages are already public or
  package-manager published
