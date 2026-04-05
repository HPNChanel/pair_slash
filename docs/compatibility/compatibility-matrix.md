# PairSlash Compatibility Matrix

Generated from docs/compatibility/runtime-surface-matrix.yaml and compat-lab metadata for PairSlash 0.4.0.

This matrix is the public markdown rendering of the runtime-support catalog PairSlash consumes today.
It is narrower than implementation truth and narrower than deterministic test
coverage.

## Claim boundary

- `implemented`: code, manifests, or adapters exist in the repo.
- `deterministic-tested`: compat-lab or release gates cover the surface
  repeatably.
- `live-evidence-backed`: manual runtime verification is recorded for the exact
  runtime/target/OS lane.
- `publicly supported`: this matrix lists the lanes PairSlash can claim
  publicly today.

Implementation existence, doctor output, preview output, or deterministic
coverage outside the rows below do not widen public support, product-validation
status, or release scope by themselves.

## Evidence classes

- `deterministic evidence`: repeatable tests, release gates, and generated
  artifacts that prove implementation and regression control.
- `fake/shim evidence`: compat-lab coverage that uses fake runtime
  binaries or host overrides. Useful for regression control, never enough
  for live support promotion.
- `live evidence`: real runtime, target, OS, and version observations from
  `/skills` interaction or live install behavior on the documented lane.

## Evidence policy

- Canonical entrypoint: `/skills`
- `live_smoke` can document feasibility or failure, but it cannot promote a
  lane beyond `degraded` or `prep`.
- `live_verification` is the minimum evidence for public lane claims on the
  exact lane.
- `repeated_live_verification` is the minimum evidence for `stable-tested`.
- One-off runs are not enough for `stable-tested`.

## Support semantics

- `blocked`: fresh negative live evidence blocks the documented lane or surface until newer live verification supersedes it.
- `prep`: deterministic coverage or live smoke may exist, but canonical `/skills` verification is not yet recorded for the documented lane.
- `preview`: one fresh canonical live verification exists for the exact lane, but repeated live verification is not recorded yet.
- `degraded`: real runtime evidence exists, but the canonical `/skills` path is missing, partial, or caveated for the documented lane.
- `stable-tested`: repeated fresh canonical live verification exists for the exact lane.

These labels are runtime-support truth only.
They do not promote product-validation status, program phase, or release scope by themselves.
They also do not change repository licensing, `NOTICE` posture, or package
publishability. Legal/package truth stays with
`docs/releases/legal-packaging-status.md`, root/package manifests, `LICENSE`,
and `NOTICE`.

## Runtime lanes

| Runtime | Target | OS lane | Support level | Required evidence | Best live evidence | Freshness | Last verified | Recommended version | Live tested range | Deterministic baseline | Release gate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Codex CLI | repo | macOS | degraded | live_verification | live_smoke | fresh | 2026-03-21 | 0.116.0 | none recorded | 0.116.0 | required |
| GitHub Copilot CLI | user | Linux | prep | live_verification | none recorded | none-recorded | none recorded | 2.50.x | none recorded | 2.50.0 | required |
| Codex CLI | repo | Windows | prep | live_verification | live_smoke | fresh | 2026-04-05T12:28:24.545Z | 0.118.0 | none recorded | 0.116.0 | nightly-only |
| GitHub Copilot CLI | user | Windows | prep | live_verification | live_smoke | fresh | 2026-04-05T12:28:23.177Z | 2.50.x | none recorded | 2.50.0 | nightly-only |

## Known issues

| Issue | Surface | Status | Affected lanes | Details |
| --- | --- | --- | --- | --- |
| K1 | Copilot direct invocation with -p/--prompt | blocked | GitHub Copilot CLI | Use /skills as the canonical entrypoint. Prompt-mode direct invocation remains blocked. |
| K2 | Windows live install evidence | prep | Codex CLI repo, GitHub Copilot CLI user | Compat-lab covers doctor and preview; stable-tested claims require manual live install evidence. |
| K3 | Codex read-only sandbox complex PowerShell | degraded | Codex CLI | Prefer simple single-statement PowerShell commands in verification and troubleshooting steps. |

## Lane evidence records

| Lane | Deterministic evidence | Fake/shim evidence | Live evidence | Evidence records / guard rails |
| --- | --- | --- | --- | --- |
| Codex CLI / repo / macOS | `docs/runtime-mapping/pilot-acceptance.md`<br>`packages/tools/compat-lab/tests/acceptance.test.js`<br>`packages/tools/compat-lab/tests/matrix.test.js` | `packages/tools/compat-lab/src/runtime-fixtures.js`<br>`packages/tools/compat-lab/src/acceptance.js` | `docs/compatibility/phase-0-acceptance.md`<br>`.pairslash/project-memory/60-architecture-decisions/phase-0-codex-cli-verification-on-v0-116-0.yaml`<br>`.pairslash/project-memory/70-known-good-patterns/codex-exec-as-non-interactive-skill-testing-surface.yaml` | `docs/evidence/live-runtime/codex-cli-repo-macos.md`<br>`docs/evidence/live-runtime/codex-cli-repo-macos.yaml`<br>`docs/compatibility/runtime-verification.md`<br>`docs/releases/public-claim-policy.md` |
| GitHub Copilot CLI / user / Linux | `docs/runtime-mapping/pilot-acceptance.md`<br>`packages/tools/compat-lab/tests/acceptance.test.js`<br>`packages/tools/compat-lab/tests/matrix.test.js` | `packages/tools/compat-lab/src/runtime-fixtures.js`<br>`packages/tools/compat-lab/src/acceptance.js` | none recorded | `docs/evidence/live-runtime/copilot-cli-user-linux.md`<br>`docs/evidence/live-runtime/copilot-cli-user-linux.yaml`<br>`docs/compatibility/runtime-verification.md`<br>`docs/releases/public-claim-policy.md` |
| Codex CLI / repo / Windows | `docs/runtime-mapping/pilot-acceptance.md`<br>`packages/tools/compat-lab/tests/acceptance.test.js`<br>`packages/tools/compat-lab/tests/matrix.test.js` | `packages/tools/compat-lab/src/runtime-fixtures.js`<br>`packages/tools/compat-lab/src/acceptance.js` | `docs/evidence/live-runtime/codex-cli-repo-windows.md` | `docs/evidence/live-runtime/codex-cli-repo-windows.md`<br>`docs/evidence/live-runtime/codex-cli-repo-windows.yaml`<br>`docs/compatibility/runtime-verification.md`<br>`docs/releases/public-claim-policy.md` |
| GitHub Copilot CLI / user / Windows | `docs/runtime-mapping/pilot-acceptance.md`<br>`packages/tools/compat-lab/tests/acceptance.test.js`<br>`packages/tools/compat-lab/tests/matrix.test.js` | `packages/tools/compat-lab/src/runtime-fixtures.js`<br>`packages/tools/compat-lab/src/acceptance.js` | `docs/evidence/live-runtime/copilot-cli-user-windows.md` | `docs/evidence/live-runtime/copilot-cli-user-windows.md`<br>`docs/evidence/live-runtime/copilot-cli-user-windows.yaml`<br>`docs/compatibility/runtime-verification.md`<br>`docs/releases/public-claim-policy.md` |

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

- Choose `stable-tested` only when repeated fresh canonical live verification is checked in.
- Treat `degraded` as supported with explicit caveats, not as a silent fallback lane.
- Treat `prep` as deterministic or smoke coverage only until canonical live verification is recorded.
- Reproduce issues through compat-lab fixtures and behavior evals before broadening support claims.
