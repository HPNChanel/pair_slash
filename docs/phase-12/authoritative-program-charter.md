---
title: Authoritative Program Charter
phase: 12
status: active-charter
owner_file: docs/phase-12/authoritative-program-charter.md
---

# PairSlash Authoritative Program Charter

## 1. Charter Purpose

This charter exists to stop phase-governance drift. It makes one file responsible for the official phase statement, the truth-layer split, the claim ladder, the support-boundary ladder, and the source-of-truth hierarchy so README, release docs, compatibility docs, and project memory do not keep competing with each other.

## 2. Canonical Product Statement

PairSlash is the trust layer for terminal-native AI workflows on exactly two runtimes, Codex CLI and GitHub Copilot CLI, with `/skills` as the canonical front door, explicit preview-first workflows, and Global Project Memory as the authoritative project memory layer. Its current publicly claimable surface is the shipped installability and trust-boundary substrate evidenced in repo code, release gates, and lane-specific compatibility docs; it is not yet entitled to claim benchmark-backed product validation, broad runtime parity, hidden-write behavior, or package-manager publication beyond current repo metadata.

## 3. Current Program Truth

### Implementation Truth

Implementation truth is what the repo actually ships today in code, manifests, and deterministic checks. The authoritative implementation surfaces are `packs/core/*/pack.manifest.yaml`, `packages/core/spec-core/src/pack-catalog.js`, `packages/tools/installer/`, `packages/tools/doctor/`, `packages/core/memory-engine/`, and `packages/tools/compat-lab/`. The read-path authority contract for Global Project Memory is fixed separately in `docs/architecture/phase-17-read-authority-charter.md` and implemented through the shared resolver, contract engine, and `explain-context` surface. The optional compatibility shim at `packs/core/*/pack.trust.yaml` is downstream only, and the derived pack index at `packages/core/spec-core/registry/packs.yaml` is downstream only. This layer proves that PairSlash has a narrow two-runtime installability and trust substrate with `/skills`, preview-first lifecycle commands, explicit memory write authority, no-silent-fallback discipline, and a shared read-authority contract.

### Product-Validation Truth

Product-validation truth is governed publicly by `docs/validation/phase-3-5/verdict.md`. The detailed benchmark apparatus and raw logs are maintainer-local. That layer is still `NO-GO`. No official benchmark runs are recorded under the current method, so PairSlash has not validated must-win workflow pull strongly enough to claim progress beyond Phase 3.5 business validation.

### Public-Claim Truth

Public-claim truth is narrower than implementation truth. A public sentence is allowed only when it maps back to evidence class and source, stays inside `docs/releases/public-claim-policy.md`, stays inside `docs/releases/scoped-release-verdict.md`, stays inside the runtime-support boundary in `docs/compatibility/runtime-surface-matrix.yaml`, stays inside `docs/releases/legal-packaging-status.md`, and does not outrun current legal/package metadata. README wording, onboarding wording, release wording, and support wording are downstream only.

### Runtime-Support Truth

Runtime-support truth is lane-specific, not product-global. The machine-readable runtime-support catalog is `docs/compatibility/runtime-surface-matrix.yaml`, and `docs/compatibility/compatibility-matrix.md` is its public markdown rendering. Lane-bound evidence records live under `docs/evidence/live-runtime/`, and promotion evidence is recorded through `docs/compatibility/runtime-verification.md` plus those lane records. Current public support reality remains narrow: Codex CLI repo on macOS is `degraded`, GitHub Copilot CLI user on Linux is `prep`, Windows lanes are `prep`, and Copilot prompt-mode direct invocation remains blocked.

### Workflow-Maturity Truth

Workflow-maturity truth is workflow-specific, not a release-channel alias and
not a runtime-lane alias. The authoritative policy is
`docs/architecture/phase-18-workflow-maturity-charter.md`, and the canonical
assigned labels live in `packs/core/*/pack.manifest.yaml` under
`support.workflow_maturity`. `packages/core/spec-core/src/pack-catalog.js`
computes the effective ceiling from deterministic coverage, pack-scoped live
evidence, default public runtime lanes, and the scoped release verdict. This
layer may demote or block an overclaimed workflow, but it does not widen
runtime-lane support truth or product-validation truth.

### Release-Trust Truth

Release-trust truth answers whether PairSlash can make a scoped installability claim without pretending product validation is complete. The authoritative public files are `docs/releases/scoped-release-verdict.md` and `docs/releases/phase-5-shipped-scope.md`. Maintainer release-readiness runbooks remain local-only. That layer is currently `NO-GO` on the current branch because release-readiness is red, and still `NO-GO` for product-validation exit. Legal and package publicness remain capped by current metadata in `package.json`, package-level `package.json` files, the absence or presence of `LICENSE` and `NOTICE`, and the current boundary recorded in `docs/releases/legal-packaging-status.md`.

## 4. Official Phase Statement

PairSlash is currently at Phase 3.5 business validation on top of a technically shipped Phase 4 installability substrate with additional Phase 5/6 hardening in the repo.

What has been implemented: a two-runtime trust layer with `/skills` as the canonical front door, preview-first managed lifecycle commands, explicit Global Project Memory write authority, deterministic compatibility artifacts, and release-gated installability support.

What has been validated: technical implementation, deterministic regression coverage, a scoped release/installability verdict, and lane-specific runtime support wording.

What is still scoped only: benchmark-backed product pull, weekly-reuse proof, live install parity beyond the exact documented lanes, and package publication scope beyond current repo metadata.

What must not be overclaimed: that tests equal market validation, that preview or deterministic acceptance equals live runtime support, that Windows has live parity, that PairSlash supports a third runtime, or that read workflows or background processes can write authoritative project memory implicitly.

## 5. Authority Hierarchy

| Truth topic | Authoritative source | Role |
| --- | --- | --- |
| Phase truth | `docs/phase-12/authoritative-program-charter.md` | Owns the official stage sentence, truth-layer split, and authority hierarchy. |
| Validation verdict | `docs/validation/phase-3-5/verdict.md` | Owns product-validation `GO/NO-GO` only. |
| Benchmark truth package | `docs/validation/phase-3-5/benchmark-truth.yaml`, `benchmark-task-catalog.yaml`, `benchmark-log-schema.yaml`, `benchmark-scoring-rubric.yaml`, and `benchmark-lane-wording.yaml` | Own machine-readable benchmark task cards, scoring contract, run schema, lane wording, and round-one benchmark boundary. |
| Public claim policy | `docs/releases/public-claim-policy.md` | Owns allowed and forbidden public wording rules, not the phase statement. |
| Runtime support policy | `docs/compatibility/runtime-surface-matrix.yaml` | Owns machine-readable lane labels and promotion inputs consumed by doctor and compat-lab. |
| Runtime support markdown | `docs/compatibility/compatibility-matrix.md` | Public rendering of the runtime-support catalog; never a competing source. |
| Runtime promotion evidence | `docs/compatibility/runtime-verification.md`, `docs/evidence/live-runtime/`, and `docs/compatibility/runtime-surface-matrix.yaml` | Own evidence class and promotion/demotion inputs for runtime labels. |
| Workflow maturity policy | `docs/architecture/phase-18-workflow-maturity-charter.md` | Owns workflow maturity taxonomy, promotion/demotion policy, public wording limits, and the separation from release channel plus runtime-lane truth. |
| Workflow maturity wording system | `docs/architecture/phase-18-workflow-maturity-wording-system.md` | Owns reusable wording blocks for `implemented`, `verified`, `supported`, `recommended`, and workflow-label language across public plus maintainer-facing docs. |
| Read-authority contract | `docs/architecture/phase-17-read-authority-charter.md` | Owns authoritative read-path precedence, explain-context resolution contract, conflict surfacing, and the Phase 17 exit gate. |
| Pack catalog truth | `packs/core/*/pack.manifest.yaml` | Own canonical core pack identity, release channel, workflow maturity assignment, support scope, runtime evidence mapping, and maintainer metadata. |
| Pack catalog consumer API | `packages/core/spec-core/src/pack-catalog.js` | Resolves the authoritative pack catalog used by lint, doctor, docs rendering, and release-trust build. |
| Pack catalog lifecycle conformance | `packages/core/spec-core/tests/manifest-v2.conformance.test.js` | Detects manifest/catalog drift, completeness regressions, and unsupported promotion claims. |
| Pack trust shim | `packs/core/*/pack.trust.yaml` | Optional compatibility shim only; may not become a competing truth root. |
| Pack catalog index | `packages/core/spec-core/registry/packs.yaml` | Derived index of the canonical pack catalog; may not become a competing truth root. |
| Maintainer release-readiness records | Local-only maintainer docs | Track non-public release blockers and operational checklists without becoming public truth roots. |
| Legal/package status boundary | `docs/releases/legal-packaging-status.md` | Summarizes the current legal/package publicness boundary from manifests and legal files without replacing them. |
| Legal/package truth | `package.json`, `packages/*/*/package.json`, `LICENSE`, `NOTICE` | Own legal/package publicness; absence is part of the truth. |
| Machine-readable charter pointer | `.pairslash/project-memory/00-project-charter.yaml` | Downstream identity and pointer record only. |

## 6. Claim Ladder

| Level | Required evidence | Forbidden wording | Allowed wording |
| --- | --- | --- | --- |
| `implemented` | Source code, manifests, and generated assets exist in the repo. | "validated", "supported everywhere", "market-proven" | "implemented in the repo", "present in code/manifests" |
| `repo-verified` | Current-branch command output or machine-readable report from the repo confirms the behavior. | "release-ready", "live runtime proven", "customer validated" | "verified on the current branch", "repo-verified" |
| `deterministic-covered` | Repeatable automated tests or compat-lab gates pass for the surface. | "live evidence", "market validated", "broad runtime parity" | "deterministic tests pass", "covered by compat-lab or release gates" |
| `lane-live-verified` | Manual live runtime evidence is recorded in lane-bound runtime verification artifacts with exact lane details. | "all lanes supported", "product validated", "phase advanced" | "live-verified for the documented lane", "supported at the documented lane level" |
| `publicly claimable` | The statement is backed by the appropriate evidence above and is allowed by this charter, the public claim policy, the relevant verdict file, the compatibility boundary, and legal/package metadata. | Any broader wording than the governing evidence allows | "publicly claimable within the documented scope" |

Rule: no claim may skip levels. Product-validation claims require the validation verdict. Runtime-support claims require the compatibility matrix. Release/installability claims require the scoped release verdict. Legal/package claims require legal/package metadata.

## 7. Support Boundary Rules

| Label | How to word it | What it means | Promotion / demotion rule |
| --- | --- | --- | --- |
| `stable-tested` | "stable-tested on the documented lane" | Repeated fresh canonical live verification exists for that exact lane. | Runtime maintainer and release-truth owner update `docs/evidence/live-runtime/`, `runtime-surface-matrix.yaml`, `runtime-verification.md`, and `compatibility-matrix.md` together. |
| `preview` | "preview on the documented lane" | One fresh canonical live verification exists for that exact lane, but repeated live verification does not. | Same as `stable-tested`; one-off proof is not enough for stable. |
| `degraded` | "supported with documented caveats on the documented lane" | Real runtime evidence exists, but canonical `/skills` proof is missing, partial, or caveated. | Same as `stable-tested`; caveat must be named explicitly. |
| `prep` | "prep lane only" | Doctor, preview, or live smoke may exist, but canonical live verification is not yet claimable. | Same as `stable-tested`; doctor or preview alone cannot promote it. |
| `blocked` | "blocked on the documented lane or surface" | Fresh negative live evidence blocks the surface or lane. No silent fallback is allowed. | Same as `stable-tested`; demotion or recovery must update the same runtime sources. |
| `unsupported` | "unsupported" | The lane or surface is outside the documented support boundary. | Runtime maintainer or release-truth owner may demote to `unsupported`; promotion requires a full runtime-support update set. |
| `docs-only` | "docs-only" | The item is documentation guidance, not support evidence. | Docs owner may apply or remove this label if no runtime claim is widened. |
| `internal/helper` | "internal/helper" | The item is a maintainer or helper surface, not a public support guarantee. | Subsystem maintainer may apply or remove this label if no public support claim changes. |

Rule: only `stable-tested`, `preview`, `degraded`, `prep`, and `blocked` are public runtime-lane words. `unsupported`, `docs-only`, and `internal/helper` are boundary controls and must not be laundered into public support claims.

## 8. Sync Policy

The following files sync from this charter:

- `README.md`
- `docs/phase-9/README.md`
- `docs/phase-9/onboarding-path.md`
- `docs/releases/public-claim-policy.md`
- `.pairslash/project-memory/00-project-charter.yaml`

The following files must never become competing truth roots for phase/governance wording:

- `README.md`
- `docs/phase-9/README.md`
- `docs/phase-9/onboarding-path.md`
- `docs/releases/public-claim-policy.md`
- `docs/releases/scoped-release-verdict.md`
- `docs/validation/phase-3-5/verdict.md`
- `docs/compatibility/compatibility-matrix.md`
- `docs/phase-9/oss-positioning.md`
- `docs/phase-9/phase-9-baseline-reality-lock.md`
- historical phase-exit and audit notes kept in local-only maintainer docs

Rule: downstream files may restate the official phase sentence, but they must point back to this charter and must not redefine the authority hierarchy.

## 9. Anti-Drift Rules

- README must not claim product-validation exit, broad runtime parity, package-manager publication, or any runtime beyond Codex CLI and GitHub Copilot CLI.
- README, release wording, and public narrative docs must not use OSS/public-package wording stronger than current legal/package metadata allows.
- README and install docs must not imply package-manager publication while the repository and workspace manifests remain `private: true`.
- Release checklist must not treat deterministic tests, preview output, or doctor output as product-validation proof or live runtime support by themselves.
- Compatibility wording must stay lane-specific and must not imply that support labels promote program phase or product maturity.
- Workflow maturity wording must not flatten release channel, runtime-lane support, or product-validation status into one label.
- Validation docs must not become release verdicts, and release docs must not become product-validation verdicts.
- Benchmark Markdown guides must stay derivative of the machine-readable benchmark truth package and must not own competing benchmark policy.
- Pack catalog or pack count changes must not widen public support wording unless the canonical manifests, runtime-support catalog, optional trust shims, derived registry, and release docs all stay aligned.
- `docs/releases/legal-packaging-status.md` must stay aligned with package metadata and the current presence or absence of `LICENSE` and `NOTICE`.
- `.pairslash/project-memory/00-project-charter.yaml` may summarize and point, but it must not carry a competing narrative root.

## 10. Official Answer Bank

| Question | Exact short answer |
| --- | --- |
| PairSlash la gi? | "PairSlash la trust layer cho terminal-native AI workflows tren Codex CLI va GitHub Copilot CLI." |
| PairSlash dang o phase nao? | "PairSlash is currently at Phase 3.5 business validation on top of a technically shipped Phase 4 installability substrate with additional Phase 5/6 hardening in the repo." |
| Nhung gi da that su ship? | "Da ship mot installability va trust substrate hep cho hai runtime loi, voi `/skills`, doctor, preview-first lifecycle, va explicit Global Project Memory writes." |
| Nhung gi chua duoc phep noi manh? | "Chua duoc noi rang PairSlash da benchmark-validated, co broad runtime parity, co Windows live parity, hoac co hidden-write memory behavior." |
| PairSlash support runtime nao toi muc nao? | "Public support van la lane-specific: Codex repo macOS `degraded`, Copilot user Linux `prep`, Windows `prep`, va Copilot prompt-mode direct invocation bi block." |
| Vi sao `/skills` van la front door chuan? | "Vi do la runtime-native browse surface duoc PairSlash support tren ca hai runtime, va no giu workflow discovery explicit thay vi prompt-mode drift." |

## 11. Phase 12 Exit Gate

- [ ] `docs/phase-12/authoritative-program-charter.md` exists and contains every required section in this charter.
- [ ] `.pairslash/project-memory/00-project-charter.yaml` is reduced to an identity-and-pointer system record with the official stage sentence and `truth_sources`.
- [ ] `README.md`, `docs/phase-9/README.md`, and `docs/phase-9/onboarding-path.md` reuse the exact official stage sentence and point back to this charter.
- [ ] `docs/releases/public-claim-policy.md` no longer owns a competing stage root.
- [ ] `docs/releases/scoped-release-verdict.md` and `docs/validation/phase-3-5/verdict.md` explicitly state their boundary and do not promote each other.
- [ ] `docs/compatibility/compatibility-matrix.md` states that support labels are runtime-support truth only.
- [ ] Truth-governance regression checks pass in `npm run test` and `npm run test:release`.

## "Founder/Maintainer Single Answer"

PairSlash is currently at Phase 3.5 business validation on top of a technically shipped Phase 4 installability substrate with additional Phase 5/6 hardening in the repo. What is shipped today is a narrow two-runtime trust layer for Codex CLI and GitHub Copilot CLI with `/skills` as the canonical front door, preview-first managed lifecycle commands, explicit Global Project Memory writes, and lane-specific support labels. What is not yet validated is benchmark-backed product pull, broad runtime parity, or any claim beyond the scoped release verdict, the compatibility matrix, the product-validation verdict, and current legal/package metadata.
