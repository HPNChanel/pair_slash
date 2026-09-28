---
id: T0-03
track: T0
title: Bump dependencies and realign packageManager
status: done
depends_on: [T0-01]
est_size: S
claimed_by: devin
claimed_at: 2026-09-28
completed_at: 2026-09-28
evidence: "valibot 1.5.0 (pub 2026-09-09), yaml 2.9.1 (pub 2026-09-11), @types/node pinned exact 24.13.6 (pub 2026-09-19) instead of ^24.19.0 which resolves to a 3-day-old release; packageManager realigned to npm@11.14.1; all gates green, audit clean"
---

## Objective

Update outdated deps (valibot →1.5.0, yaml →2.9.1, @types/node →24.19.0) and realign `packageManager` to the actually-installed npm version, keeping the 7-day-age supply-chain rule.

## Context & sources

- `npm outdated` (verified 2026-09-28): valibot 1.3.1→1.5.0, yaml 2.8.3→2.9.1, @types/node 24.13.3→24.19.0 (26.x exists but that's T10-02's decision — stay on 24 line here).
- `packageManager: "npm@11.7.0"` vs installed npm 11.14.1 — decide pin policy: either bump to a real released version or use a minimum-compatible form. Record the choice.
- CONSTRAINTS G9: prefer versions ≥7 days since publish — verify `npm view <pkg> time` for each target version before pinning.

## Files to touch

- `package.json` (root deps + packageManager + engines if needed)
- `package-lock.json` (via npm install, not hand-edit)
- `packages/*/package.json` where valibot/yaml deps are declared (spec-core, memory-engine, benchmark)
- Do NOT touch: `engines.node` (that's T10-02)

## Work steps

1. `npm view valibot time --json | tail`, same for `yaml` and `@types/node` — confirm target versions ≥7 days old.
2. Bump dependency ranges in root + package manifests (`^1.5.0`, `^2.9.1`, `^24.19.0` — keep `^` semver-minor convention already in use).
3. Realign `packageManager`: check `npm --version` on the maintainer machine; pin to that exact version (`npm@11.14.1`) OR adopt the documented policy the repo intends — record the decision in the commit body.
4. `npm install` → regenerate lockfile.
5. Full gates: lint, test, typecheck, test:release, sync:compat-lab --check.
6. If a golden/fixture diffs because yaml/valibot output changed → investigate, do NOT blindly regenerate; a golden diff means observable output changed (document why in commit).
7. Commit: `chore(deps): bump valibot 1.5.0, yaml 2.9.1, @types/node 24.19.0; realign npm pin`.

## Constraints (STRICT)

- MUST NOT introduce new dependencies (G9) — this task only bumps existing.
- MUST NOT pin `latest`/`*`/unbounded ranges.
- MUST NOT bump @types/node to 26.x here — that is reserved for T10-02 with the engines decision.
- MUST NOT hand-edit `package-lock.json`.
- If any bump breaks a gate: fix forward if trivial, else pin lower and record the blocker — do NOT leave red.

## Acceptance gates

- [ ] `npm outdated` shows no in-scope outdated packages after bump
- [ ] `npm run lint`, `npm run test`, `npm run typecheck` green
- [ ] `npm run test:release` green
- [ ] `npm run sync:compat-lab -- --check` green
- [ ] `npm audit --omit=dev --audit-level=high` clean or unchanged

## Evidence to record

- `npm view` timestamps proving ≥7-day age; final `npm outdated` output; commit hash.

## Rollback

`git revert` — lockfile diff fully contained in the commit.
