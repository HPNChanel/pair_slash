---
id: T7-01
track: T7
title: publishConfig + gated publish scripts (inert by default)
status: todo
depends_on: []
est_size: S
claimed_by:
claimed_at:
completed_at:
evidence:
blocked_reason:
---

## Objective

Add `publishConfig` and gated publish scripts to root + PairSlash-owned package manifests — fully inert unless an explicit env flag is set — so the publish path is staged but impossible to trigger accidentally.

## Context & sources

- Gate reminder: T7 may only start after all T6 exits GO. If T6 blocked → this task stays `todo`.
- Target manifests: `package.json` (root) + `packages/tools/cli/package.json` (`@pairslash/cli` is the publishable surface) — other workspace packages likely stay private (decide: publishable set = cli only, or cli + core libs? Recommend cli-only bundle per T7-02; record decision).
- Mechanism: `publishConfig: {access, registry}` is inert by nature; gate the *scripts* behind `PAIRSLASH_PUBLISH_READY=1` env check that exits non-zero with explanation otherwise.

## Files to touch

- `package.json` + publishable package manifests
- `scripts/` — guard script if needed (`assert-publish-ready.mjs`)
- Do NOT touch: `private` flags (stay `true`), README

## Work steps

1. Decide publishable set (recommend `@pairslash/cli` only — single bundled artifact); record decision.
2. Add `publishConfig` (registry default npm, access `restricted` for scoped safety initially — actually for scoped `@pairslash/*` public intent use `access: "restricted"` so nothing leaks publicly by accident; final flip is a separate decision).
3. Add `prepublishOnly` guard: exits 1 unless `PAIRSLASH_PUBLISH_READY=1`.
4. Verify: `npm publish --dry-run` fails closed without the flag (that's the safety proof).
5. Gates.

## Constraints (STRICT)

- MUST NOT remove `private: true` from any manifest.
- MUST NOT make publish runnable by default — env-gate is the safety boundary.
- `access` choice MUST err toward restrictive — accidental public publish is the failure mode being defended.
- MUST NOT add a `--tag latest` or auto-publish path anywhere.

## Acceptance gates

- [ ] `npm publish --dry-run` without flag → explicit refusal
- [ ] publishConfig present on publishable manifests
- [ ] Gates green

## Evidence to record

- Publishable-set decision; dry-run refusal output.

## Rollback

`git revert` — additive config.
