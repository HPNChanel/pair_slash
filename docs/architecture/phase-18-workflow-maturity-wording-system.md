# Phase 18 Workflow Maturity Wording System

This document is the canonical source for public and maintainer-facing wording
about workflow maturity in PairSlash.

Downstream docs may reuse or trim these blocks.
They must not invent stronger wording than this file allows.

## 1. Usage Rules

- Keep `implemented`, `verified`, `supported`, and `recommended` separate.
- Treat workflow maturity as workflow truth, not runtime-lane truth.
- Treat runtime support labels as lane truth, not workflow truth.
- Treat release-channel labels as packaging/release truth, not workflow truth.
- Keep `/skills` as the canonical workflow front door in wording that depends
  on live evidence.
- If evidence is weaker than the sentence, narrow the sentence.

## 2. Core Terminology Block

Use this block when a doc needs the base distinction before any label appears.

```md
- `implemented`: the workflow exists in code, manifests, and generated assets.
- `verified`: the workflow has deterministic evidence and, when stated, live
  workflow evidence for the exact documented lane.
- `supported`: the runtime lane is supported at the level shown in the
  compatibility matrix.
- `recommended`: PairSlash is prepared to tell users to choose that workflow on
  the documented lanes.
```

Do not collapse those terms into one sentence.

## 3. Workflow Maturity Legend

Use this legend in public docs when workflow labels are visible.

```md
| Label | Meaning | Recommendation status |
| --- | --- | --- |
| `canary` | Early workflow with narrow deterministic confidence and explicit caveats. | Not a default recommendation. |
| `preview` | Workflow with exact-lane live verification and limited public recommendation. | Recommended only on the documented lanes. |
| `beta` | Workflow with repeated live verification on documented default lanes and active caveats. | Recommended with caveats. |
| `stable` | Workflow with repeated live verification and strong lane support on documented lanes. | Default recommended workflow on documented lanes only. |
| `deprecated` | Workflow retained only for migration or retirement. | Not recommended for new use. |
```

## 4. Per-Label Wording Rules

### `canary`

Approved wording:

```md
- "canary workflow"
- "maintainer-guided canary"
- "available for narrow evaluation on the documented lane"
- "implemented and deterministically covered, but not yet broadly recommended"
```

Forbidden wording:

```md
- "recommended default"
- "stable"
- "broadly supported"
- "production-ready"
```

Maintainer guidance:

```md
Allowed only when the workflow exists, is reachable through `/skills`, and has
deterministic core-path coverage. Do not assign `canary` if the workflow is
still hidden, undocumented, or dependent on a blocked lane.
```

### `preview`

Approved wording:

```md
- "preview on the documented lanes"
- "available in preview on the documented default path"
- "live-workflow verified on the documented lane"
```

Forbidden wording:

```md
- "stable"
- "default everywhere"
- "broad support"
- "recommended across both runtimes"
```

Maintainer guidance:

```md
Allowed only when each claimed runtime has at least one fresh `/skills` live
workflow verification and the doc names the exact lane scope. Do not assign
`preview` when the wording omits caveats or lane scope.
```

### `beta`

Approved wording:

```md
- "beta on the documented default lanes"
- "recommended with caveats on the documented lanes"
- "repeatedly live-verified on documented default lanes"
```

Forbidden wording:

```md
- "stable"
- "fully supported across PairSlash"
- "proven everywhere we support"
```

Maintainer guidance:

```md
Allowed only when repeated live workflow evidence exists on the documented
default lanes and doctor, lint, catalog, and docs agree. Do not assign `beta`
if any named lane is blocked, stale, or described more strongly in docs than
in evidence.
```

### `stable`

Approved wording:

```md
- "stable on the documented lanes"
- "default recommended workflow on the documented lanes"
- "repeatedly live-verified on the documented supported lanes"
```

Forbidden wording:

```md
- "stable everywhere"
- "works on any terminal AI runtime"
- "stable because tests are green"
- "stable because maintainers are confident"
```

Maintainer guidance:

```md
Allowed only when repeated fresh `/skills` live workflow evidence exists on
every lane used in stable wording, the runtime lanes are strong enough to carry
the claim, and release truth is not blocking. Do not assign `stable` on
narrative confidence or deterministic evidence alone.
```

### `deprecated`

Approved wording:

```md
- "deprecated; use `<replacement>`"
- "deprecated and retained only for migration"
- "deprecated; do not choose for new onboarding"
```

Forbidden wording:

```md
- "deprecated" without migration guidance
- "stable but deprecated" as a new-user recommendation
- "recommended for compatibility" without a replacement note
```

Maintainer guidance:

```md
Allowed only when replacement or retirement guidance is present in the same
surface. Do not assign `deprecated` if compatibility or onboarding still
presents the workflow as a default.
```

## 5. Onboarding Labels And Legend

Use this block in onboarding docs when label legend text is needed.

```md
### Workflow label legend

- `canary`: current example path or maintainer-guided path only; not a default recommendation
- `preview`: available for the documented lane with explicit caveats
- `beta`: recommended with caveats on documented default lanes
- `stable`: default recommended workflow on documented lanes
- `deprecated`: do not start here; follow the replacement guidance
```

Onboarding wording rules:

```md
- Use `recommended` only for workflows whose maturity and lane support both
  justify recommendation.
- If a `canary` workflow appears in onboarding, describe it as the current
  example path or maintainer-guided path, not as the default recommendation.
- Keep lane scope visible next to `preview`, `beta`, or `stable`.
- Do not present `deprecated` as a starting path.
```

Approved onboarding examples:

```md
- "Current example first workflow: `pairslash-plan`"
- "Recommended with caveats on documented default lanes"
- "Stable on documented lanes"
```

Forbidden onboarding examples:

```md
- "Start here by default" for a `canary`
- "Recommended everywhere"
- "Use this deprecated workflow first"
```

## 6. Compatibility-Page Label Conventions

Use this block on compatibility pages or support matrices.

```md
- Keep runtime-lane support labels and workflow-maturity labels in separate
  fields, badges, notes, or rows.
- Use lane wording such as `prep`, `degraded`, `preview`, `stable-tested`, or
  `blocked` only for runtime lanes.
- Use workflow wording such as `canary`, `preview`, `beta`, `stable`, or
  `deprecated` only for workflows.
- Do not rewrite a lane label as a workflow label.
- Do not use workflow labels as shorthand for lane support.
```

Approved compatibility examples:

```md
- "Codex CLI repo macOS lane: degraded. Workflow `pairslash-plan`: canary."
- "Copilot CLI user Linux lane: prep. Workflow `pairslash-memory-write-global`: canary."
```

Forbidden compatibility examples:

```md
- "Codex CLI repo macOS: stable" when that is really a lane statement
- "Copilot Linux preview means the workflow is beta"
```

## 7. Support Wording Conventions

Use this block in support docs, issue triage, and release notes.

```md
- Use `supported` only for runtime-lane support claims.
- Use `verified` only when the evidence class is named or obvious from context.
- Use `recommended` only for workflow-choice claims.
- When evidence is lane-bound, say "on the documented lane" or "on documented
  lanes".
```

Approved support wording:

```md
- "supported on the documented lane"
- "live-workflow verified on the documented lane"
- "recommended with caveats on the documented default lanes"
```

Forbidden support wording:

```md
- "supported everywhere"
- "verified across all runtimes" from one runtime's evidence
- "recommended" without lane scope when the claim is lane-bound
```

## 8. Demotion Wording Conventions

Use these sentence patterns when a workflow label must be narrowed.

```md
### Workflow maturity changed

- Previous label: `<old>`
- New label: `<new>`
- Reason: `<trigger>`
- Scope: `<workflow and lanes>`
- Next truthful wording: `<replacement sentence>`
```

Approved demotion sentences:

```md
- "Workflow maturity for `pairslash-plan` is now `canary` because repeated live
  workflow evidence is not recorded on the documented lanes."
- "Workflow maturity for `pairslash-memory-write-global` remains below `stable`
  because write-safety evidence is still narrower than the claimed lanes."
- "Workflow `X` is deprecated; use `Y`."
```

Forbidden demotion sentences:

```md
- "Temporarily less confident"
- "Still basically stable"
- "No change to recommendation" when the label changed downward
```

## 9. Memory-Write Vs Read-Only Wording

Use this block whenever write-authority workflows are named beside read-only
workflows.

```md
- Read-only workflows may be described as analysis-only, non-mutating, or
  read-oriented when that is true.
- Memory-write workflows must keep preview, approval, audit, and explicit write
  boundaries visible in the same surface.
- Do not use the same recommendation sentence for a write-authority workflow
  and a read-only workflow unless the stricter write-safety evidence exists.
```

Approved memory-write wording:

```md
- "write-authority workflow with preview-first apply"
- "requires explicit confirmation before any authoritative write"
- "recommended only on documented lanes with matching write-safety evidence"
```

Forbidden memory-write wording:

```md
- "works like the read-only flow"
- "automatic memory update"
- "safe by default everywhere"
```

## 10. Advanced-Lane Quarantine Wording

Use this block anywhere advanced packs or advanced lanes appear near core
workflows.

```md
- Mark advanced workflows or advanced lanes explicitly as `advanced`.
- Do not describe advanced workflows as core defaults.
- Do not let advanced success imply core `beta` or `stable`.
- Do not place advanced workflows beside core workflows under a shared
  recommendation badge without an explicit boundary note.
```

Approved advanced wording:

```md
- "advanced lane; not part of the core default workflow set"
- "advanced workflow with separate maturity and support evaluation"
```

Forbidden advanced wording:

```md
- "core-stable by extension"
- "same maturity as the core path"
- "recommended default" without a core/advanced boundary
```

## 11. Current-State PairSlash Caveat Block

Use this block in README, onboarding, or release-facing summaries when a short
current-state caveat is needed.

```md
> PairSlash keeps workflow maturity narrower than implementation and narrower
> than raw deterministic coverage. Current runtime support remains lane-specific
> and workflow wording must stay inside the documented evidence, compatibility
> matrix, and release truth. If a workflow is shown as the current example path,
> that does not by itself make it the broadly recommended default.
```

## 12. Release Notes Block

Use this block in release notes when workflow maturity is mentioned.

```md
Workflow maturity wording in this release stays evidence-bounded:

- `implemented` means shipped in code and manifests
- `verified` means deterministically covered and, where stated, live-workflow verified
- `supported` means runtime-lane support on the documented lanes
- `recommended` means PairSlash is prepared to direct users to that workflow on
  the documented lanes

Do not read release-channel or runtime-lane wording as a workflow promotion by
itself.
```
