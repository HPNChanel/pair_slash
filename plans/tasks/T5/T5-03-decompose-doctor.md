---
id: T5-03
track: T5
title: Decompose doctor/index.ts into checks/ + report.ts + barrel
status: done
depends_on: []
est_size: L
claimed_by:
claimed_at:
completed_at: 2026-09-28
evidence:
  - "Export diff: empty — sole public export `runDoctor` preserved via named re-export barrel."
  - "Module map: doctor/helpers.ts (41 decls: consts, verdict/issue helpers, scope probes, resolveDoctorRuntime+buildBaseContext), doctor/checks/{runtime-detect,platform,scope,install-root,manifest,required-tools,owned-files,trust-posture,preview-risk,asset-placement,workflow-maturity}.ts (28 run* checks + domain helpers), doctor/checks/index.ts (CHECKS registry, order identical to pre-split), doctor/report.ts (19 build*/aggregate/sort fns), doctor/run-doctor.ts (runDoctor entrypoint)."
  - "T1-05/T4-04/T4-06 additions (runSharedSkillRootSupport, runCodexDaemonState, runHooksState + helpers) grouped into install-root and runtime-detect per domain rule — none orphaned in barrel."
  - "Split tool: .pairslash/tmp/split-doctor.mjs (handles named/default/namespace/`as`-alias imports, depth-aware relative paths)."
  - "Gates: doctor tests 44/44 unmodified; npm run typecheck clean; npm run lint clean; npm test all files green."
---

## Objective

Split `packages/tools/doctor/src/index.ts` (~97KB, ~69 functions) into `doctor/checks/*` grouped by domain + `doctor/report.ts`, barrel-preserving.

## Context & sources

- Boundaries (per mega-plan): `doctor/helpers.ts` (lines ~66–274), `doctor/checks/*.ts` (group ~24 `run*` check fns by domain: runtime-detect, platform, scope, install-root, manifest, required-tools, owned-files, trust-posture, unmanaged, preview-risk, asset-placement, workflow-maturity — plus new checks added by T1-05/T4-04 if they landed first), `doctor/report.ts` (build* aggregators, remediation, verdict, summary, guidance). Barrel re-exports `runDoctor` et al.
- Contract: `doctor/tests/doctor.test.js` unmodified.

## Files to touch

- `packages/tools/doctor/src/index.ts` → barrel
- New: `packages/tools/doctor/src/doctor/helpers.ts`, `doctor/checks/*.ts` (per-domain files), `doctor/report.ts`
- Do NOT touch: tests, CLI call sites, verdict semantics

## Work steps

1. Snapshot exports (esp. `runDoctor` + report builders the CLI imports).
2. Create submodules per domain groups; move bodies verbatim.
3. Barrel re-export; verify export diff empty.
4. Doctor tests unmodified green; gates.
5. Commit `refactor(doctor): decompose index.ts into checks/ + report.ts`.

## Constraints (STRICT)

- MUST keep check registration/ordering identical — doctor output ordering is user-visible (G8).
- MUST NOT change verdict logic during the move.
- Byte-identical public exports; no test edits.
- If T1-05/T4-04 added checks since the mega-plan inventory, group them by the same domain rule — do not leave them orphaned in the barrel.

## Acceptance gates

- [x] Export diff empty
- [x] Doctor tests green unmodified
- [x] Gates green

## Evidence to record

- Module map; export diff.

## Rollback

`git revert`.
