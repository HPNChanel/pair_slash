---
id: T10-01
track: T10
title: Node 26 CI matrix entry + compatibility verification
status: done
depends_on: []
est_size: M
claimed_by: devin
claimed_at: 2026-09-29
completed_at: 2026-09-29
evidence: >-
  Real Node 26.10.0 verified locally (nvm-windows install, PATH-pinned run):
  node packages/tools/cli/src/bin/pairslash.ts runs (arg parsing works,
  type-stripping clean, no warnings); npm run lint, npm run typecheck
  (strict), npm test (full suite), npm run test:compat, and npm run
  test:release all exit 0 on v26.10.0 / npm 11.19.1. Zero incompatibilities
  observed — no type-stripping warnings, no node: API breaks, no dependency
  issues. CI: repo-checks quick-checks and release-gates now matrix
  node-version ["24","26"]; phase4-acceptance and compat-lab-nightly lanes
  run each OS lane on both majors (artifacts suffixed -node24/-node26);
  release-trust-candidate matrix ["24","26"] (LTS-bound major included) with
  per-node artifact names. engines and @types/node untouched per scope —
  T10-02 owns declaration changes.
---

## Objective

Verify the entire codebase runs correctly on Node 26 and add it to CI — ahead of the 2026-10-28 LTS transition so the LTS-day experience is already proven.

## Context & sources

- Runtime model: Node 24 type-stripping runs `.ts` directly (no build). Node 26 continues type-stripping but defaults may differ (e.g., `--experimental-transform-types` vs strip-only behaviors, erasableSyntaxOnly rules) — the verification must actually run `node packages/tools/cli/src/bin/pairslash.ts` on 26, not assume.
- Node release cadence change: from Node 27, one major/year (April), all become LTS — doc note for maintainers in T10-05.
- CI: `repo-checks.yml` quick-checks + `phase4-acceptance.yml` + nightly matrix — add 26 to the matrix where meaningful.

## Files to touch

- `.github/workflows/repo-checks.yml` — matrix `node-version: [24, 26]` for quick-checks (or a separate job — decide by runtime cost)
- `.github/workflows/phase4-acceptance.yml` / `compat-lab-nightly.yml` — 26 entries where coverage warrants
- `.github/workflows/release-trust-candidate.yml` — ensure it runs on the LTS-bound version at minimum
- Do NOT touch: `engines` (T10-02 after verification), @types/node (T10-02)

## Work steps

1. Local: install/run with Node 26 (nvm/volta or CI) — run `npm run lint`, `npm run test`, `npm run typecheck`, `npm run test:release`, `npm run test:compat` on 26.
2. Record incompatibilities: type-stripping warnings, `node:` API changes, dependency issues. Fix forward or document.
3. Add Node 26 to CI matrices.
4. Confirm green across both majors.
5. Commit `ci(t10): add Node 26 to test matrices`.

## Constraints (STRICT)

- MUST verify real Node 26 execution — CI green only counts if Node 26 is actually in the matrix, not if 24 passes.
- MUST NOT bump `engines` floor or `@types/node` here — verification precedes declaration (T10-02).
- If Node 26 exposes real breakage → fix forward or mark blocked with specifics — do NOT shim CI to hide it.
- CI cost control: add 26 to the right lanes (quick-checks + acceptance), not blindly everywhere.

## Acceptance gates

- [ ] Full gate suite green on Node 26 (local + CI)
- [ ] Both majors in CI matrix
- [ ] Known incompatibilities documented (even if zero)

## Evidence to record

- Node 26 run outputs; matrix diff; incompatibility notes.

## Rollback

`git revert` — CI matrix entries revert cleanly.
