---
id: T3-06
track: T3
title: Legal/packaging docs update for plugin distribution
status: todo
depends_on: [T3-05]
est_size: S
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Update `docs/releases/legal-packaging-status.md` (and any linked packaging docs) so the documented legal/packaging posture covers plugin-bundle artifacts and marketplace distribution as *possible channels*, consistent with the T3-05 decision and without claiming publication.

## Context & sources

- Current doc governs what package metadata may claim (`private: true`, LICENSE presence, NOTICE absence historically).
- Plugin bundles add artifacts (plugin.json, marketplace manifests) that carry their own metadata (name/license/author) — posture must state how those fields relate to Apache-2.0 + the project's publication status.
- T3-05's ADR is the strategy input.

## Files to touch

- `docs/releases/legal-packaging-status.md`
- Possibly `docs/releases/public-claim-policy.md` — only if distribution-channel wording needs a clause
- Do NOT touch: `package.json` private flags, README publication wording

## Work steps

1. Read `legal-packaging-status.md` fully; identify where plugin/marketplace artifacts slot in.
2. Update the doc: plugin bundles are generated artifacts under the repo's Apache-2.0; distribution channels remain repo-local until T7 + legal sign-off; `private: true` unchanged.
3. Cross-check `public-claim-policy.md` for a needed clause about marketplace wording (e.g., "may describe capability to emit, may not claim availability in a marketplace").
4. Gates.

## Constraints (STRICT)

- MUST NOT change `private` posture or imply publication availability (C.6).
- MUST keep legal wording inside the existing boundary doc structure — no invented legal claims.
- MUST reference the T3-05 ADR for the decision rationale rather than duplicating it.

## Acceptance gates

- [ ] Doc updated + internally consistent with ADR + claim policy
- [ ] Gates green

## Evidence to record

- Diff summary of posture statements added.

## Rollback

`git revert`.
