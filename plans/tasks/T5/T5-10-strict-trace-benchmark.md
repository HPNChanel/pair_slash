---
id: T5-10
track: T5
title: Strict batch — trace + benchmark
status: done
depends_on: [T5-05]
est_size: M
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Fix all strict errors in `packages/tools/trace/` and `packages/tools/benchmark/` — observability + measurement tooling.

## Context & sources

- `trace` got its strict-prep WIP finished in T0-01 (typing fixed under relaxed config); this task completes strict-grade typing: event schemas, store paths, export builders, retention math, telemetry.
- `benchmark` holds evidence-log/scoring code used by T6-01 — precision matters but blast radius is smaller than memory-engine.
- Event shapes (`TraceEvent` fields like `workflow_id`, `correlation_id`) must serialize identically — types describe the wire format, don't redesign it.

## Files to touch

- `packages/tools/trace/src/*.ts`, `packages/tools/benchmark/src/*.ts`
- Do NOT touch: event/record schemas' field names, tests

## Work steps

1. Baseline count for both packages.
2. Mechanical → null-safety pass.
3. Scrutiny: `export.ts` field accesses (T0-01 typed them — verify the types match emitted event shapes), `retention.ts` arithmetic (time/retention math on typed values), benchmark scoring paths.
4. Count → 0; gates green.
5. Commit `refactor(trace,benchmark): strict typing`.

## Constraints (STRICT)

- MUST NOT change serialized event field names/shapes — observability consumers (support bundles, exports) depend on them.
- MUST NOT `as any`/`ts-ignore`.
- Redaction/telemetry-eligible logic MUST be preserved exactly — privacy-relevant code.
- Deterministic ordering in exports preserved.

## Acceptance gates

- [x] 0 strict errors in scope; trace/benchmark tests green; gates green

## Evidence recorded

- Baseline strict errors (trace + benchmark): ~273 pre-codemod -> 64 residuals after mechanical pass -> 0 final.
- `npm run typecheck` (repo gate): PASS, 0 errors.
- `npm run typecheck:strict`: 0 errors in `packages/tools/trace/src/*` and `packages/tools/benchmark/src/*` (remaining repo strict errors belong to T5-11/T5-12/T5-13 scopes).
- `node packages/tools/trace/tests/trace.test.js`: 5/5 pass.
- `node packages/tools/benchmark/tests/benchmark.test.js`: 5/5 pass.
- `npm run lint`: PASS. `npm test`: full suite green. `npm run test:release`: PASS.
- Event-shape stability: `TraceEvent`/`TraceIndex` types untouched; only callback/parameter annotations, null-safe narrowing (`?? 0` on `safeRate` results preserves JS null-coercion semantics), keyof casts on alias/label maps, and type-guard filters. No `as any`/`ts-ignore` introduced.
- Notable decisions: `loadRunInput`/`buildArtifactManifest`/`buildDebugReport` take required `repoRoot: string` (bodies dereference it unconditionally); `compactTimestamp` param typed `Date` (sole caller passes `Date`); `stableValue`/`redactValue` recursive returns annotated `any` (private helpers); median filter uses `value is number` guard (same semantics as `Number.isFinite`).

## Rollback

`git revert`.
