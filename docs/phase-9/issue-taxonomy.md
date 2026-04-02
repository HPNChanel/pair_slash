---
title: Issue Taxonomy
phase: 9
status: active-draft
owner_file: docs/phase-9/issue-taxonomy.md
baseline_source: docs/phase-9/phase-9-baseline-reality-lock.md
---

# Reality Scan

PairSlash already ships the core Phase 9 support intake primitives:

- `.github/ISSUE_TEMPLATE/` now includes dedicated intake paths for install bugs, runtime mismatch, workflow bugs, memory bugs, pack requests, docs problem reports, and an artifact-heavy support-bundle template.
- `pairslash doctor` emits a `doctor-report` with `support_verdict`, `support_lane`, `checks`, `issues`, `install_blocked`, and `first_workflow_guidance`.
- `pairslash debug --bundle` and `pairslash trace export --support-bundle --include-doctor` emit a redaction-aware `support-bundle` with `safe_to_share`, `redaction_state`, and bundled intake templates.
- `docs/compatibility/compatibility-matrix.md` owns the public support words: `stable-tested`, `degraded`, `prep`, `known-broken`.
- `packages/tools/doctor` uses operational intake labels that are different from public support claims: `supported`, `unverified`, `prep`, `unsupported`, plus `pass`, `warn`, `degraded`, `fail`, `unsupported`.
- `docs/troubleshooting/compat-lab-bug-repro.md` makes compat-lab a maintainer repro path after intake, not a first-contact requirement for casual users.
- `docs/releases/phase-5-shipped-scope.md`, `docs/releases/scoped-release-verdict.md`, `docs/releases/public-claim-policy.md`, and `docs/validation/phase-3-5/verdict.md` cap all intake language to two runtimes, `/skills` as the canonical front door, explicit-write-only memory, and no silent fallback.

## Support-language boundary

| Surface | Allowed labels | Source of truth | Meaning |
| --- | --- | --- | --- |
| Public support claim | `stable-tested`, `degraded`, `prep`, `known-broken` | `docs/compatibility/compatibility-matrix.md` | What PairSlash can say publicly about a lane |
| Doctor lane | `supported`, `unverified`, `prep`, `unsupported` | `packages/tools/doctor` output | What the current runtime, target, and OS lane look like |
| Doctor verdict | `pass`, `warn`, `degraded`, `fail`, `unsupported` | `packages/tools/doctor` output | How blocking the observed local setup is |

# Decisions

## Reporter Start Map

| If the newcomer needs to report... | Use this issue surface | Start here | Minimum first-contact evidence |
| --- | --- | --- | --- |
| Install, update, uninstall, preview, doctor, or managed path bug | `surface:install-lifecycle` | `pairslash doctor` -> `.github/ISSUE_TEMPLATE/install-bug.md` | Exact command, runtime, target, OS/shell, runtime version if known, doctor output, expected vs actual |
| Runtime mismatch or support claim mismatch | `surface:runtime-mismatch` | Compatibility page plus `.github/ISSUE_TEMPLATE/runtime-mismatch.md` | Exact claim or doc path, runtime, target, OS/shell, runtime version, doctor output, observed behavior |
| Workflow behavior bug | `surface:workflow` | `.github/ISSUE_TEMPLATE/workflow-bug.md` | Workflow or pack id, task statement, expected vs actual, runtime lane, whether it ran via `/skills` |
| Memory preview, approval, write, audit, or candidate bug | `surface:memory` | `.github/ISSUE_TEMPLATE/memory-bug.md` | Preview/apply command, workflow id, expected vs actual, whether authoritative memory changed, runtime lane |
| Pack request | `surface:pack-discovery` | `.github/ISSUE_TEMPLATE/pack-request.yml` | Repo archetype, job to be done, desired outcome, runtime lane, why existing packs are insufficient |
| Docs wording drift or stale commands | `surface:docs-nav-wording` | `.github/ISSUE_TEMPLATE/docs-problem.yml` | Broken path, stale claim or command, and the repo truth path that should win |

## Surface Categories And Exact Definitions

| Surface label | Exact definition | Use it when | Do not use it for |
| --- | --- | --- | --- |
| `surface:install-lifecycle` | A bug or support problem in `doctor`, `preview install`, `install`, `update`, `uninstall`, or `lint`, including wrong mutation behavior, blocking conflicts, ownership drift, or first-run setup failure | The managed lifecycle itself is failing, blocking, or mutating unexpectedly | A workflow output problem after install completes correctly |
| `surface:runtime-mismatch` | Observed runtime behavior or lane wording conflicts with the compatibility matrix, runtime verification guidance, or runtime-specific docs | The user is challenging what PairSlash says a lane should do | A plain install failure that already matches the documented caveat |
| `surface:workflow` | A shipped workflow runs in the intended lane but behaves incorrectly, selects the wrong next step, or produces incorrect structure or guidance | The issue is in `pairslash-plan`, `pairslash-onboard-repo`, `pairslash-review`, or another pack surface | Install-path drift, doctor failures, or write-authority defects |
| `surface:memory` | A bug in the explicit Global Project Memory path or its read/write guardrails, including preview fidelity, explicit approval, duplicate/conflict handling, audit log, index update, or candidate reconciliation | `pairslash-memory-candidate` or `pairslash-memory-write-global` violated the trust boundary or its expected checks | A generic workflow bug with no authoritative memory effect |
| `surface:pack-discovery` | A request for a new pack, widened pack scope, or clearer pack fit for a real job | The user wants a new supported task-first workflow | A bug in an existing shipped pack |
| `surface:docs-nav-wording` | README, onboarding, compatibility, workflow, or support docs drift from shipped scope or runtime evidence | The docs, commands, or public claims are stale or overbroad | A real runtime bug that docs already describe accurately |

## Maintainer Classification Types

Maintainers apply one `type:*` label after first triage. The surface says where the issue lives. The type says what the issue actually is.

| Type label | Exact definition | Typical outcome |
| --- | --- | --- |
| `type:support` | The problem is local setup, lane caveat, missing prerequisite, or expected behavior under the documented lane | Help the user recover or clarify the documented limit |
| `type:bug` | PairSlash behavior is reproducibly wrong relative to shipped scope, documented lane behavior, or trust-boundary guarantees | Code fix, test, or deterministic repro work |
| `type:docs-drift` | Public or internal docs are the thing that is wrong or overclaiming | Docs patch or docs downgrade |
| `type:pack-request` | The ask is for new workflow coverage, new pack scope, or clearer pack fit | Productization or contributor follow-up |
| `type:evidence-gap` | The user is asking for support breadth or parity that the repo has not yet proven with live evidence | Keep claims narrow, collect evidence, or keep the lane downgraded |

## Required Reproduction Assets Per Surface

| Surface | Required at first contact | Ask next only if needed | Do not require initially |
| --- | --- | --- | --- |
| `surface:install-lifecycle` | Command, runtime, target, OS/shell, runtime version if known, doctor output, expected vs actual | Support bundle with doctor included when doctor is not decisive; preview/apply JSON when mutation behavior is in question; lint output for local pack-authoring or manifest work | Compat-lab repro, trace internals, edited manifest files |
| `surface:runtime-mismatch` | Exact claim or doc path, runtime, target, OS/shell, runtime version, doctor output, observed behavior | Support bundle or live runtime notes when the mismatch is about `/skills` or live install behavior | Compat-lab run from the reporter, full trace export, pack source diffs |
| `surface:workflow` | Workflow or pack id, task statement, expected vs actual, runtime lane, whether it ran through `/skills` | Doctor output if setup may be involved; support bundle or trace export when a local failure was captured | Compat-lab fixture selection, lint report, full repo archive |
| `surface:memory` | Preview/apply command, workflow id, expected vs actual, whether any authoritative memory path changed, runtime lane | Support bundle or trace export for hidden-write, audit, or apply failures; preview artifact or audit/index refs if available | Full manual diff of `.pairslash/project-memory/`, compat-lab reproduction from the reporter |
| `surface:pack-discovery` | Repo archetype, job to be done, desired outcome, runtime lane, why existing packs do not fit | Example repo, tool list, MCP needs, or existing commands | Support bundle, trace export, doctor, lint |
| `surface:docs-nav-wording` | Broken path, stale wording or command, and the repo truth path that should win | Screenshot or copied output if the wording is about CLI behavior | Support bundle, trace export, doctor, compat-lab |

## Artifact Ask Matrix

| Surface | Support bundle | Trace export | Doctor output | Lint output | Runtime version | Pack manifest info |
| --- | --- | --- | --- | --- | --- | --- |
| `surface:install-lifecycle` | Conditional | Conditional | Required | Conditional | Required when available | Conditional when a specific pack or local checkout is involved |
| `surface:runtime-mismatch` | Conditional | Conditional | Required | No | Required | No, unless the mismatch is a pack-specific runtime claim |
| `surface:workflow` | Conditional | Conditional | Conditional | No | Required when available | Pack id is required; manifest path is conditional |
| `surface:memory` | Conditional at intake, required before escalation to `type:bug` when the trust boundary is unclear | Conditional | Conditional | No | Required when available | Workflow or pack id required; manifest path conditional |
| `surface:pack-discovery` | No | No | No | No | Optional | No current manifest required; the request is for missing fit |
| `surface:docs-nav-wording` | No | No | No | No | Optional | No |

## Template Model For Phase 9

| Intake path | Template class | Decision |
| --- | --- | --- |
| Install bug | Markdown template | `.github/ISSUE_TEMPLATE/install-bug.md` is the default intake for lifecycle failures. |
| Runtime mismatch | Markdown template | `.github/ISSUE_TEMPLATE/runtime-mismatch.md` captures claim/evidence mismatch with lane details. |
| Workflow bug | Markdown template | `.github/ISSUE_TEMPLATE/workflow-bug.md` is the default intake for shipped workflow failures. |
| Memory bug | Markdown template | `.github/ISSUE_TEMPLATE/memory-bug.md` is the default intake for preview/apply/audit trust-boundary failures. |
| Artifact-heavy escalation | Markdown template | `.github/ISSUE_TEMPLATE/pairslash-support-bundle.md` remains the canonical path when reporters already captured debug/trace artifacts. |
| Pack requests | Form | `.github/ISSUE_TEMPLATE/pack-request.yml` captures structured workflow-gap requests without requiring bundles. |
| Docs drift | Form | `.github/ISSUE_TEMPLATE/docs-problem.yml` captures stale command/wording/path drift with source-of-truth references. |

If a future form is added for install, runtime, workflow, or memory issues, it should stay thin and redirect artifact-heavy reports to the support-bundle markdown path instead of duplicating generated fields.

## Mandatory Labels

Apply these labels after the first maintainer pass. Reporters should not be forced to guess them up front.

| Label family | Requirement | Examples |
| --- | --- | --- |
| `type:*` | Mandatory | `type:support`, `type:bug`, `type:docs-drift`, `type:pack-request`, `type:evidence-gap` |
| `surface:*` | Mandatory | `surface:install-lifecycle`, `surface:runtime-mismatch`, `surface:workflow`, `surface:memory`, `surface:pack-discovery`, `surface:docs-nav-wording` |
| `lane:*` | Mandatory | `lane:codex-macos-repo`, `lane:copilot-linux-user`, `lane:codex-windows-prep`, `lane:copilot-windows-prep`, `lane:docs-only`, `lane:unknown` |
| `severity:*` | Mandatory | `severity:s0`, `severity:s1`, `severity:s2`, `severity:s3` |
| `status:*` | Mandatory | `status:needs-info`, `status:triage`, `status:repro`, `status:waiting-docs`, `status:waiting-code`, `status:closed` |

Optional labels stay lightweight:

- `pack:<pack-id>` when a single pack owns the issue
- `source:live-runtime` or `source:compat-lab`
- `resolution:docs-downgrade`
- `resolution:known-issue`
- `resolution:evidence-gap`

# File/Path Plan

These paths own the Phase 9 issue model:

- GitHub issue chooser and template set: `.github/ISSUE_TEMPLATE/`
- Artifact-heavy support intake: `.github/ISSUE_TEMPLATE/pairslash-support-bundle.md`
- Local-first support artifact behavior: `docs/support/phase-7-support-ops.md`
- First-line troubleshooting and doctor interpretation: `docs/workflows/phase-4-doctor-troubleshooting.md`
- Public support wording boundary: `docs/compatibility/compatibility-matrix.md`
- Live runtime promotion boundary: `docs/compatibility/runtime-verification.md`
- Deterministic maintainer repro: `docs/troubleshooting/compat-lab-bug-repro.md`
- Shipped scope boundary: `docs/releases/phase-5-shipped-scope.md`
- Scoped release boundary: `docs/releases/scoped-release-verdict.md`
- Claim-scope boundary: `docs/releases/public-claim-policy.md`
- Product-validation boundary: `docs/validation/phase-3-5/verdict.md`
- Pack-specific truth: `packs/core/*/pack.manifest.yaml`

# Risks / Bugs / Drift

## When An Issue Is Actually An Evidence-Gap, Not A Code Bug

Classify the issue as `type:evidence-gap` when one or more of these are true:

- The requested lane is `prep`, `unverified`, or outside recorded live runtime evidence.
- The user is asking PairSlash to support a third runtime, prompt-mode direct invocation on Copilot, or Windows live install parity that the repo does not publicly claim today.
- The only evidence for promotion is compat-lab or fake-runtime automation, with no matching live `/skills` or live install evidence.
- The runtime version sits outside recorded pilot evidence and the behavior matches the current caveat.
- The issue is really asking for broader support wording, not reporting a broken shipped behavior.

## When Docs Must Be Downgraded Instead Of Code Being Changed

Classify the issue as `type:docs-drift` and prefer docs downgrade when:

- README or onboarding flattens `stable-tested`, `degraded`, `prep`, and `known-broken` into generic "supported."
- Docs imply Windows live install support when the lane is still `prep`.
- Docs imply Copilot prompt-mode direct invocation works when the compatibility matrix keeps it `known-broken`.
- Docs imply hidden memory behavior, autopilot behavior, or broad runtime parity that the shipped scope does not support.
- Docs present canary packs as if they are the bootstrap default.

## How Support Claims Stay Aligned With Reality

- Public support claims come from `docs/compatibility/compatibility-matrix.md`, not from a single issue, local success, or doctor pass.
- Live support promotion requires `docs/compatibility/runtime-verification.md` evidence. Compat-lab alone is not enough.
- `pairslash doctor` is intake and diagnosis. It does not widen public support claims by itself.
- `docs/releases/phase-5-shipped-scope.md`, `docs/releases/scoped-release-verdict.md`, `docs/releases/public-claim-policy.md`, and `docs/validation/phase-3-5/verdict.md` cap what maintainers may say publicly while triaging issues.
- Pack-specific support wording must stay aligned with `packs/core/*/pack.manifest.yaml`, especially release channels and runtime compatibility notes.

# Acceptance Checklist

- A newcomer can tell where to report install bugs, runtime mismatch, workflow bugs, memory bugs, pack requests, and docs drift.
- The taxonomy distinguishes `type:support`, `type:bug`, `type:docs-drift`, `type:pack-request`, and `type:evidence-gap`.
- The docs ask for `doctor`, `support-bundle`, `trace export`, `lint`, runtime version, and pack info only where those asks are realistic.
- Casual reporters are never required to run compat-lab before opening an issue.
- Public support labels stay separate from doctor lane and verdict labels.
- The taxonomy preserves the two-runtime scope, `/skills` front door, explicit-write-only memory, and no-silent-fallback boundaries.

# Next Handoff

- Keep `.github/ISSUE_TEMPLATE/pack-request.yml` and `.github/ISSUE_TEMPLATE/docs-problem.yml` aligned with this taxonomy.
- Keep `.github/ISSUE_TEMPLATE/config.yml` synchronized with any new intake path.
- Link this taxonomy from the public support entrypoint after the forms land.
- Keep this file aligned with future changes to compatibility, support-bundle artifact shape, and pack manifest release channels.
