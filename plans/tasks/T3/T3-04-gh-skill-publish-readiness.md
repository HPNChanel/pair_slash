---
id: T3-04
track: T3
title: gh skill publish readiness gate
status: done
depends_on: [T3-02]
est_size: S
claimed_by: devin
claimed_at: 2026-09-28
completed_at: 2026-09-28
evidence: >
  scripts/verify-skill-publish-readiness.mjs stages all 11 core packs via
  compileCopilotPack({emitMode:"plugin"}) and runs `gh skill publish
  --dry-run` — live run on host gh 2.96.0 (2026-09-28): verdict pass, zero
  diagnostics for all 11 packs. Report kind pairslash.skill-publish-
  readiness/v1; gh-absent yields explicit verdict "unavailable" (exit 0),
  skill errors fail closed (exit 1). Wired as advisory non-blocking step in
  run-release-readiness.mjs + npm script test:publish:skills; tests in
  tests/skill-publish-readiness.test.js cover parser/report/unavailable paths.
---

## Objective

Make emitted skills pass `gh skill publish` validation (GitHub CLI's skill-distribution path) — i.e., verify spec compliance end-to-end through the real distribution tool, and wire a `--dry-run` check into release-readiness where the tool is available.

## Context & sources

- `gh skill` group (CP-09): `gh skill search|preview|install|update|publish`; publish validates naming/frontmatter/directory conventions against the Agent Skills spec and ships via GitHub releases; supports `--dry-run`, `--tag`.
- T2-01's validator approximates the spec — this task validates against the *actual* `gh` tool where present (capability-detected), not re-implementing it.
- This is readiness, not publication: nothing is published (C.6, T7 gate).

## Files to touch

- `scripts/` — new `verify-skill-publish-readiness.mjs` (or equivalent) producing a report
- `package.json` — script entry (e.g., `test:publish:skills` or folded into release-readiness chain)
- Possibly `packages/tools/doctor` or lint — capability check for `gh` presence
- Do NOT touch: emitters (already produce the artifacts), any publish-releasing code

## Work steps

1. Detect `gh` + `gh skill` availability; the check must gracefully report `unavailable` (not fail) when the tool is absent — it's a readiness gate, not a hard dependency.
2. For each emitted skill (or the canonical pack set), run `gh skill publish --dry-run`-equivalent validation; collect verdicts.
3. Emit a structured report artifact (consistent with existing verify-*.mjs script patterns — read one first: `verify-supportability-surfaces.mjs`).
4. Wire into release-readiness chain as a non-blocking report initially (documented), upgrading to required when coverage is proven.
5. Tests/fixtures for the report shape.

## Constraints (STRICT)

- MUST NOT publish anything — dry-run/validation only.
- MUST fail closed on validation errors in emitted skills; `gh`-absent = explicit `unavailable` status, not pass.
- MUST NOT add `gh` as a hard dependency of install/lint paths — capability-detected optional tooling.
- Report MUST be deterministic and reviewable (C.7).

## Acceptance gates

- [ ] Readiness script produces a clean report on emitted skills (or a precise failure list)
- [ ] `unavailable` path tested (no `gh` → explicit status)
- [ ] Gates green

## Evidence to record

- Sample report output; verdict per core pack.

## Rollback

`git revert` — additive script.
