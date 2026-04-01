# PairSlash

<div align="center">
  <img src="docs/assets/readme-trust-flow.svg" alt="PairSlash trust flow from /skills to preview, approval, and audited outputs" width="980" />
  <p><strong>The trust layer for terminal-native AI workflows.</strong></p>
  <p>
    PairSlash helps solo builders keep project context durable, explicit, previewable, and auditable across
    <strong>Codex CLI</strong> and <strong>GitHub Copilot CLI</strong>.
  </p>
  <p><code>/skills</code> is the canonical entrypoint on both supported runtimes.</p>
  <p>
    <a href="#quickstart"><img src="https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white" alt="Node >=24" /></a>
    <a href="#quickstart"><img src="https://img.shields.io/badge/npm-11.7.0-CB3837?logo=npm&logoColor=white" alt="npm 11.7.0" /></a>
    <a href="https://github.com/HPNChanel/pair_slash/actions/workflows/repo-checks.yml"><img src="https://github.com/HPNChanel/pair_slash/actions/workflows/repo-checks.yml/badge.svg?branch=main" alt="repo-checks" /></a>
    <a href="https://github.com/HPNChanel/pair_slash/actions/workflows/phase4-acceptance.yml"><img src="https://github.com/HPNChanel/pair_slash/actions/workflows/phase4-acceptance.yml/badge.svg?branch=main" alt="compat-lab-acceptance" /></a>
    <a href="docs/compatibility/compatibility-matrix.md"><img src="https://img.shields.io/badge/runtimes-Codex%20CLI%20%2B%20Copilot%20CLI-111827" alt="Supported runtimes: Codex CLI and GitHub Copilot CLI" /></a>
  </p>
</div>

## Why PairSlash

Terminal AI workflows break down at the point where context needs to survive the session.
Users lose project truth in chat debris, stop trusting durable AI writes, and get wary of automation that hides side effects.

PairSlash narrows the problem instead of widening the claim:

- It supports exactly two runtimes: Codex CLI and GitHub Copilot CLI.
- It keeps Global Project Memory file-based, reviewable, and explicit.
- It treats preview, approval, ownership, and audit trails as product features, not afterthoughts.

## How It Works

PairSlash keeps one canonical workflow source in [`packs/core/`](packs/core/) and lowers it into runtime-native install surfaces for Codex CLI and GitHub Copilot CLI.

1. You start from `/skills`.
2. PairSlash selects a workflow pack that is grounded in repo state and project memory.
3. Read-oriented workflows stop at analysis, plans, review findings, or candidate extraction.
4. Mutation surfaces stay preview-first.
5. Authoritative memory writes require explicit acceptance and leave an audit trail.

That model applies across the repo:

- Canonical source: [`packs/core/`](packs/core/)
- Runtime-native outputs: [`docs/runtime-mapping/README.md`](docs/runtime-mapping/README.md)
- Managed lifecycle: [`install` / `update` / `uninstall` / `doctor`](docs/workflows/phase-4-install-commands.md)
- Authoritative memory path: [`pairslash-memory-write-global`](packs/core/pairslash-memory-write-global/SKILL.md)

## Quickstart

Requirements:

- Node `>=24.0.0`
- `npm@11.7.0`

Fast path for a repo-scoped Codex install:

```bash
npm install
npm run pairslash -- doctor --runtime codex --target repo
npm run pairslash -- preview install pairslash-plan --runtime codex --target repo
npm run pairslash -- install pairslash-plan --runtime codex --target repo --apply --yes
```

Then:

1. Launch your runtime from the repo root.
2. Run `/skills`.
3. Select `pairslash-plan`.
4. Ask: `Create a repo plan from the current repo state.`

For GitHub Copilot CLI user scope, swap `--runtime codex --target repo` for `--runtime copilot --target user`.
If you want the fuller lifecycle surface, go straight to the [Install Guide](docs/workflows/install-guide.md) and the [Phase 4 install commands](docs/workflows/phase-4-install-commands.md).

## Workflow Catalog

PairSlash currently ships 11 active workflow packs under [`packs/core/`](packs/core/).

### Orientation and review

| Workflow | Job | Class | Channel | Risk |
| --- | --- | --- | --- | --- |
| `pairslash-plan` | Create a structured execution plan before code changes. | read-oriented | preview | low |
| `pairslash-onboard-repo` | Build a deterministic repository onboarding report with an immediate risk map. | read-oriented | canary | low |
| `pairslash-review` | Review diffs or working trees against PairSlash constraints with deterministic findings. | read-oriented | canary | medium |

### Memory and command safety

| Workflow | Job | Class | Channel | Risk |
| --- | --- | --- | --- | --- |
| `pairslash-memory-candidate` | Extract durable fact candidates without writing authoritative memory. | read-oriented | canary | medium |
| `pairslash-memory-write-global` | Write authoritative Global Project Memory with preview and explicit approval. | write-authority | preview | critical |
| `pairslash-memory-audit` | Audit Global Project Memory for drift, duplicates, and orphan references. | read-oriented | stable | medium |
| `pairslash-command-suggest` | Suggest safe canonical commands from project constraints and command memory. | read-oriented | canary | medium |

### Execution packs

| Workflow | Job | Class | Channel | Risk |
| --- | --- | --- | --- | --- |
| `pairslash-backend` | Plan and implement bounded backend engineering tasks. | dual-mode | stable | high |
| `pairslash-frontend` | Plan and implement bounded frontend changes with product-state discipline. | dual-mode | stable | high |
| `pairslash-devops` | Plan and implement the smallest reversible CI or infrastructure diff. | dual-mode | stable | high |
| `pairslash-release` | Plan and prepare release changes while preserving compatibility truth. | dual-mode | stable | high |

<details>
<summary><strong>See the product surface behind those workflows</strong></summary>

Beyond the packs themselves, the CLI already exposes:

- `preview install|update|uninstall|memory-write-global`
- `install`, `update`, `uninstall`, `doctor`, `lint`
- `explain-context`, `explain-policy`
- `debug`, `trace export`, `telemetry summary`

See [`packages/tools/cli/src/bin/pairslash.js`](packages/tools/cli/src/bin/pairslash.js) for the current command surface.
</details>

## Safety Guarantees

PairSlash is opinionated about trust boundaries:

- `pairslash-memory-write-global` is the only authoritative write path into `.pairslash/project-memory/`.
- `install`, `update`, `uninstall`, and memory writes preview by default.
- Mutation requires `--apply`; authoritative memory writes also require explicit approval.
- Uninstall removes only PairSlash-managed footprint and preserves unmanaged or locally edited files.
- Read-oriented workflows do not mutate Global Project Memory.
- Support bundles, trace exports, and telemetry summaries are local-first and explicit.
- PairSlash does not add hidden learning, remote telemetry by default, or background daemons.

The underlying artifacts are visible on disk:

- Authoritative memory: [`.pairslash/project-memory/`](.pairslash/project-memory/)
- Audit history: [`.pairslash/audit-log/`](.pairslash/audit-log/)
- Install ownership and state: repo-local `pairslash.install.json` receipts plus `.pairslash/install-state/` during managed lifecycle
- Canonical workflow source: [`packs/core/`](packs/core/)

## Support Snapshot

Support claims stay scoped to the lanes with recorded evidence.

| Lane | Status | Notes |
| --- | --- | --- |
| Codex CLI, repo target, macOS | `stable-tested` | Matching live evidence and deterministic gates. |
| GitHub Copilot CLI, user target, Linux | `degraded` | Deterministic gates are green, but support caveats still apply. |
| Codex CLI, repo target, Windows | `prep` | Preview, doctor, and path checks only; not a live install claim yet. |
| GitHub Copilot CLI, user target, Windows | `prep` | Preview, doctor, and path checks only; not a live install claim yet. |

Current public caveats:

- `/skills` is the canonical path; Copilot prompt-mode direct invocation remains a known broken surface.
- Windows still requires real live install evidence before support claims can move beyond `prep`.
- Complex multi-statement PowerShell patterns remain a degraded surface in Codex read-only contexts.

Read the exact claims in the [Compatibility Matrix](docs/compatibility/compatibility-matrix.md) and use the [Runtime Verification guide](docs/compatibility/runtime-verification.md) before broadening support statements.

## Repo Architecture

PairSlash is a Node workspace monorepo with one logical product surface and a layered implementation:

| Area | Responsibility |
| --- | --- |
| [`packages/core/*`](packages/core/) | Contracts, schemas, policy, memory, and shared domain logic |
| [`packages/runtimes/codex/*`](packages/runtimes/codex/) | Codex-specific compiler and adapter surfaces |
| [`packages/runtimes/copilot/*`](packages/runtimes/copilot/) | Copilot-specific compiler and adapter surfaces |
| [`packages/tools/*`](packages/tools/) | CLI, installer, doctor, lint bridge, trace, and compat-lab |
| [`packs/core/*`](packs/core/) | Canonical slash-first workflow source packs |

The architectural rule is simple: one source spec, two runtime-native outputs, and no third runtime.

## Develop Locally

Core repo commands:

```bash
npm run lint
npm run test
npm run test:acceptance
npm run test:release
```

Useful local CLI entrypoints:

```bash
npm run pairslash -- --help
npm run pairslash -- doctor --runtime auto --target repo
npm run pairslash -- lint
```

For repo boundaries and migration notes, read [Repo Structure](docs/architecture/repo-structure.md).

## Docs Map

<details>
<summary><strong>Open the docs index</strong></summary>

### Install and operations

- [Install Guide](docs/workflows/install-guide.md)
- [Phase 4 Install Commands](docs/workflows/phase-4-install-commands.md)
- [Phase 4 Quickstart](docs/workflows/phase-4-quickstart.md)
- [Doctor Troubleshooting](docs/workflows/phase-4-doctor-troubleshooting.md)

### Compatibility and support

- [Compatibility Matrix](docs/compatibility/compatibility-matrix.md)
- [Runtime Verification](docs/compatibility/runtime-verification.md)
- [Runtime Mapping](docs/runtime-mapping/README.md)
- [Phase 7 Support Ops](docs/support/phase-7-support-ops.md)

### Product validation and release truth

- [Product-Validation Gate](docs/validation/phase-3-5/README.md)
- [Problem Statement](docs/validation/phase-3-5/problem-statement.md)
- [Benchmark Tasks](docs/validation/phase-3-5/benchmark-tasks.md)
- [Evidence Log](docs/validation/phase-3-5/evidence-log.md)
- [Scoped Release Verdict](docs/validation/phase-3-5/verdict.md)
- [Release Checklist 0.4.0](docs/releases/release-checklist-0.4.0.md)

### Architecture

- [Repo Structure](docs/architecture/repo-structure.md)
- [Phase 4 Runtime-Native Distribution](docs/architecture/phase-4-runtime-native-distribution.md)
- [Runtime Mapping Rules](docs/runtime-mapping/README.md)

</details>

## What PairSlash Is Not

PairSlash is deliberately narrow.

- It is not a general agent framework.
- It is not a hidden memory system that writes behind your back.
- It is not a multi-runtime abstraction for every AI product.
- It is not claiming runtime parity beyond the lanes recorded in the compatibility docs.

## Current Status

PairSlash is at version `0.4.0`.

- Scoped release/installability verdict: `GO` as of **March 26, 2026**.
- Product-validation scorecard: still **unmeasured** under the current benchmark method as of **March 31, 2026**.
- Supported runtime scope remains exactly **Codex CLI** and **GitHub Copilot CLI**.
- Canonical entrypoint remains **`/skills`**.

That combination is intentional: PairSlash is willing to ship a precise, well-evidenced claim before it makes a broader one.
