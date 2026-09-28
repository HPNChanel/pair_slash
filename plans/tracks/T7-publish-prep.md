# Track T7 — Publish prep (posture NOT flipped)

**Status:** Approved | **Priority:** P3 — **hard gate: all T6 exits GO** | **Depends on:** T6
**Goal:** Make `private: true` flippable in one commit when the maintainer chooses — publish infra, dist build, NOTICE, dry-run lane, readiness checklist — without ever flipping the posture or implying publication.

## Context

July roadmap P1 carried forward with two updates: (a) Node 24 type-stripping means the "build" for publish is a bundling/emit concern, not compilation — use `esbuild`/`tsup` for a self-contained `dist/` bundle plus `.d.ts`; (b) plugin/marketplace distribution (T3) now coexists with npm as a channel — the checklist must cover both.

## Entry gate

- **All T6 exit gates green** (R1 benchmark recorded, R2 signed run verified, R3 ≥1 lane at `preview`). If T6 ends blocked, this track stays `todo` — that is the gate working as intended.

## Tasks (ordered)

| Task | Title | Depends on |
| --- | --- | --- |
| T7-01 | `publishConfig` + gated publish scripts (env-flag inert default) | — |
| T7-02 | `dist/` bundle build for `@pairslash/cli` (ESM bundle + declarations) | T7-01 |
| T7-03 | `NOTICE` file + `legal-packaging-status.md` sync | — |
| T7-04 | `npm publish --dry-run` CI lane + publication-readiness checklist | T7-02, T7-03 |

## Exit gate

- `npm publish --dry-run` succeeds end-to-end on the candidate lane.
- `NOTICE` exists, referenced by `docs/releases/legal-packaging-status.md`.
- `docs/releases/publication-readiness-checklist.md` records the exact flip conditions (T6 exits + legal sign-off).
- `private: true` UNCHANGED; README still says "repo-local install path" (C.6).

## Risks

- Bundling a type-stripping codebase: `allowImportingTsExtensions` + `.ts` imports in published artifacts need rewriting to `.js` or a bundled single file — T7-02 must resolve the module strategy explicitly.
- `bin: pairslash → src/bin/pairslash.ts` cannot ship as-is to npm (consumers lack type-stripping guarantees pre-build) — the publish artifact must point at the bundle.
