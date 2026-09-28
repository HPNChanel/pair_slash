---
id: T7-03
track: T7
title: NOTICE file + legal-packaging-status.md sync
status: todo
depends_on: []
est_size: S
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Add the repo-root `NOTICE` file required for Apache-2.0 publication posture and sync `docs/releases/legal-packaging-status.md` so the legal/packaging boundary doc reflects reality.

## Context & sources

- Apache-2.0 `LICENSE` exists at root; `NOTICE` is absent (documented gap).
- `NOTICE` content is governed by the legal boundary — for a single-author Apache project it's typically a minimal attribution notice; do NOT invent third-party attributions that don't exist; if vendored/bundled third-party code exists (check `deps`/vendored files), attribute accurately.
- `legal-packaging-status.md` is the authority on what's claimable.

## Files to touch

- New: `NOTICE` (root)
- `docs/releases/legal-packaging-status.md` — reference NOTICE
- Do NOT touch: LICENSE, package metadata posture

## Work steps

1. Inventory what NOTICE must contain: project name, copyright line convention used by the project (check LICENSE headers/git history for the holder name — if ambiguous, use the repo's existing copyright convention or escalate to maintainer for the exact line — do NOT guess an entity name).
2. Check for bundled third-party code requiring attribution (vendored snippets, copied code in comments referencing upstream).
3. Write minimal correct NOTICE.
4. Update legal-packaging-status.md to reference it.
5. Gates.

## Constraints (STRICT)

- MUST NOT fabricate copyright holder names — if the project's copyright line isn't determinable from repo artifacts, mark the task `blocked` pending maintainer input.
- MUST NOT over-attribute (listing deps that aren't vendored is noise).
- MUST NOT change any license terms — NOTICE is additive metadata.
- Keep to the legal boundary doc's authority — this task doesn't expand claims.

## Acceptance gates

- [ ] NOTICE exists + referenced by legal doc
- [ ] No fabricated attribution
- [ ] Gates green

## Evidence to record

- NOTICE content decision basis; third-party inventory result (even if empty).

## Rollback

`git revert`.
