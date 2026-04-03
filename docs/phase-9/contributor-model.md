---
title: Contributor Model
phase: 9
status: active-draft
owner_file: docs/phase-9/contributor-model.md
truth_source: docs/phase-12/authoritative-program-charter.md
---

# Contributor Model

PairSlash contribution in Phase 9 stays narrow and evidence-aware:

- Exactly two runtimes: Codex CLI and GitHub Copilot CLI
- `/skills` is the canonical front door
- Global Project Memory is explicit-write-only and reviewable
- Support claims follow compatibility evidence, not aspiration
- Repository source is licensed under Apache-2.0, while package publication
  remains bounded by private manifests and repo-local install guidance

## Contributor Entry Points

- Primary contributor guide: `CONTRIBUTING.md`
- Support taxonomy: `docs/phase-9/issue-taxonomy.md`
- Maintainer routing model: `docs/phase-9/maintainer-playbook.md`
- Operational triage guide: `docs/support/triage-playbook.md`

## Lane Guide

- Pack authors: `packs/core/*`, workflow docs, pack manifests
- Runtime adapter contributors: `packages/runtimes/*`, installer/doctor/trace integration
- Docs contributors: onboarding, compatibility wording, support navigation
- Release and triage contributors: issue routing, reproduction quality, docs/support claim alignment

## Alignment Sources

Keep contributions aligned with:

- `docs/compatibility/compatibility-matrix.md`
- `docs/compatibility/runtime-verification.md`
- `docs/releases/public-claim-policy.md`
- `docs/releases/legal-packaging-status.md`
- `docs/releases/scoped-release-verdict.md`
- `docs/validation/phase-3-5/verdict.md`
- `docs/releases/phase-5-shipped-scope.md`
- `docs/workflows/`
- `packs/core/`
- `packages/tools/cli/`
- `packages/tools/installer/`
- `packages/tools/doctor/`
- `packages/tools/lint-bridge/`
- `packages/core/memory-engine/`
- `packages/tools/trace/`
