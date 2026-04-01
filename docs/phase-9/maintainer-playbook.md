---
title: Maintainer Playbook
phase: 9
status: active-draft
owner_file: docs/phase-9/maintainer-playbook.md
baseline_source: docs/phase-9/phase-9-baseline-reality-lock.md
---

# Reality Scan

Maintainer scaling in Phase 9 has to sit on top of the support and evidence surfaces that already exist in the repo:

- `pairslash doctor` is the first machine-readable diagnosis surface for runtime detection, lane maturity, install blocking state, and first workflow guidance.
- `pairslash debug --bundle` and `pairslash trace export --support-bundle --include-doctor` are the only shipped paths that package local evidence, share-safety metadata, and bundled triage templates.
- `docs/support/phase-7-support-ops.md` already defines local-first support, privacy boundaries, and redaction rules.
- `docs/troubleshooting/compat-lab-bug-repro.md` already makes compat-lab a post-intake deterministic repro path.
- `docs/compatibility/compatibility-matrix.md`, `docs/compatibility/runtime-verification.md`, `docs/releases/phase-5-shipped-scope.md`, and `docs/validation/phase-3-5/verdict.md` already cap what PairSlash can claim publicly.
- Pack release channels and compatibility notes already live in `packs/core/*/pack.manifest.yaml`, so triage cannot treat all packs as equally mature.

## Triage Truth Stack

| Layer | Owner | What it answers |
| --- | --- | --- |
| Public support claim | `docs/compatibility/compatibility-matrix.md` | What PairSlash may say publicly about a runtime lane |
| Shipped scope | `docs/releases/phase-5-shipped-scope.md` and `docs/validation/phase-3-5/verdict.md` | What behavior is actually in scope today |
| Local evidence | `doctor-report`, `debug-report`, `trace-export`, `support-bundle` | What happened on the reporter's machine |
| Deterministic repro | compat-lab fixtures, goldens, acceptance, and evals | Whether maintainers can reproduce or guard the issue in automation |

# Decisions

## Severity Model

Severity is about trust and default-path impact, not raw code complexity.

| Severity | Definition | Typical examples | Default owner |
| --- | --- | --- | --- |
| `severity:s0` | Trust-boundary break or unsafe artifact handling | Hidden authoritative write, mutation without preview or approval, uninstall removing unmanaged files, redaction/share-safety regression | Maintainer only |
| `severity:s1` | Documented default-path blocker on a claimed lane | Bootstrap install blocked on a claimed lane, `/skills` first workflow blocked, doctor missing a blocking setup defect | Maintainer primary |
| `severity:s2` | Recoverable defect, degraded lane issue, or secondary workflow problem | Workaround exists, canary pack regression, lane caveat missing from docs, deterministic repro exists but scope is narrower | Maintainer or contributor with review |
| `severity:s3` | Low-impact docs, request, or evidence follow-up | Docs drift, pack request, claim clarification, example gap | Contributor-friendly after triage |

## Required Reproducibility Assets Per Issue Type

| Surface | Maintainer must see before labeling `type:bug` | Acceptable first report from a casual user | Maintainer-only follow-up if needed |
| --- | --- | --- | --- |
| `surface:install-lifecycle` | Exact command, lane, doctor output, and either preview/apply output or a decisive support bundle | Command plus doctor output and expected vs actual | Compat-lab fixture repro, install-state diff, lint for pack-authoring cases |
| `surface:runtime-mismatch` | Exact public claim or doc path, runtime version, lane, doctor output, and observed behavior | Claim link or quote plus doctor output | Live runtime verification notes or compat-lab comparison |
| `surface:workflow` | Workflow id, task statement, runtime lane, expected vs actual, and either live repro or trace evidence | Workflow id, task statement, expected vs actual | Compat-lab eval or fixture coverage if the workflow should be deterministic |
| `surface:memory` | Preview/apply behavior plus trace or bundle evidence when the trust boundary is unclear | Command, expected vs actual, and whether authoritative memory changed | Audit/index diff, memory-engine repro, policy/contract inspection |
| `surface:pack-discovery` | No reproducibility requirement; maintainers need problem shape and fit | Job to be done, runtime lane, repo archetype | Pack design review, wedge fit check, release-channel decision |
| `surface:docs-nav-wording` | Broken path or wording plus the source of truth path | Broken path or wording | Docs patch and wording downgrade review |

## Maintainer Triage Flow

1. Confirm the intake path.
   If the issue already includes a support bundle, use that as the primary artifact.
   If it does not, start from the smallest artifact that exists instead of asking for everything at once.

2. Validate share safety first.
   If `safe_to_share = no` or `redaction_state = review-required`, do not ask the reporter to paste the bundle publicly.
   Switch to sanitized summaries or local-only guidance before proceeding.

3. Normalize the lane and scope.
   Record runtime, target, OS, shell, and runtime version.
   Compare the report against the public compatibility matrix and the doctor lane at the same time.

4. Apply mandatory labels.
   Add exactly one `surface:*`, one `type:*`, one `lane:*`, one `severity:*`, and one `status:*`.
   Add `pack:<pack-id>` when a single pack clearly owns the issue.

5. Decide whether this is support, bug, docs drift, pack request, or evidence gap.
   Use `type:support` for local recovery and documented caveats.
   Use `type:bug` only when behavior is wrong relative to shipped scope or trust guarantees.
   Use `type:docs-drift` when the docs are the thing that is wrong.
   Use `type:evidence-gap` when the ask exceeds proven support.

6. Request the smallest missing artifact.
   Ask for doctor output before a support bundle.
   Ask for a support bundle before compat-lab.
   Ask for lint only when the report involves pack authoring, manifest drift, contract/policy drift, or contributor checkout changes.

7. Choose the reproduction path.
   Use live-runtime repro when the claim is about `/skills`, live install, or interactive runtime behavior.
   Use compat-lab when the issue is lifecycle, deterministic pack behavior, or reproducible fixture drift.
   Use docs-only review when the problem is wording, stale commands, or claim breadth.

8. Close with a concrete resolution label and next action.
   Pick one: code fix, docs downgrade, evidence-gap hold, known issue, pack triage, or not reproducible.
   Record that decision in the issue and in the support-bundle templates if present.

## Labeling Rules For Support Vs Bug Vs Docs Drift Vs Evidence Gap

| If the issue is... | Label it as... | Route |
| --- | --- | --- |
| Local setup, missing prerequisite, expected degraded lane, or known caveat | `type:support` | Recovery guidance or prerequisite fix |
| Reproducible PairSlash defect relative to shipped scope | `type:bug` | Code fix, test, and deterministic coverage |
| README, onboarding, compatibility, or workflow docs overclaiming or drifting | `type:docs-drift` | Docs patch or claim downgrade |
| Missing live evidence, unsupported desired lane, or parity ask beyond repo proof | `type:evidence-gap` | Keep claim narrow and collect evidence before widening |
| Request for a new task surface or pack fit | `type:pack-request` | Productization or contributor intake |

## Contributor Fit And Routing

Contributors should be able to help without being pulled into trust-boundary or support-claim ownership by accident.

| Safe contributor lane after triage | Why it is contributor-friendly | Maintainer review needed |
| --- | --- | --- |
| `type:docs-drift` and `severity:s3` | Low blast radius and easy diff review | Yes |
| Compat-lab fixture additions or repro coverage for a confirmed deterministic bug | Helps maintainers lock regression coverage | Yes |
| Pack-request discovery notes, example repos, and docs clarifications | Useful productization support without widening claims by accident | Yes |
| Canary workflow polish that does not change support claims | Lower-risk than lifecycle or memory-core changes | Yes |

These lanes stay maintainer-only:

- `severity:s0`
- Any redaction, share-safety, or support-bundle regression
- Installer ownership, uninstall safety, or managed mutation semantics
- `pairslash-memory-write-global` trust-boundary defects
- Public support-claim promotion or downgrade decisions

# File/Path Plan

These files and paths are the canonical homes maintainers should use during triage:

- Public support claim truth: `docs/compatibility/compatibility-matrix.md`
- Live runtime evidence promotion: `docs/compatibility/runtime-verification.md`
- Shipped scope boundary: `docs/releases/phase-5-shipped-scope.md`
- Release-facing claim cap: `docs/validation/phase-3-5/verdict.md`
- Support bundle behavior and privacy policy: `docs/support/phase-7-support-ops.md`
- Deterministic repro playbook: `docs/troubleshooting/compat-lab-bug-repro.md`
- Bootstrap support flow: `docs/workflows/install-guide.md` and `docs/workflows/phase-4-doctor-troubleshooting.md`
- Issue template chooser and lane templates: `.github/ISSUE_TEMPLATE/`
- Artifact-heavy intake template: `.github/ISSUE_TEMPLATE/pairslash-support-bundle.md`
- Pack maturity and runtime metadata: `packs/core/*/pack.manifest.yaml`
- Tooling behavior behind the docs: `packages/tools/doctor/`, `packages/tools/trace/`, `packages/tools/compat-lab/`, `packages/tools/lint-bridge/`, `packages/core/memory-engine/`

# Risks / Bugs / Drift

## When An Issue Is Actually An Evidence-Gap, Not A Code Bug

Use `type:evidence-gap` when:

- The lane is `prep` or lacks recorded live evidence, and the report is really asking for support promotion.
- The runtime version falls outside recorded pilot evidence and the failure matches that unsupported or unrecorded state.
- The ask depends on a surface PairSlash does not currently claim, such as Windows live install parity, Copilot prompt-mode direct invocation, or a third runtime.
- Compat-lab is green, but there is still no live `/skills` or live install proof for the public claim the reporter wants.
- The issue is "please say this is supported" rather than "this shipped behavior is broken."

## When Docs Must Be Downgraded Instead Of Code Being Changed

Prefer `type:docs-drift` and `resolution:docs-downgrade` when:

- Docs flatten `stable-tested`, `degraded`, `prep`, and `known-broken` into plain "supported."
- Docs imply hidden memory behavior, background writes, or autopilot behavior that the shipped scope forbids.
- Docs imply Windows or Copilot parity beyond the compatibility matrix.
- Docs present canary or preview packs as if they are the stable bootstrap default.
- Docs widen support language without matching updates to runtime verification and compatibility artifacts.

## How Support Claims Stay Aligned With Reality

1. The compatibility matrix owns public support wording.
2. Runtime verification owns live lane promotion and live downgrade evidence.
3. Doctor owns machine-local diagnosis only. It is not a public support promotion mechanism.
4. Compat-lab owns deterministic reproduction and regression control. It is not public proof of support breadth by itself.
5. Shipped scope and the validation verdict cap what maintainers may promise while triaging.
6. Pack manifest release channels and runtime metadata limit how strongly maintainers may describe a pack in public responses.

## Maintainer Overload Traps

- Requiring compat-lab from reporters before first triage.
- Asking for support bundles when doctor output already answers the question.
- Treating a single successful local run as enough to widen public support claims.
- Routing docs overclaim as code work instead of downgrading the docs.
- Letting contributors take `severity:s0` or public support-promotion work without maintainer ownership.

# Acceptance Checklist

- A maintainer can classify any incoming issue as support, bug, docs drift, pack request, or evidence gap.
- Severity reflects trust and default-path impact, not raw implementation complexity.
- The playbook asks for only the smallest next artifact needed.
- Compat-lab stays a maintainer repro step, not a user intake burden.
- Public support claims remain tied to the compatibility matrix and runtime verification.
- Contributor-friendly work is separated from maintainer-only trust-boundary work.

# Next Handoff

- Keep GitHub forms for `pack request` and `docs drift` aligned with taxonomy and label policy.
- Add a sanitized support-bundle walkthrough under the future support-evidence docs so maintainers can point reporters at a concrete example.
- Split finalized maintainer content into a canonical `docs/maintainers/` home when the broader Phase 9 doc move happens.
- Keep this playbook synchronized with any future changes to doctor schema, trace bundle schema, or compatibility-lane policy.
