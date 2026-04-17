# PairSlash Compatibility Matrix

Generated from docs/compatibility/runtime-surface-matrix.yaml and compat-lab metadata for PairSlash 0.4.0.

This matrix is the public markdown rendering of the runtime-support catalog PairSlash consumes today.
It is narrower than implementation truth and narrower than deterministic test
coverage.

## Claim boundary

- `canary`: workflow exists with narrow deterministic confidence and explicit caveats.
- `preview`: workflow has at least one fresh canonical `/skills` live verification
  on the claimed runtime lanes.
- `beta`: workflow has repeated live verification on documented default lanes.
- `stable`: workflow has repeated live verification plus `stable-tested` lane
  support on the documented lanes.
- `deprecated`: workflow is retired for new use and must include migration or
  replacement guidance.
- `publicly supported`: this matrix still lists runtime lanes PairSlash can claim
  publicly today.

Implementation existence, doctor output, preview output, or deterministic
coverage outside the rows below do not widen public support, product-validation
status, or release scope by themselves.
They also do not assign workflow maturity; that stays with
`docs/architecture/phase-18-workflow-maturity-charter.md`,
`docs/architecture/phase-18-workflow-maturity-wording-system.md`, plus
canonical core pack manifests.

## Evidence classes

- `deterministic evidence`: repeatable tests, release gates, and generated
  artifacts that prove implementation and regression control.
- `fake acceptance evidence`: deterministic compat-lab scenario outputs that
  exercise install and doctor logic under fixture control.
- `shim acceptance evidence`: fake runtime binaries and host overrides that
  make deterministic compat-lab lanes reproducible.
- `fake acceptance` and `shim acceptance` are regression confidence only.
  They never widen public support claims.
- `live evidence`: real runtime, target, OS, and version observations from
  `/skills` interaction or live install behavior on the documented lane.

## Evidence policy

- Canonical entrypoint: `/skills`
- Registry schema: `docs/evidence/live-runtime/schema.live-runtime-lane-record.yaml`
- `live_smoke` can document feasibility or failure, but it cannot promote a
  lane beyond `degraded` or `prep`.
- `live_verification` is the minimum evidence for public lane claims on the
  exact lane.
- `repeated_live_verification` is the minimum evidence for `stable-tested`.
- One-off runs are not enough for `stable-tested`.
- Scripted live-run steps allowed: `host_profile_capture`, `runtime_version_capture`, `doctor`, `preview_install`, `install_apply`
- Manual live-run steps required: `canonical_skills_listing`, `workflow_selection_from_skills`, `workflow_prompt_and_response_capture`, `memory_write_preview_observation`
- Copilot required tool presence: `gh`, `gh_copilot_extension`
- Windows promotion gate requires: `install_apply`, `canonical_picker`, `workflow_execution`

## Support semantics

- `blocked`: fresh negative live evidence blocks the documented lane or surface until newer live verification supersedes it.
- `prep`: deterministic coverage or live smoke may exist, but canonical `/skills` verification is not yet recorded for the documented lane.
- `preview`: one fresh canonical live verification exists for the exact lane, but repeated live verification is not recorded yet.
- `degraded`: real runtime evidence exists, but the canonical `/skills` path is missing, partial, or caveated for the documented lane.
- `stable-tested`: repeated fresh canonical live verification exists for the exact lane.

These labels are runtime-support truth only.
They do not promote workflow maturity, product-validation status, program
phase, or release scope by themselves.
They also do not change repository licensing, `NOTICE` posture, or package
publishability. Legal/package truth stays with
`docs/releases/legal-packaging-status.md`, root/package manifests, `LICENSE`,
and `NOTICE`.

## Workflow label display convention

- If workflow labels are shown on this page, show them in a separate workflow
  field, note, or row.
- Keep `supported` for runtime lanes and keep install ordering language
  separate from maturity labels.
- Do not restate a lane label as a workflow label.
- Do not let advanced workflows or advanced lanes appear as core-default or
  core-stable by layout alone.
- If assigned and effective maturity differ, display both and treat the
  effective label as the public claim ceiling.

Approved examples:

- "Codex CLI repo macOS lane: degraded. Workflow `pairslash-plan`: canary."
- "GitHub Copilot CLI user Linux lane: prep. Workflow `pairslash-memory-write-global`: canary."

Forbidden examples:

- "Codex CLI repo macOS: stable" when that is only a lane statement
- "Copilot Linux preview means the workflow is beta"
- "Advanced lane" shown under a shared core-stable badge

## Workflow maturity snapshot (core packs)

This section is derived from canonical core manifests through the pack
catalog and must stay consistent with doctor/lint outputs.

| Workflow | Assigned | Effective | Default selection candidate | Blocked | Blockers |
| --- | --- | --- | --- | --- | --- |
| pairslash-plan | canary | canary | yes | no | none |
| pairslash-backend | canary | canary | no | no | none |
| pairslash-command-suggest | canary | canary | no | no | none |
| pairslash-devops | canary | canary | no | no | none |
| pairslash-frontend | canary | canary | no | no | none |
| pairslash-memory-audit | canary | canary | no | no | none |
| pairslash-memory-candidate | canary | canary | no | no | none |
| pairslash-memory-write-global | canary | canary | no | no | none |
| pairslash-onboard-repo | canary | canary | no | no | none |
| pairslash-release | canary | canary | no | no | none |
| pairslash-review | canary | canary | no | no | none |

Interpretation rules:

- `Assigned` is manifest intent; `Effective` is evidence-backed truth after
  blockers, demotion rules, and lane constraints.
- Public and onboarding wording must follow `Effective`, not `Assigned`.
- A `yes` value under `Default selection candidate` means install/onboarding
  may choose that workflow first; it is not a blanket support claim or
  maturity recommendation.

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

| Lane | Deterministic evidence | Fake acceptance evidence | Shim acceptance evidence | Live evidence | Evidence records / guard rails |
| --- | --- | --- | --- | --- | --- |
| Codex CLI / repo / macOS | `docs/runtime-mapping/pilot-acceptance.md`<br>`packages/tools/compat-lab/tests/acceptance.test.js`<br>`packages/tools/compat-lab/tests/matrix.test.js` | `packages/tools/compat-lab/src/acceptance.js` | `packages/tools/compat-lab/src/runtime-fixtures.js` | `.pairslash/project-memory/60-architecture-decisions/phase-0-codex-cli-verification-on-v0-116-0.yaml`<br>`.pairslash/project-memory/70-known-good-patterns/codex-exec-as-non-interactive-skill-testing-surface.yaml` | `docs/evidence/live-runtime/codex-cli-repo-macos.md`<br>`docs/evidence/live-runtime/codex-cli-repo-macos.yaml`<br>`docs/compatibility/runtime-verification.md`<br>`docs/releases/public-claim-policy.md` |
| GitHub Copilot CLI / user / Linux | `docs/runtime-mapping/pilot-acceptance.md`<br>`packages/tools/compat-lab/tests/acceptance.test.js`<br>`packages/tools/compat-lab/tests/matrix.test.js` | `packages/tools/compat-lab/src/acceptance.js` | `packages/tools/compat-lab/src/runtime-fixtures.js` | none recorded | `docs/evidence/live-runtime/copilot-cli-user-linux.md`<br>`docs/evidence/live-runtime/copilot-cli-user-linux.yaml`<br>`docs/compatibility/runtime-verification.md`<br>`docs/releases/public-claim-policy.md` |
| Codex CLI / repo / Windows | `docs/runtime-mapping/pilot-acceptance.md`<br>`packages/tools/compat-lab/tests/acceptance.test.js`<br>`packages/tools/compat-lab/tests/matrix.test.js` | `packages/tools/compat-lab/src/acceptance.js` | `packages/tools/compat-lab/src/runtime-fixtures.js` | `docs/evidence/live-runtime/codex-cli-repo-windows.md` | `docs/evidence/live-runtime/codex-cli-repo-windows.md`<br>`docs/evidence/live-runtime/codex-cli-repo-windows.yaml`<br>`docs/compatibility/runtime-verification.md`<br>`docs/releases/public-claim-policy.md` |
| GitHub Copilot CLI / user / Windows | `docs/runtime-mapping/pilot-acceptance.md`<br>`packages/tools/compat-lab/tests/acceptance.test.js`<br>`packages/tools/compat-lab/tests/matrix.test.js` | `packages/tools/compat-lab/src/acceptance.js` | `packages/tools/compat-lab/src/runtime-fixtures.js` | `docs/evidence/live-runtime/copilot-cli-user-windows.md` | `docs/evidence/live-runtime/copilot-cli-user-windows.md`<br>`docs/evidence/live-runtime/copilot-cli-user-windows.yaml`<br>`docs/compatibility/runtime-verification.md`<br>`docs/releases/public-claim-policy.md` |

## Release-gating matrix

| Gate | Trigger | Checks | Required | Notes |
| --- | --- | --- | --- | --- |
| quick-pr | pull_request and push | lint, unit, compat goldens, matrix sync | yes | Fast deterministic gate that blocks obvious compiler/installer/docs regressions. |
| cross-os-acceptance | pull_request and push | macOS Codex acceptance, Linux Copilot acceptance, Windows prep acceptance | yes | Cross-OS installability and doctor coverage with fake acceptance plus shimmed runtime fixtures in deterministic lanes. |
| nightly-smoke | nightly schedule or workflow_dispatch | fixture smoke matrix, behavior evals, artifact regeneration check | yes | Deeper regression control without forcing the full cost into every PR. |
| release-readiness | manual pre-release gate | full JS suite, compat-lab suite, public docs present, generated artifacts up to date, release trust bundle structure | yes | Release promotion must not proceed unless this gate is green. Protected CI may additionally run the live-signed release-trust verification lane when signing secrets are configured. |

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
- Do not reuse runtime-lane labels as workflow maturity labels; workflow
  maturity is governed separately by the Phase 18 charter.
- Reproduce issues through compat-lab fixtures and behavior evals before broadening support claims.
