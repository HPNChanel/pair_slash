# ADR 0003: Marketplace Distribution Strategy

Status: Accepted (decision: staged — repo-local now, upstream/gh-publish gated on evidence)
Date: 2026-09-28
Track: T3-05

## Context

PairSlash now has emission-side capability for all major plugin
distribution surfaces:

- Copilot plugin bundles (`compileCopilotPack` `emitMode: "plugin"`, T3-02).
- Codex plugin bundles + marketplace manifest emission
  (`buildCodexMarketplaceManifest`, T3-03).
- `gh skill publish --dry-run` readiness: all 11 core packs validate clean
  against the real distribution tool (T3-04).

The open question is *strategy*, not capability: does PairSlash operate its
own marketplace, contribute packs to existing marketplaces
(`awesome-copilot`, OpenAI-curated collections), distribute only via
`gh skill` + GitHub releases, or stay repo-local?

Decision constraints:

- **Claim ladder (C.6)**: no public distribution claims may outrun evidence.
  There are no live-verified end-to-end distribution lanes yet — T6 must
  clear release unblock first.
- **Trust policy**: `external-trusted: ask`, `external-unverified: deny`.
  Joining a third-party marketplace makes the *curator* a new trust actor
  whose policies are not PairSlash-controlled.
- **Charter**: repo-local install must remain the documented primary path
  regardless (`/skills` canonical, CLAUDE.md §4.2).
- The July roadmap posture applies: `stage-toward-publish` — capability
  now, activation gated.

## Options considered

### A. Operate a PairSlash marketplace repo

A repo holding `marketplace.json` + plugin dirs; consumers run
`codex plugin marketplace add <owner/repo>` / Copilot equivalent.

| Axis | Assessment |
|---|---|
| Charter fit | Neutral — a marketplace is still slash-first consumed |
| Trust policy | OK (self-published, no new trust actor) |
| Maintenance | High — versioning, signing, deprecation, index hygiene |
| Claim ladder | Blocked today: implies stable distribution channel |

Verdict: **deferred** — justified only once packs are actually released and
consumers exist. T3-03 already emits the manifest shape, so activation is
mechanical when warranted.

### B. Contribute to upstream marketplaces (e.g. `awesome-copilot`)

Submit packs to community-curated indexes.

| Axis | Assessment |
|---|---|
| Charter fit | OK as an additional path, never primary |
| Trust policy | `external-trusted: ask` — curator review adds an external trust actor; acceptable per policy but requires per-marketplace evaluation |
| Maintenance | Medium — upstream review cycles, format drift |
| Claim ladder | Risky — listing implies a distribution claim before T6 evidence |

Verdict: **deferred** — revisit after T6 exits GO; evaluate each
marketplace's submission/trust terms at that time.

### C. `gh skill publish` + GitHub releases

Distribute spec skills through the GitHub releases mechanism.

| Axis | Assessment |
|---|---|
| Charter fit | Good — plain GitHub releases, no new runtime surface |
| Trust policy | OK — first-party release trust pipeline already exists (`build-release-trust`) |
| Maintenance | Low — readiness gate already green for all core packs |
| Claim ladder | Cleanest path: publish = an ordinary signed release |

Verdict: **selected as the first activation path** — when T7 publish opens,
`gh skill publish` (via GitHub releases) is the lowest-burden channel that
reuses existing trust machinery.

### D. Stay repo-local this cycle

`pairslash install` from source/checkout remains the only documented path.

| Axis | Assessment |
|---|---|
| Charter fit | Required regardless (primary path) |
| Trust policy | No new actors |
| Maintenance | None new |
| Claim ladder | Fully consistent — no distribution claims |

Verdict: **selected as the current state** — this is the posture now and
remains the documented primary install path permanently.

## Decision

1. **Now**: repo-local install is the only documented distribution path.
   No marketplace is created, registered, or claimed.
2. **Activation order when the publish gate opens (T7)**: `gh skill
   publish` via GitHub releases first (option C); evaluate a PairSlash
   marketplace (option A) only if releases prove insufficient; evaluate
   upstream marketplace submissions (option B) per-marketplace against
   trust policy at that time.
3. `buildCodexMarketplaceManifest` and the Copilot plugin emit stay
   emission-only; they produce artifacts, they do not publish.

## Revisit triggers

- T6 release-unblock exits GO → re-evaluate option C activation.
- External demand or T7 publish readiness → re-evaluate option A.
- An upstream marketplace invitation/submission opportunity → evaluate
  per trust policy before accepting (option B).
- Any runtime changes plugin/marketplace format → re-verify emission
  contracts before relying on them.

## Consequences

- No publishing machinery is added to install/lint/doctor paths.
- `docs/releases/legal-packaging-status.md` continues to hold publication
  status; this ADR is cross-referenced there.
- Repo-local install documentation remains canonical and primary.
