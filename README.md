# PairSlash

Terminal AI is fast until you need to re-enter a repo and trust what gets written.
That is where most workflows break.

PairSlash is the OSS trust layer for terminal-native AI workflows.
It supports exactly two runtimes: Codex CLI and GitHub Copilot CLI.
`/skills` is the canonical front door on both supported runtimes.

## Why install this

- Re-enter repos with explicit, repeatable workflows instead of chat debris.
- Keep project memory durable but explicit-write-only.
- Keep mutation paths preview-first and reviewable before apply.

## Start here

Use one of these two runtime lanes:

| Runtime | Target | Notes |
| --- | --- | --- |
| Codex CLI | `repo` | Strongest lane is macOS `stable-tested`; see support reality below. |
| GitHub Copilot CLI | `user` | Current strongest public lane is Linux `degraded`; see support reality below. |

Install and run your first workflow with the repo-local CLI entrypoint:

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

Then in your runtime session:

1. Run `/skills`.
2. Select `pairslash-plan`.
3. Ask: `Create a repo plan from the current repo state.`

After first success, run `/skills` again and use `pairslash-onboard-repo` (currently `canary`) as the repo re-entry wedge workflow.

## What happens when it fails

Use a local-first path before filing issues:

```bash
npm run pairslash -- doctor --runtime codex --target repo
npm run pairslash -- debug --latest --runtime codex --bundle --format text
npm run pairslash -- trace export --session <session-id> --runtime codex --support-bundle --include-doctor --format text
```

Then file with the matching issue template:

- Install bug: [.github/ISSUE_TEMPLATE/install-bug.md](.github/ISSUE_TEMPLATE/install-bug.md)
- Runtime mismatch: [.github/ISSUE_TEMPLATE/runtime-mismatch.md](.github/ISSUE_TEMPLATE/runtime-mismatch.md)
- Workflow bug: [.github/ISSUE_TEMPLATE/workflow-bug.md](.github/ISSUE_TEMPLATE/workflow-bug.md)
- Memory bug: [.github/ISSUE_TEMPLATE/memory-bug.md](.github/ISSUE_TEMPLATE/memory-bug.md)
- Pack request: [.github/ISSUE_TEMPLATE/pack-request.yml](.github/ISSUE_TEMPLATE/pack-request.yml)
- Docs/problem report: [.github/ISSUE_TEMPLATE/docs-problem.yml](.github/ISSUE_TEMPLATE/docs-problem.yml)
- Use support-bundle intake if you already captured artifacts: [.github/ISSUE_TEMPLATE/pairslash-support-bundle.md](.github/ISSUE_TEMPLATE/pairslash-support-bundle.md)
- Troubleshooting guide: [docs/workflows/phase-4-doctor-troubleshooting.md](docs/workflows/phase-4-doctor-troubleshooting.md)
- Support operations notes: [docs/support/phase-7-support-ops.md](docs/support/phase-7-support-ops.md)
- Support triage playbook: [docs/support/triage-playbook.md](docs/support/triage-playbook.md)
- Support repro assets: [docs/support/repro-assets.md](docs/support/repro-assets.md)

## What PairSlash is / What it is not

| PairSlash is | PairSlash is not |
| --- | --- |
| A trust layer for terminal-native AI workflows | A generic agent framework |
| Exactly two-runtime scope: Codex CLI and GitHub Copilot CLI | A third-runtime abstraction layer |
| Slash-first with `/skills` as canonical entrypoint | Prompt-mode parity across all runtime surfaces |
| Explicit-write-only Global Project Memory discipline | Hidden background memory writes |
| Preview-first workflow for mutation and install lifecycle | Autopilot coding that applies changes without explicit intent |

## Current support reality

Status labels are strict: `stable-tested`, `degraded`, `prep`, `known-broken`.
Source of truth: [docs/compatibility/compatibility-matrix.md](docs/compatibility/compatibility-matrix.md).

| Runtime | Target | OS lane | Support level |
| --- | --- | --- | --- |
| Codex CLI | `repo` | macOS | `stable-tested` |
| GitHub Copilot CLI | `user` | Linux | `degraded` |
| Codex CLI | `repo` | Windows | `prep` |
| GitHub Copilot CLI | `user` | Windows | `prep` |

Current caveats:

- Copilot direct invocation with `-p` / `--prompt` is `known-broken`; use `/skills`.
- Windows lanes are still `prep` and require live install evidence before stronger claims.
- Codex read-only complex PowerShell flows remain degraded; prefer simple single-statement PowerShell commands.

## Task-first workflow map

| User task | Workflow |
| --- | --- |
| Re-enter a repo quickly | `pairslash-onboard-repo` |
| Plan an implementation safely | `pairslash-plan` |
| Propose and commit durable memory explicitly | `pairslash-memory-candidate` -> `pairslash-memory-write-global` |
| Review changes before fix handoff | `pairslash-review` |

Canonical workflow source: [packs/core/](packs/core/).

## Start here docs and entry points

- Start path: [docs/phase-9/onboarding-path.md](docs/phase-9/onboarding-path.md)
- Phase 9 docs index: [docs/phase-9/README.md](docs/phase-9/README.md)
- Phase 9 proof plan: [docs/phase-9/examples-and-benchmarks.md](docs/phase-9/examples-and-benchmarks.md)
- Phase 9 examples index: [docs/examples/README.md](docs/examples/README.md)
- Benchmark asset index: [docs/benchmarks/README.md](docs/benchmarks/README.md)
- Case-study index: [docs/case-studies/README.md](docs/case-studies/README.md)
- Compatibility and runtime checks: [docs/compatibility/runtime-verification.md](docs/compatibility/runtime-verification.md)
- Contributor entrypoint: [docs/phase-9/contributor-model.md](docs/phase-9/contributor-model.md)
- Contributor guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Maintainer and triage entrypoint: [docs/phase-9/maintainer-playbook.md](docs/phase-9/maintainer-playbook.md)
- Maintainer index: [docs/maintainers/README.md](docs/maintainers/README.md)
- Issue template chooser: [.github/ISSUE_TEMPLATE/](.github/ISSUE_TEMPLATE/)

Advanced optional lanes are documented separately in
[docs/phase-11/README.md](docs/phase-11/README.md).
They are experimental, opt-in, and outside the default core install and
onboarding path.

## Local repo commands

```bash
npm run lint
npm run test
npm run test:acceptance
npm run test:release
```
