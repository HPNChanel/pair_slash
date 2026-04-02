# PairSlash Compatibility Matrix

Generated from compat-lab metadata and deterministic release gates for PairSlash 0.4.0.

## Support semantics

- `stable-tested`: deterministic compat-lab gates are green and matching live runtime evidence exists.
- `degraded`: deterministic gates are green, but support has caveats or incomplete live evidence.
- `prep`: doctor and preview are expected, but install support is not yet claimed as live evidence.
- `known-broken`: PairSlash has an explicit blocked or broken surface. No silent fallback is allowed.

These labels are runtime-support truth only.
They do not promote product-validation status, program phase, or release scope by themselves.

## Runtime lanes

| Runtime | Target | OS lane | Support level | Recommended version | Live tested range | Deterministic baseline | Release gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Codex CLI | repo | macOS | stable-tested | 0.116.0 | 0.116.0 | 0.116.0 | required |
| GitHub Copilot CLI | user | Linux | degraded | 2.50.x | none recorded | 2.50.0 | required |
| Codex CLI | repo | Windows | prep | 0.116.0 | none recorded | 0.116.0 | nightly-only |
| GitHub Copilot CLI | user | Windows | prep | 2.50.x | none recorded | 2.50.0 | nightly-only |

## Known issues

| Issue | Surface | Status | Affected lanes | Details |
| --- | --- | --- | --- | --- |
| K1 | Copilot direct invocation with -p/--prompt | known-broken | GitHub Copilot CLI | Use /skills as the canonical entrypoint. Prompt-mode direct invocation remains blocked. |
| K2 | Windows live install evidence | prep | Codex CLI repo, GitHub Copilot CLI user | Compat-lab covers doctor and preview; stable-tested claims require manual live install evidence. |
| K3 | Codex read-only sandbox complex PowerShell | degraded | Codex CLI | Prefer simple single-statement PowerShell commands in verification and troubleshooting steps. |

## Release-gating matrix

| Gate | Trigger | Checks | Required | Notes |
| --- | --- | --- | --- | --- |
| quick-pr | pull_request and push | lint, unit, compat goldens, matrix sync | yes | Fast deterministic gate that blocks obvious compiler/installer/docs regressions. |
| cross-os-acceptance | pull_request and push | macOS Codex acceptance, Linux Copilot acceptance, Windows prep acceptance | yes | Cross-OS installability and doctor coverage with fake runtimes and deterministic lanes. |
| nightly-smoke | nightly schedule or workflow_dispatch | fixture smoke matrix, behavior evals, artifact regeneration check | yes | Deeper regression control without forcing the full cost into every PR. |
| release-readiness | manual pre-release gate | full JS suite, compat-lab suite, public docs present, generated artifacts up to date | yes | Release promotion must not proceed unless this gate is green. |

## Fixture coverage

| Fixture | Archetype | Primary workflow | Modeled risks |
| --- | --- | --- | --- |
| repo-basic-readonly | baseline-readonly | pairslash-plan | docs-drift, preview-regression, readonly-install-surface |
| repo-write-authority-memory | write-authority-memory | pairslash-memory-write-global | hidden-write, preview-regression, no-silent-fallback |
| repo-backend-mcp | node-service | pairslash-backend | mcp-config-drift, tooling-gap, degraded-runtime-surface |
| repo-monorepo-workspaces | monorepo | pairslash-plan | workspace-root-resolution, install-path-drift, multi-pack-selection |
| repo-conflict-existing-runtime | runtime-conflict | pairslash-plan | unmanaged-runtime-footprint, orphaned-state, blocked-install |
| repo-node-service | node-service | pairslash-backend | service-config-drift, workflow-selection, generated-asset-noise |
| repo-python-service | python-service | pairslash-backend | polyglot-repo-coverage, config-fragment-placement, service-onboarding-regression |
| repo-docs-heavy | docs-heavy | pairslash-plan | docs-surface-regression, preview-boundary, release-doc-drift |
| repo-infra-repo | infra-repo | pairslash-devops | config-fragment-placement, release-gating-drift, high-blast-radius-changes |
| repo-unsafe-repo | unsafe-repo | pairslash-devops | destructive-commands, hidden-write, silent-fallback, approval-boundary |

## How to use this matrix

- Choose `stable-tested` when you need the strongest support claim for release or rollout decisions.
- Treat `degraded` as supported with caveats, not as a silent fallback lane.
- Treat `prep` as preview/doctor coverage only until live install evidence is recorded.
- Reproduce issues through compat-lab fixtures and behavior evals before broadening support claims.
