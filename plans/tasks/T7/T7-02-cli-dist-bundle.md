---
id: T7-02
track: T7
title: dist/ bundle build for @pairslash/cli (ESM bundle + declarations)
status: todo
depends_on: [T7-01]
est_size: M
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Produce a publishable `dist/` artifact for `@pairslash/cli`: a self-contained ESM bundle (esbuild/tsup) + `.d.ts` declarations, resolving the `.ts`-imports problem so consumers don't need Node type-stripping.

## Context & sources

- Codebase runs via Node 24+ type-stripping (`allowImportingTsExtensions`, `node pairslash.ts` direct). A published npm artifact cannot rely on that for all consumers — the bundle must resolve `.ts`→`.js` (or single-file bundle) and point `bin` at the artifact.
- Dependencies: all `@pairslash/*` are `file:` workspace links — bundle them in (esbuild handles this) since they're `private: true` and unpublished.
- `files` field in package.json must cover `dist/` + needed runtime assets; `bin` must point at `dist/bin/pairslash.js`.

## Files to touch

- `packages/tools/cli/package.json` — `files`, `bin`, `exports` for publish artifact
- `scripts/` or `packages/tools/cli/` — build script (`build.dist.mjs` or tsup config)
- `package.json` root — `build:dist` script
- `.gitignore` — `dist/` output ignored (coordinate with T0-02 decision)
- Do NOT touch: source `.ts` layout (bundling is an output concern, not a source refactor)

## Work steps

1. Choose bundler: `esbuild` (minimal, fast) vs `tsup` (declarations bundled) — verify ≥7-day-old versions per G9; add as root devDependency.
2. Build: bundle `src/bin/pairslash.ts` → `dist/pairslash.js` (ESM, platform=node, target node24), bundle deps in, generate `.d.ts` where meaningful (public API surface).
3. Rewrite `bin` to `dist/...` — shebang preserved.
4. Verify: `node dist/pairslash.js doctor --help` runs; `npm pack --dry-run` shows the intended file set.
5. Keep `src/` as the dev path — `npm run pairslash` still uses `src/bin/pairslash.ts` directly.

## Constraints (STRICT)

- MUST NOT change source files to accommodate the bundler (no `.ts`→`.js` import rewrites in source; bundler resolves).
- MUST keep bundle output deterministic (minify off or fixed settings — diffable artifacts preferred; decide + record).
- `bin` MUST point at the built artifact in the publish manifest — dev path unchanged locally.
- MUST NOT include source maps leaking absolute dev paths unless intended (check).
- New dep needs G9 review (pinned, ≥7 days, license-compatible).

## Acceptance gates

- [ ] `node dist/pairslash.js --help` works
- [ ] `npm pack --dry-run` file list correct (dist + manifest + docs)
- [ ] Gates green

## Evidence to record

- Bundle size; pack file list; bundler choice rationale.

## Rollback

`git revert` — additive build lane.
