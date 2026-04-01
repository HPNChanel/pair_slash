---
title: README Diff Summary
phase: 9
status: active-draft
owner_file: docs/phase-9/readme-diff-summary.md
source_files:
  - README.md
  - docs/phase-9/README.md
  - docs/phase-9/onboarding-path.md
---

# Reality Scan

## Old narrative problems fixed

- Opening was strong but still mixed trust-layer positioning with architecture-heavy detail too early.
- Start path existed as quickstart, but did not clearly answer all three first-user questions in one linear flow.
- Failure path and issue intake existed but were not framed as the core newcomer support route.
- Public wedge ordering and bootstrap-first workflow were not clearly separated for first-time readers.

# Decisions

## Sections added

In `README.md`:

- `Why install this`
- `Start here`
- `What happens when it fails`
- `What PairSlash is / What it is not`
- `Current support reality`
- `Task-first workflow map`
- `Start here docs and entry points`

In `docs/phase-9/README.md`:

- Real Phase 9 docs index with `Start Here`, `By Task`, `By Runtime`, `Failure and Support`, `Contribute and Maintain`, and claim guardrails.

In `docs/phase-9/onboarding-path.md`:

- Concrete first 90 seconds path
- First successful workflow path
- Public wedge sequencing after first success
- Doctor-first failure escalation and issue-template routing

## Support wording guardrails applied

- Preserved exact support semantics from compatibility docs: `stable-tested`, `degraded`, `prep`, `known-broken`.
- Kept runtime scope explicit and fixed at exactly two runtimes.
- Kept `/skills` as canonical front door; did not promote direct prompt-mode invocation.
- Kept memory claims explicit-write-only, previewable, auditable, and reviewable.
- Kept support escalation local-first: `doctor` -> bundle capture -> support issue template.

# File/Path Plan

- Patched: `README.md`
- Patched: `docs/phase-9/README.md`
- Patched: `docs/phase-9/onboarding-path.md`

No active docs-site landing/index file (`docs/index.md`, `docs/site/*`, or site config) was found to patch in this pass.

# Risks / Bugs / Drift

## Unresolved wording blocked by evidence gaps

- No new claim was added for Windows live install parity; lanes remain `prep`.
- No new claim was added for Copilot prompt-mode direct invocation; remains `known-broken`.
- No benchmark-backed business validation claims were added because official evidence remains limited.
- No claim was added that all workflows are equally mature or equally verified across lanes.

# Acceptance Checklist

- README now answers product pain, first command path, runtime scope, and bug-report path.
- Start path uses concrete commands and `/skills`.
- Support claims stay lane-specific and evidence-bound.
- Contributor and maintainer entry points are linked without overclaiming maturity.

# Next Handoff

- Use `docs/phase-9/oss-positioning.md` as narrative source while filling:
  - `docs/phase-9/issue-taxonomy.md`
  - `docs/phase-9/contributor-model.md`
  - `docs/phase-9/maintainer-playbook.md`
