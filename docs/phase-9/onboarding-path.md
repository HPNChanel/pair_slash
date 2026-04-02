---
title: Start Here Onboarding Path
phase: 9
status: active-draft
owner_file: docs/phase-9/onboarding-path.md
baseline_source: docs/phase-9/phase-9-baseline-reality-lock.md
---

# Start Here Onboarding Path

This page is the public first-run flow for PairSlash.
It answers three questions fast: why install, where to start, and what to do when it fails.

## Runtime scope

PairSlash supports exactly two runtimes:

- Codex CLI (`--runtime codex`, recommended target `repo`)
- GitHub Copilot CLI (`--runtime copilot`, recommended target `user`)

`/skills` is the canonical front door on both runtimes.

## First 90 seconds

Use this exact path first:

```bash
npm install
npm run pairslash -- doctor --runtime codex --target repo
npm run pairslash -- preview install pairslash-plan --runtime codex --target repo
npm run pairslash -- install pairslash-plan --runtime codex --target repo --apply --yes
```

If you are on the Copilot lane, switch runtime and target:

```bash
npm run pairslash -- doctor --runtime copilot --target user
npm run pairslash -- preview install pairslash-plan --runtime copilot --target user
npm run pairslash -- install pairslash-plan --runtime copilot --target user --apply --yes
```

## First successful workflow experience

After install:

1. Start your runtime from repo root.
2. Run `/skills`.
3. Select `pairslash-plan`.
4. Ask: `Create a repo plan from the current repo state.`

This is the current bootstrap success path.

## Public wedge after first success

Once `pairslash-plan` succeeds, use this visible adoption order:

1. `pairslash-onboard-repo`
2. `pairslash-memory-candidate` -> `pairslash-memory-write-global`
3. `pairslash-review` with explicit fix handoff

Do not describe this wedge order as benchmark-proven market validation.
Keep `pairslash-onboard-repo` and `pairslash-review` labeled as `canary` workflows in public wording.

## What `/skills` means in practice

`/skills` is the runtime-native menu where users discover and run PairSlash workflows.
Public onboarding should always route through `/skills` first, not direct prompt-mode invocation.

## What happens when it fails

Use doctor-first support and capture local evidence before filing:

```bash
npm run pairslash -- doctor --runtime codex --target repo
npm run pairslash -- debug --latest --runtime codex --bundle --format text
npm run pairslash -- trace export --session <session-id> --runtime codex --support-bundle --include-doctor --format text
```

Then file with:

- Install bug: [../../.github/ISSUE_TEMPLATE/install-bug.md](../../.github/ISSUE_TEMPLATE/install-bug.md)
- Runtime mismatch: [../../.github/ISSUE_TEMPLATE/runtime-mismatch.md](../../.github/ISSUE_TEMPLATE/runtime-mismatch.md)
- Workflow bug: [../../.github/ISSUE_TEMPLATE/workflow-bug.md](../../.github/ISSUE_TEMPLATE/workflow-bug.md)
- Memory bug: [../../.github/ISSUE_TEMPLATE/memory-bug.md](../../.github/ISSUE_TEMPLATE/memory-bug.md)
- Pack request: [../../.github/ISSUE_TEMPLATE/pack-request.yml](../../.github/ISSUE_TEMPLATE/pack-request.yml)
- Docs/problem report: [../../.github/ISSUE_TEMPLATE/docs-problem.yml](../../.github/ISSUE_TEMPLATE/docs-problem.yml)
- If you already captured local artifacts, use: [../../.github/ISSUE_TEMPLATE/pairslash-support-bundle.md](../../.github/ISSUE_TEMPLATE/pairslash-support-bundle.md)

## Current support reality for onboarding copy

Keep onboarding wording aligned to:

- [Compatibility Matrix](../compatibility/compatibility-matrix.md)
- [Scoped Release Verdict](../validation/phase-3-5/verdict.md)
- [Phase 5 Shipped Scope](../releases/phase-5-shipped-scope.md)
- [Install Guide](../workflows/install-guide.md)
- [Phase 4 Quickstart](../workflows/phase-4-quickstart.md)
- [Doctor Troubleshooting](../workflows/phase-4-doctor-troubleshooting.md)

Do not flatten lane states into generic "supported."
Respect `stable-tested`, `degraded`, `prep`, and `known-broken` exactly.

## Proof assets for onboarding claims

Use these when onboarding language needs evidence instead of narrative:

- Examples index: [../examples/README.md](../examples/README.md)
- Benchmark index: [../benchmarks/README.md](../benchmarks/README.md)
- Case-study index: [../case-studies/README.md](../case-studies/README.md)
- Onboarding before/after placeholder: [../case-studies/onboard-repo-before-after.md](../case-studies/onboard-repo-before-after.md)
- Failure-mode placeholder: [../case-studies/failure-mode-runtime-mismatch.md](../case-studies/failure-mode-runtime-mismatch.md)
