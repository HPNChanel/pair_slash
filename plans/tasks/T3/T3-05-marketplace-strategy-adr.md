---
id: T3-05
track: T3
title: PairSlash marketplace strategy decision record
status: todo
depends_on: [T3-02, T3-03]
est_size: S
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Decide — and record as an ADR — whether PairSlash operates its own plugin marketplace(s), contributes packs to existing marketplaces (`copilot-plugins`, `awesome-copilot`, OpenAI-curated), or stays repo-local, and how that interacts with the T7 publish gate.

## Context & sources

- Distribution options now exist on both runtimes: Codex `plugin marketplace` sources (GitHub shorthand/URL/local), Copilot marketplaces incl. default `awesome-copilot` (community-submittable), `gh skill publish` for spec skills.
- A PairSlash marketplace = a repo with a marketplace manifest + plugin dirs — T3-03 emits the manifest shape already.
- The July roadmap's `stage-toward-publish` posture applies: capability now, activation gated.
- Legal/trust boundaries: `docs/releases/legal-packaging-status.md`, `trust/trust-policy.yaml` (`external-trusted: ask`, `external-unverified: deny`) — distribution decisions must stay consistent with trust policy.

## Files to touch

- New ADR: `docs/architecture/adr-XXXX-marketplace-distribution.md` (next free number)
- Possibly `docs/releases/legal-packaging-status.md` cross-ref
- Do NOT touch: any publishing machinery, README claims

## Work steps

1. Enumerate options: (a) own marketplace repo, (b) upstream contribution to awesome-copilot etc., (c) `gh skill` + GitHub releases only, (d) stay repo-local this cycle.
2. Evaluate each against: charter boundaries, trust-policy consistency, maintenance burden, claim-ladder state (no live-verified lanes yet — distribution claims would outrun evidence until T6 clears).
3. Record decision + revisit triggers (e.g., "revisit after T6 exits GO").
4. Write ADR; link from `docs/releases/legal-packaging-status.md` if wording needs it.

## Constraints (STRICT)

- MUST NOT create or register a marketplace — this task decides strategy only.
- Decision MUST respect claim ladder: no public distribution claims before evidence exists (C.6).
- MUST keep repo-local install as the documented primary path regardless of decision.
- ADR MUST follow the repo's ADR convention (see `docs/architecture/adr-0001-*.md` for shape).

## Acceptance gates

- [ ] ADR written with explicit decision + revisit triggers
- [ ] Consistent with trust-policy + legal-packaging docs
- [ ] Gates green

## Evidence to record

- ADR path; option evaluation table.

## Rollback

`git revert` — ADR is a record; superseding ADRs can reverse later.
