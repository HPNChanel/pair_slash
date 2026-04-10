# Phase 18 Workflow Maturity Charter

This charter defines the workflow-maturity contract for PairSlash.
It is intentionally strict and fail-closed.

Implementation anchors:

- `packs/core/*/pack.manifest.yaml`
- `packages/core/spec-core/src/validate.js`
- `packages/core/spec-core/src/pack-catalog.js`
- `packages/tools/lint-bridge/src/index.js`
- `packages/core/spec-core/registry/packs.yaml`

## 1. Phase Intent

Phase 18 exists to prevent dishonest workflow promotion.
It separates:

- workflow maturity truth
- runtime lane support truth
- release verdict truth
- product-validation truth

Workflow maturity is assigned in `support.workflow_maturity` and then resolved
to an effective ceiling by evidence and blockers.

## 2. Scope

In scope:

- maturity taxonomy for core workflows
- promotion and demotion policy
- evidence classes and minimum requirements
- allowed public wording by maturity label
- validation/lint/catalog fail-closed enforcement

Out of scope:

- adding runtimes beyond Codex CLI and GitHub Copilot CLI
- replacing runtime-lane support labels
- changing release-channel semantics
- changing Global Project Memory authority boundaries

## 3. Non-Goals

- No product-thesis redesign.
- No third runtime.
- No weakening of canonical entrypoint behavior.
- No claim that deterministic tests alone justify broad support.
- No automatic background promotion or hidden demotion writes.

## 4. Guardrails

- PairSlash remains a trust layer for terminal-native AI workflows.
- `/skills` remains the canonical front door.
- Global Project Memory write authority remains explicit and preview-gated.
- Runtime-lane labels in compatibility assets are not workflow labels.
- `catalog.maturity` (release channel) is not workflow maturity.
- Advanced packs remain quarantined from core workflow maturity semantics.
- Tooling may block or demote effective maturity but may not silently assign a
  higher checked-in label.

## 5. Taxonomy

Workflow maturity labels are:

| Label | Meaning | Public recommendation level |
| --- | --- | --- |
| `canary` | Implemented and deterministic enough for narrow maintainer-guided use. | Not default. Caveated only. |
| `preview` | Publicly visible for exact documented lanes with initial live workflow proof. | Limited recommendation. |
| `beta` | Repeatedly verified on documented default lanes with consistent tooling/doc surfaces. | Recommended with caveats. |
| `stable` | Repeated fresh live proof on documented supported lanes with release/lane safety alignment. | Default recommendation on documented lanes only. |
| `deprecated` | Workflow retained for migration/retirement only. | Never recommended for new adoption. |

Notes:

- `deprecated` is a lifecycle state, not an upgrade above `stable`.
- Blocked state is a promotion override, not a separate maturity label.

## 6. Promotion Rules

Assignment authority:

- Canonical assigned label lives only in
  `packs/core/*/pack.manifest.yaml` -> `support.workflow_maturity`.
- Only maintainers may assign labels via manifest edits.
- Tooling computes effective ceiling and blocks overclaims.

Label requirements:

- `canary` requires valid canonical manifest, canonical entrypoint behavior,
  deterministic references, and no blocked runtime in claimed lanes.
- `preview` requires all `canary` requirements plus at least one
  `/skills`-based live workflow reference per claimed runtime.
- `beta` requires all `preview` requirements plus repeated live workflow
  references on documented default lanes and checklist/doc sync.
- `stable` requires all `beta` requirements plus repeated fresh live workflow
  references on every lane named in stable wording, strong lane support, and
  release gate eligibility.
- `deprecated` requires migration or replacement guidance and removal from
  default onboarding recommendation.

Memory-write rule:

- Memory-write workflows require stricter operational-safety evidence than
  read-only workflows for `preview`, `beta`, and `stable`.

## 7. Demotion Rules

Demotion is mandatory when checked-in maturity exceeds current evidence.

Canonical trigger codes:

- `evidence-stale`
- `runtime-regression`
- `release-no-go`
- `docs-drift`
- `write-safety-regression`

Mandatory downgrade behavior:

- Missing deterministic base evidence drops maturity to `canary`.
- Missing or insufficient live workflow evidence drops `preview|beta|stable`
  to the highest still-proven label.
- Release `NO-GO` blocks `stable` claims.
- Runtime support blockers or unverified required lanes cap effective maturity.
- Deprecated without migration guidance is invalid and blocked.

Demotion execution policy:

- CI/lint/catalog must expose blockers deterministically.
- Manifest label updates remain explicit maintainer actions.

## 8. Evidence Policy

Allowed evidence classes:

- `implementation` (manifest/code/derived assets)
- `deterministic` (tests, lint, compat-lab, release checks)
- `live-workflow` (canonical `/skills` execution evidence)
- `operational-safety` (preview/apply/audit/recovery controls)
- `migration` (replacement/retirement guidance)

Minimum by label:

| Label | Required evidence |
| --- | --- |
| `canary` | implementation + deterministic |
| `preview` | canary baseline + live-workflow per claimed runtime |
| `beta` | preview baseline + repeated live-workflow per claimed runtime |
| `stable` | beta baseline + repeated fresh live-workflow on stable lanes + release/lane safety alignment |
| `deprecated` | migration evidence plus deprecated-state sync |

Evidence rules:

- Canonical picker evidence must come from `/skills`.
- Deterministic evidence alone is never enough for `stable`.
- Evidence does not transfer across runtimes.
- Advanced-lane evidence cannot elevate core maturity.

## 9. Public Wording Policy

Allowed wording:

| Label | Allowed wording pattern |
| --- | --- |
| `canary` | "canary workflow", "maintainer-guided canary" |
| `preview` | "preview on documented lanes" |
| `beta` | "beta on documented default lanes with caveats" |
| `stable` | "stable on documented lanes" |
| `deprecated` | "deprecated; use `<replacement>`" |

Forbidden wording:

- Do not use lane support labels as workflow maturity shortcuts.
- Do not use release-channel labels as workflow maturity shortcuts.
- Do not claim stable without exact lane scope.
- Do not recommend deprecated workflows without migration guidance.
- Do not claim support outside the two-runtime boundary.

## 10. Exit Gates

Phase 18 is complete only when all are true:

- This charter is committed and referenced by governance docs.
- Core manifests expose `support.workflow_maturity` with Phase 18 metadata.
- Spec-core validation enforces transition legality and evidence floors.
- Catalog exposes assigned/effective maturity, checklist readiness, and active
  demotion triggers.
- Lint fails closed on overclaim, illegal transition, or missing required
  checklist/migration signals.
- Generated compatibility/catalog artifacts are synced.
- `npm run lint`, `npm run test`, and `npm run test:release` pass.

## 11. Failure Conditions

Phase 18 is `NO-GO` if any remain true:

- Workflow maturity can be promoted on narrative confidence.
- Stable can be claimed without repeated live workflow evidence.
- Runtime support, docs, lint, and catalog can disagree silently.
- Advanced lanes can influence core maturity ceilings.
- Deprecated can be set without migration guidance.
- Memory-write workflows can reach high maturity without strict safety proof.

## 12. Sequencing Notes

- Phase 18 provides enforceable maturity truth inputs for later release and
  promotion operations.
- It prepares future automation by making promotion/demotion evidence explicit.
- It does not widen runtime support, claim product-validation exit, or add new
  runtime/front-door semantics.
