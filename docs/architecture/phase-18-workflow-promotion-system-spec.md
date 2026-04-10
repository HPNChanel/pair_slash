# Phase 18 Workflow Promotion System Spec

This document is the source text for Phase 18 workflow-promotion design.
Downstream docs, schemas, registry fields, doctor/lint wording, and CI gates
must sync from this file rather than inventing a parallel taxonomy.
Reusable public and maintainer-facing wording blocks live in
`docs/architecture/phase-18-workflow-maturity-wording-system.md`.

This spec does not claim that any current PairSlash workflow already satisfies
any label below. It defines the policy and architecture needed to make those
claims truthfully later.

## 1. Intent

PairSlash needs a workflow-promotion system that is:

- workflow-first
- pack-aware
- evidence-bounded
- compatible with exactly two runtimes: Codex CLI and GitHub Copilot CLI
- anchored to `/skills` as the canonical front door
- strict enough that `stable` cannot be granted on narrative confidence

The system exists to answer one question cleanly:

> What is the highest public maturity label PairSlash can truthfully assign to
> this workflow on the lanes it is actually prepared to stand behind?

## 2. Scope

In scope:

- workflow maturity taxonomy
- evidence requirements per label
- promotion checklist structure
- demotion path structure
- allowed public wording
- compatibility-page labeling rules
- onboarding-page labeling rules
- treatment of memory-write workflows vs read-only workflows
- relationship between workflow maturity and live runtime evidence

Out of scope:

- adding a third runtime
- replacing `/skills` with another canonical entrypoint
- redefining runtime-lane support labels
- treating release channel as workflow maturity
- granting advanced packs implicit core trust

## 3. Core Model

### 3.1 Workflow-first, pack-aware

The unit of promotion is the workflow a user executes through `/skills`.

Packs matter because they hold implementation, manifests, evidence pointers,
and installable surfaces. They do not replace workflow semantics.

Rules:

- A workflow label is assigned to the workflow surface, not to a whole runtime.
- A workflow may be implemented by a pack, but a pack release channel is not a
  workflow maturity label.
- A runtime lane may be `preview` or `stable-tested` while a workflow on that
  lane is only `canary` or `beta`.
- A workflow may never claim a maturity level that outruns the weakest
  evidence-backed lane it uses for that claim.
- Advanced packs are evaluated separately. They do not inherit core workflow
  trust and they do not raise core workflow labels by association.

### 3.2 Relationship to runtime support

Runtime support answers: "Is this runtime/target/OS lane supported, and at what
support level?"

Workflow promotion answers: "How mature is this workflow on the exact lanes we
are prepared to recommend publicly?"

These are related but not interchangeable.

- Runtime-lane support is substrate truth.
- Workflow promotion is workflow truth.
- Product validation is business truth.
- Release verdict is release truth.

No surface may collapse those four layers into one label.

## 4. Invariants

The following invariants are mandatory:

1. PairSlash remains two-runtime only: Codex CLI and GitHub Copilot CLI.
2. `/skills` remains the canonical workflow-discovery and execution front door.
3. `stable` is impossible without fresh, repeated live evidence on the claimed
   workflow lanes.
4. Deterministic tests alone never justify broad support wording.
5. Advanced packs cannot silently inherit core maturity trust.
6. `deprecated` requires migration or replacement guidance.
7. Memory-write workflows require stricter evidence than read-only workflows.
8. A blocked or unsupported runtime lane caps the workflow label on that lane.
9. Compatibility docs must keep lane support labels separate from workflow
   labels.
10. Onboarding docs must not recommend a workflow above the evidence-backed
    lane and workflow ceiling.

## 5. Evidence Classes

PairSlash accepts the following evidence classes for workflow promotion:

| Evidence class | Meaning | What it is not enough for |
| --- | --- | --- |
| `implementation` | Code, manifests, registry entries, install surfaces, and deterministic outputs exist. | Any public maturity above `canary` |
| `deterministic` | Repeatable tests, contract coverage, fixture/golden checks, compat-lab gates, lint, and release gates pass. | Broad support claims or `stable` by itself |
| `live-workflow` | A real workflow was executed through `/skills` on an exact runtime/target/OS lane and the outcome was recorded. | Broad lane support by analogy |
| `live-lane` | Runtime-lane evidence recorded in compatibility/evidence assets for the exact lane. | Workflow maturity by itself |
| `operational-safety` | Evidence that preview, apply, audit, rollback, and conflict handling behave correctly when relevant. | Read-only claims are lighter; write flows need this |
| `migration` | Replacement guidance, sunset guidance, and compatibility/onboarding demotion guidance exist. | Any non-deprecated label if the workflow is being retired |

Evidence rules:

- `live-workflow` evidence must come from the canonical `/skills` path.
- `codex exec`, scripted probes, or one-off helper scripts may supplement
  evidence, but they cannot replace `/skills` proof.
- Evidence from one runtime never proves another runtime.
- Evidence from a core pack never proves an advanced pack.
- Evidence from an advanced pack never upgrades a core workflow.

## 6. Taxonomy

### 6.1 Label meanings

| Label | Meaning | Minimum evidence | Allowed public scope |
| --- | --- | --- | --- |
| `canary` | Early workflow, maintainer-guided, not yet broadly recommended. | `implementation` plus deterministic critical-path coverage | Exact workflow, exact caveats, no broad support language |
| `preview` | Publicly visible workflow with narrow, exact-lane claims. | `canary` plus deterministic coverage for claimed runtimes and at least one fresh `live-workflow` verification per claimed runtime | Exact lanes only |
| `beta` | Recommended for documented default lanes, but still caveated and actively watched. | `preview` plus repeated `live-workflow` evidence on default lanes and consistent doctor/lint/docs/catalog outputs | Documented default lanes only |
| `stable` | Default, broadly recommendable workflow for the documented supported lanes. | `beta` plus repeated fresh `live-workflow`, strong lane support, release readiness, and demotion readiness | Documented supported lanes only |
| `deprecated` | Workflow remains known but should not be chosen for new use. | `migration` evidence plus explicit replacement or retirement guidance | Only as a retirement/migration notice |

### 6.2 What each label does not mean

| Label | Does not mean |
| --- | --- |
| `canary` | Hidden, unsupported, or safe to market broadly |
| `preview` | Stable, broad support, or complete parity across both runtimes |
| `beta` | Stable, zero-risk, or suitable for every supported lane |
| `stable` | Universal support, third-runtime support, or product-validation exit |
| `deprecated` | Removed immediately, or safe to leave without guidance |

### 6.3 `deprecated` is terminal, not upward maturity

`deprecated` is a lifecycle state, not an upgrade beyond `stable`.

Once a workflow is marked `deprecated`:

- it is no longer recommended for new onboarding
- it must point to a replacement workflow or a retirement path
- compatibility and onboarding surfaces must stop presenting it as the default

## 7. Promotion Requirements

### 7.1 `canary`

Required:

- canonical workflow identity and pack ownership are explicit
- workflow is reachable through `/skills` when publicly exposed
- deterministic contract or smoke coverage exists for the core path
- no hidden-write behavior is required for success
- claimed lanes are not `blocked` or `unsupported`

Allowed wording:

- "canary workflow"
- "maintainer-guided canary"
- "available for narrow evaluation on the documented lane"

Forbidden wording:

- "recommended"
- "stable"
- "broadly supported"
- "production-ready"

### 7.2 `preview`

Required:

- all `canary` requirements
- deterministic coverage for every runtime being claimed
- at least one fresh canonical `/skills` verification per claimed runtime
- exact runtime/target/OS lanes are documented
- public wording names the caveat, not just the label

Additional memory-write requirements:

- explicit preview step is exercised and recorded
- intended write target is named
- audit or receipt evidence exists for the previewed action

Allowed wording:

- "preview on the documented lane"
- "available in preview for the documented default path"

Forbidden wording:

- "stable"
- "default everywhere"
- "broad support"

### 7.3 `beta`

Required:

- all `preview` requirements
- repeated `live-workflow` verification on the documented default lane for each
  claimed runtime
- doctor, lint, registry, and docs do not disagree about the workflow label
- no active blocker on any lane named in the public workflow claim
- failure handling and demotion owner are explicit

Additional memory-write requirements:

- repeated preview verification on each claimed runtime
- at least one audited apply path or controlled write verification per claimed
  runtime
- explicit conflict surfacing and operator review are documented

Allowed wording:

- "beta for the documented default lanes"
- "recommended with caveats on the documented lanes"

Forbidden wording:

- "stable"
- "fully supported across PairSlash"
- "proven everywhere we support"

### 7.4 `stable`

Required:

- all `beta` requirements
- repeated fresh `live-workflow` verification on every lane used to justify the
  `stable` claim
- every lane named in compatibility or onboarding pages for this stable claim
  has support truth strong enough to carry it
- deterministic gates are green on current branch
- release truth is not blocking the stable recommendation
- demotion path is defined and operationally practical

Additional memory-write requirements:

- repeated preview, apply, audit, and recovery evidence on every claimed
  default lane
- explicit proof that writes remain user-intentional and reviewable
- conflict handling, rollback guidance, and failure receipts are documented
- no hidden-write path or silent escalation remains in the stable path

Allowed wording:

- "stable on the documented lanes"
- "default recommended workflow for the documented lanes"

Forbidden wording:

- "stable everywhere"
- "stable across any terminal AI runtime"
- "stable because tests are green"
- "stable because maintainers feel confident"

### 7.5 `deprecated`

Required:

- the workflow is still identifiable in docs or code
- migration target, replacement workflow, or retirement path is documented
- onboarding surfaces stop recommending it
- compatibility surfaces stop presenting it as a preferred workflow
- removal or long-tail support boundary is stated

Allowed wording:

- "deprecated; use `<replacement>`"
- "deprecated and retained only for migration"

Forbidden wording:

- "deprecated" without replacement or retirement guidance
- "stable but deprecated" as a default onboarding recommendation

## 8. Stricter Rules for Memory-Write Workflows

Memory-write workflows carry a higher burden than read-only workflows because a
failure can change authoritative project state.

Rules:

- A read-only workflow may reach `preview`, `beta`, or `stable` without apply
  evidence.
- A memory-write workflow may not reach `preview` without preview evidence.
- A memory-write workflow may not reach `beta` without audited write-path
  evidence on each claimed runtime.
- A memory-write workflow may not reach `stable` without repeated preview,
  apply, audit, and recovery evidence on every claimed default lane.

Counter-rule:

- It is dishonest to grant the same workflow label to a write-authority
  workflow and a read-only workflow on the basis of identical evidence.

## 9. Promotion Checklist Structure

Every promotion proposal must be reviewable as one structured checklist with
the following fields:

1. Workflow identity
   - workflow id
   - owning pack id
   - core or advanced classification
   - read-only or memory-write classification
2. Claimed label
   - current label
   - requested label
   - exact runtime/target/OS lanes covered by the claim
3. Evidence bundle
   - deterministic evidence references
   - live-workflow evidence references
   - live-lane evidence references
   - operational-safety evidence references when applicable
4. Public wording
   - exact allowed sentence
   - exact forbidden shortcuts removed from docs/UI
5. Surface sync
   - manifest/registry sync
   - doctor/lint sync
   - compatibility/onboarding sync
6. Demotion readiness
   - demotion owner
   - demotion triggers
   - fallback label if new evidence fails
7. Deprecated-only field
   - replacement workflow or retirement path

Promotion is incomplete if any checklist field is unknown.

## 10. Demotion Path Structure

Every label must have a defined downgrade path.

Demotion record structure:

1. Trigger
   - stale evidence
   - fresh negative evidence
   - lane support downgrade
   - doc/UI mismatch
   - release gate failure
   - memory-write safety regression
2. Scope
   - exact workflow
   - exact lanes affected
   - whether the downgrade is global or lane-scoped
3. Immediate action
   - remove or lower workflow label
   - stop onboarding recommendation if needed
   - update compatibility wording if public claim changed
4. Replacement state
   - new label
   - explicit blocker text
   - migration guidance if `deprecated`
5. Re-promotion conditions
   - evidence that must be refreshed
   - docs and gates that must be resynced

Mandatory downgrade rules:

- If live evidence goes stale, the workflow falls to the highest still-proven
  label.
- If a claimed lane becomes `blocked`, the workflow cannot keep a public label
  that depends on that lane.
- If onboarding wording is stronger than compatibility and evidence allow, the
  onboarding wording must be demoted immediately.
- If a deprecated workflow has no migration guidance, the deprecation is
  invalid and the docs are out of policy.

## 11. Allowed Wording by Label

| Label | Allowed wording | Not allowed |
| --- | --- | --- |
| `canary` | "canary workflow", "maintainer-guided canary", "narrow evaluation" | "recommended default", "stable", "broad support" |
| `preview` | "preview on the documented lane", "preview workflow" | "stable", "proven", "general support" |
| `beta` | "beta for the documented default lanes", "recommended with caveats" | "fully supported", "stable everywhere" |
| `stable` | "stable on the documented lanes", "default recommended workflow" | "universal", "works on any runtime", "stable because tests are green" |
| `deprecated` | "deprecated; use `<replacement>`" | "deprecated" without guidance, or any new-user recommendation |

Rule:

- Public wording must name the lane scope when the evidence is lane-bound.

## 12. Compatibility-Page Labeling Rules

The compatibility page is runtime-lane truth first.

Rules:

- Lane support labels stay in the lane support column or lane support section.
- Workflow labels, if shown, must be in a separate workflow-specific field,
  badge, note, or row.
- A lane support label must never be rewritten as a workflow label.
- A workflow label must never be used as shorthand for lane support.
- `stable` workflow wording is forbidden on a lane that is still only `prep`,
  `blocked`, or `unsupported`.
- `preview` workflow wording may appear only for exact lanes with matching
  live-workflow evidence.
- `deprecated` must include replacement guidance or a retirement note.

Examples:

- Allowed: "Codex CLI repo macOS lane: degraded. Workflow `X`: canary."
- Allowed: "Copilot CLI user Linux lane: preview. Workflow `Y`: beta."
- Not allowed: "Codex CLI repo macOS: stable" when only one workflow is stable.

## 13. Onboarding-Page Labeling Rules

The onboarding page is recommendation truth, not raw evidence inventory.

Rules:

- Only workflows at `preview`, `beta`, or `stable` may appear as onboarding
  candidates for new users.
- `canary` is never the default onboarding recommendation.
- `beta` may be recommended only with explicit lane scope and caveat wording.
- `stable` may be recommended as the default only on the documented lanes it
  has actually earned.
- `deprecated` must not appear as the default onboarding path.
- Memory-write workflows require stronger caution text than read-only workflows
  at the same label.

Examples:

- Allowed: "Start with workflow `X` in preview on Codex repo macOS."
- Allowed: "Workflow `Y` is beta for the documented default lanes; review the
  compatibility notes first."
- Not allowed: "Start here with workflow `Z`" if `Z` is only `canary`.
- Not allowed: "Use deprecated workflow `Q`" without a migration reason.

## 14. Relationship to Live Runtime Evidence and Current Lane Support

Workflow promotion depends on both workflow evidence and lane support truth.

Minimum interaction rules:

- `canary` requires non-blocked lane viability, but not broad lane support.
- `preview` requires fresh live-workflow evidence on each claimed runtime.
- `beta` requires repeated live-workflow evidence on default lanes and no
  contradictory lane blocker for the same public claim.
- `stable` requires repeated live-workflow evidence plus lane support strong
  enough for the documented stable recommendation.
- `deprecated` may remain visible even when support is narrower, but it must
  steer users away from new adoption.

Important separation:

- A lane may be `stable-tested` while a workflow on it is only `preview`.
- A workflow may be `beta` while the broader lane support is still narrower
  than full `stable`.
- Stable workflow claims must never outrun current lane support truth.

## 15. Examples

### Example A: Truthful `canary`

A read-only workflow exists in a core pack, appears in `/skills`, passes
deterministic tests on both runtimes, but has only one maintainer-run smoke on
Codex repo macOS and no complete live verification on Copilot. The truthful
label is `canary`.

### Example B: Truthful `preview`

A read-only workflow has deterministic coverage on both runtimes and one fresh
canonical `/skills` verification on Codex repo macOS and Copilot user Linux.
Docs name the exact lanes and caveats. The truthful label can be `preview`.

### Example C: Truthful `beta`

A workflow has repeated live-workflow verifications on the default Codex and
Copilot lanes, doctor and lint surfaces agree, and caveats remain explicit. It
can be `beta` even if broader lane support is not yet strong enough for a full
`stable` story.

### Example D: Truthful `stable`

A read-only workflow has repeated fresh `/skills` verifications on every lane
named in compatibility and onboarding docs, release truth is not blocking, and
demotion mechanics are defined. It may be labeled `stable` on those exact
documented lanes.

### Example E: Truthful `deprecated`

A workflow is being retired in favor of a replacement. Docs say "deprecated;
use `<replacement>`", onboarding no longer recommends it, and a migration path
exists. The truthful label is `deprecated`.

### Example F: Memory-write `beta`

A memory-write workflow has repeated preview evidence and at least one audited
apply path per claimed runtime, but recovery evidence is still narrow. The
truthful label may be `beta`, not `stable`.

## 16. Counterexamples

### Counterexample A: Deterministic-only `stable`

All tests are green, but there is no fresh `/skills` evidence on the claimed
lanes. Calling the workflow `stable` is false.

### Counterexample B: Lane-label laundering

The compatibility page says a lane is `preview`, and onboarding restates that
as "the workflow is stable". That is a category error and therefore dishonest.

### Counterexample C: Advanced-pack inheritance

An advanced delegation pack has excellent maintainer coverage, so a core
workflow is labeled `beta` by association. That is not allowed.

### Counterexample D: Deprecated without guidance

A workflow is marked `deprecated`, but no replacement or retirement path is
named. That is an invalid deprecation state.

### Counterexample E: Memory-write bar set too low

A memory-write workflow gets `preview` or `beta` without any preview receipt or
audited write evidence. That is unsafe and dishonest.

## 17. How This Can Fail Dishonestly

Common dishonest failure modes:

1. Treating deterministic test success as broad support proof.
2. Reusing runtime-lane labels as workflow labels.
3. Claiming cross-runtime maturity from one runtime's evidence.
4. Using advanced-pack success to inflate core workflow maturity.
5. Calling a workflow `stable` while release truth, compatibility truth, or
   onboarding truth still says otherwise.
6. Leaving a deprecated workflow in default onboarding because it still works.
7. Giving memory-write workflows the same evidence bar as read-only workflows.
8. Using maintainer confidence, anecdotal success, or silence about failures as
   a substitute for recorded live evidence.
9. Naming a workflow `stable` on pages where the exact lane scope is omitted.
10. Forgetting to demote when a lane becomes blocked, stale, or caveated.

Anti-dishonesty rule:

- If the safest honest sentence is narrower than the current label, the label
  must drop.

## 18. Implementation Consequences

Any later implementation derived from this spec must preserve these properties:

- workflow label storage is explicit and reviewable
- effective public label can be lower than assigned label
- doctor, lint, compatibility docs, onboarding docs, and registry all consume
  the same resolved workflow truth
- advanced lanes remain quarantined from core promotion semantics
- memory-write workflows have stricter evidence thresholds encoded in policy and
  tests

This spec is successful only if future code makes dishonest promotion harder
than honest demotion.
