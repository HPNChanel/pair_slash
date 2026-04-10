---
title: Start Here Onboarding Path
phase: 9
status: active-public-surface
truth_source: docs/phase-12/authoritative-program-charter.md
---

# Start Here Onboarding Path

PairSlash is currently at Phase 3.5 business validation on top of a technically
shipped Phase 4 installability substrate with additional Phase 5/6 hardening in
the repo. Source of truth:
[authoritative-program-charter.md](../phase-12/authoritative-program-charter.md).

This page covers the public first-run path only.
It does not widen runtime support beyond the compatibility matrix or imply
package-manager publication; package-manager publication is not claimed today.

## Runtime scope

PairSlash supports exactly two runtimes:

- Codex CLI
- GitHub Copilot CLI

`/skills` is the canonical front door on both runtimes.

## First 90 seconds

```bash
npm install
npm run pairslash -- doctor --runtime codex --target repo
npm run pairslash -- preview install pairslash-plan --runtime codex --target repo
npm run pairslash -- install pairslash-plan --runtime codex --target repo --apply --yes
```

For Copilot:

```bash
npm run pairslash -- doctor --runtime copilot --target user
npm run pairslash -- preview install pairslash-plan --runtime copilot --target user
npm run pairslash -- install pairslash-plan --runtime copilot --target user --apply --yes
```

Keep the current lane label explicit.
Public support remains lane-specific; use the
[compatibility matrix](../compatibility/compatibility-matrix.md) and
[live runtime evidence](../evidence/live-runtime/README.md) before widening any
support wording.
Expect the current lane label to stay exact, including `publicly supported`,
`degraded`, and `prep`.
Workflow label wording must follow the
[Phase 18 wording system](../architecture/phase-18-workflow-maturity-wording-system.md).

## Workflow labels

- `canary`: current example path or maintainer-guided path only; not a default recommendation
- `preview`: available for the documented lane with explicit caveats
- `beta`: recommended with caveats on documented default lanes
- `stable`: default recommended workflow on documented lanes
- `deprecated`: do not start here; use the replacement guidance

Use `recommended` only when workflow maturity and lane support both justify it.
If a `canary` workflow appears on this page, treat it as the current example
path, not as a broad default recommendation.

## Current example first workflow

1. Start the runtime from repo root.
2. Run `/skills`.
3. Select `pairslash-plan`.
4. Ask: `Create a repo plan from the current repo state.`

After first success, `pairslash-onboard-repo` remains the next repo re-entry
workflow, and it should still be described conservatively when its release
channel is narrower than `pairslash-plan`.

This is the current example path because it is the clearest repo-entry flow in
the shipped product surface today.
It is not a blanket recommendation beyond the documented lanes, workflow label,
and compatibility boundary.

## If it fails

Use the [doctor troubleshooting guide](../workflows/phase-4-doctor-troubleshooting.md)
first, then follow the [reporting guide](../reporting.md).

## Boundaries

- Legal/package boundary: [legal-packaging-status.md](../releases/legal-packaging-status.md)
- Product-validation verdict: [verdict.md](../validation/phase-3-5/verdict.md)
- Public claim policy: [public-claim-policy.md](../releases/public-claim-policy.md)
