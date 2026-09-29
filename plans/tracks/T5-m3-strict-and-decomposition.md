# Track T5 — Finish M3 strict graduation + mega-file decomposition

**Status:** Done | **Priority:** P1 | **Depends on:** T0
**Goal:** Complete the in-flight M3 work: decompose the four remaining mega-files, clear the ~3,300 strict TypeScript errors in measured batches, and fold `strict` into the root tsconfig with CI enforcement.

## Context

State verified against `.kilo/plans/1784473291765-mega-decompose-strict-o1-a1.md` (2026-07-25) and the current tree:
- M1 (decompose CLI bin + memory-engine, TS setup, SBOM, cross-OS CI): **done**.
- M2 (all packages → `.ts` via Node 24 type-stripping): **done** — 96 `.ts` files.
- M3: codex/copilot compilers graduated to `tsconfig.strict.json`; `packages/tools/trace` WIP was mid-graduation and left the tree red (fixed in T0-01). Outstanding: ~3,331 strict errors measured at plan time (~2,577 `noImplicitAny`-class mechanical + ~750 null-safety/assignment higher-care).
- Mega-files remaining: `spec-core/validate.ts` (~155KB), `spec-core/pack-catalog.ts` (~86KB), `doctor/index.ts` (~97KB), `installer/index.ts` (~94KB).

## Entry gate

- T0 green. The mega-decompose plan at `.kilo/plans/1784473291765-mega-decompose-strict-o1-a1.md` is the authoritative submodule inventory — task files reference it rather than restating it.

## Tasks (ordered)

| Task | Title | Depends on |
| --- | --- | --- |
| T5-01 | Decompose `spec-core/validate.ts` into `validate/` modules + barrel | — |
| T5-02 | Decompose `spec-core/pack-catalog.ts` into `catalog/` modules + barrel | T5-01 |
| T5-03 | Decompose `doctor/index.ts` into `checks/` + `report.ts` + barrel | — |
| T5-04 | Decompose `installer/index.ts` into plan/state/environment/journal/install/update/uninstall + barrel | — |
| T5-05 | Strict batch: spec-core (schemas/constants/utils) | T5-01, T5-02 |
| T5-06 | Strict batch: spec-core (pack-catalog + read-authority) | T5-05 |
| T5-07 | Strict batch: contract-engine | T5-05 |
| T5-08 | Strict batch: policy-engine | T5-05 |
| T5-09 | Strict batch: memory-engine | T5-07 |
| T5-10 | Strict batch: trace + benchmark | T5-05 |
| T5-11 | Strict batch: installer | T5-04, T5-09 |
| T5-12 | Strict batch: doctor + compat-lab | T5-03, T5-11 |
| T5-13 | Strict batch: cli + lint-bridge (final) | T5-12 |
| T5-14 | Flip root tsconfig to strict, delete tsconfig.strict.json, wire CI + evidence | T5-13 |

## Exit gate

- `npm run typecheck` runs strict on all `packages/**/*.ts`; zero errors; `tsconfig.strict.json` deleted; `typecheck:strict` script retired or aliased.
- `npm run lint`, `npm run test`, `npm run test:release` green throughout.
- Each decomposition is pure refactor — exported API names byte-identical (verified by diff); existing tests untouched and green.
- Any real bug found during strict fixes gets a regression test + commit note (per CONSTRAINTS X3).

## Risks

- Scale: ~3,300 errors is the biggest single workload in the program; the noImplicitAny-first ordering (mechanical ~77%) is mandatory — null-safety class second (higher bug-finding value).
- Barrel diffs: a wrong re-export silently changes public API — each decomposition task diffs exported names before/after.
- Interleaving with T2–T4: strict batches and standards work touch overlapping files — sequence T5 sub-batches after the relevant T2/T4 tasks when both touch the same file, or split by module boundary.
