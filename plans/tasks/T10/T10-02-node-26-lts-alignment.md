---
id: T10-02
track: T10
title: engines + @types/node alignment at Node 26 LTS + cadence doc
status: done
depends_on: [T10-01]
est_size: S
claimed_by: devin
claimed_at: 2026-09-29
completed_at: 2026-09-29
evidence: >-
  @types/node bumped 24.13.6 → 26.6.3; npm run typecheck (strict) clean on
  both Node 24.11.0 and Node 26.10.0 — no 26-only type leakage surfaced, no
  latent type errors. npm install clean, 0 vulnerabilities. Engines
  decision: keep ">=24.0.0" as floor while both majors are CI-tested —
  recorded in docs/maintainers/node-release-cadence.md along with the new
  annual-April all-LTS cadence (next transition ~April 2027) and the
  new-major verification checklist. Doc linked from
  docs/maintainers/README.md.
---

## Objective

At/after Node 26 LTS (2026-10-28) or once T10-01 proves compatibility: align `@types/node` to 26.x, revisit `engines`, and document the new Node release cadence so future transitions are scheduled, not surprised.

## Context & sources

- Node 26 → Active LTS 2026-10-28; Node 24 → maintenance 2026-10-20; cadence changes from Node 27 (annual April majors, all-LTS).
- `engines: ">=24.0.0"` already covers 26 semantically — decide whether to state tested range more precisely (`>=24.0.0` vs documenting "tested on 24 + 26"). Recommendation: keep `>=24` floor while both are supported; note tested versions in docs.
- `@types/node` move to 26.x — type surface should match the max supported runtime; verify no 26-only types leak that break 24 compat (the floor matters — types used must exist on 24).

## Files to touch

- `package.json` — `engines` + `@types/node`
- `package-lock.json` — regen
- Maintainer docs — Node cadence note (e.g., `docs/maintainers/` or CONTRIBUTING dev-setup section)
- `docs/compatibility/` — if Node range is a documented surface
- Do NOT touch: runtime version pins (that's runtimes, not Node)

## Work steps

1. After T10-01 green on both majors: bump `@types/node` to 26.x; `npm install`; verify typecheck still clean (24-floor APIs must be the ones used — check for 26-only APIs introduced accidentally).
2. Decide engines wording (keep `>=24.0.0` + docs "tested on 24.x and 26.x"; or explicit range) — record decision.
3. Write the cadence note: annual-April majors, all-LTS, alpha channel, next transition ~April 2027.
4. Full gates.

## Constraints (STRICT)

- MUST NOT use Node-26-only APIs while the floor is 24 — lint/test on 24 must still pass (CI matrix proves).
- MUST keep engines honest — only versions actually tested get documented claims.
- `@types/node` major bump needs the full gate suite (type surface changes can surface latent type errors).
- MUST record the cadence doc where maintainers will see it.

## Acceptance gates

- [ ] `@types/node` 26.x + gates green on both majors
- [ ] Engines decision recorded
- [ ] Cadence note landed

## Evidence to record

- Type-compat verification output; decision note.

## Rollback

`git revert` — dep + docs revert cleanly.
