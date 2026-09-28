---
id: T1-05
track: T1
title: Update doctor version-detection surfaces
status: todo
depends_on: [T1-02]
est_size: M
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Update `packages/tools/doctor` version checks so doctor evaluates *current* runtimes correctly — detection commands, version parsing, recommended-version warnings, and any surface probes that reference pre-plugin-era assumptions.

## Context & sources

- Doctor checks (per mega-plan inventory): runtime-detect, platform, scope, install-root, manifest, required-tools, etc. — all in `packages/tools/doctor/src/` (monolith `index.ts` ~97KB until T5-03 decomposes it).
- Suspect areas: hardcoded version floors for warnings, binary detection command lists, "skills picker exists" assumptions, Copilot binary discovery (which binary — `copilot` vs `gh copilot` extension?).
- After T1-02, the matrix holds new recommended versions — doctor should read recommended versions from the matrix/source of truth if it already does, or be updated to match.

## Files to touch

- `packages/tools/doctor/src/index.ts` (or decomposed modules if T5-03 landed first — check)
- `packages/tools/doctor/tests/` — update fixtures/expectations for new detection behavior
- Possibly `packages/runtimes/*/adapter/src/` — runtime detection descriptors
- Do NOT touch: lane verdict semantics, support-level logic

## Work steps

1. Inventory doctor's runtime-detection code paths: which binaries are probed, which version strings parsed, which warnings emitted.
2. Update detection: `copilot --version`/`copilot` binary + `gh` presence; `codex` binary; version parsers for `1.0.x` and `0.157.x` formats.
3. Update recommended/minimum version warnings to reference matrix values (or the updated constants).
4. Add informational detection for new surfaces where cheap: daemon running (Codex), plugin dirs present (Copilot `enabledPlugins`), hooks config present — report-only, no verdict change unless evidence-backed.
5. Update doctor tests + fixtures for the new detection surface.
6. Gates: doctor tests, lint, test, typecheck.

## Constraints (STRICT)

- MUST fail closed on unparseable versions (C.5) — a `1.0.88` parse failure is a finding, not a silent skip.
- MUST NOT change lane support verdicts — doctor reports environment truth; promotion stays evidence-gated.
- MUST keep doctor output deterministic (G8): sorted checks, stable ordering.
- MUST NOT auto-spawn or manage `exec-server` (C.8) — detect only.
- New probes MUST NOT require network at runtime — detection is local-only (vendor boundary: no undocumented internals either).

## Acceptance gates

- [ ] `npm run test` green incl. updated doctor tests
- [ ] `npm run typecheck` green
- [ ] Doctor output deterministic across repeat runs
- [ ] New detections labeled informational vs verdict-affecting correctly

## Evidence to record

- Updated detection matrix (binary → parse → verdict) in commit body.

## Rollback

`git revert` — detection surface is internal, self-contained.
