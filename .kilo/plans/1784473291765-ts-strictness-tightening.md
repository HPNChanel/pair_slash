# Phase M3 — Progressive TypeScript Strictness Tightening

**Status:** Implementation-ready plan
**Date:** 2026-07-24
**Prerequisite:** Phase M2 complete (all 96 `.ts` files compile under relaxed config)
**Charter constraints:** No behavioral change, no public wording change, all gates must stay green.

---

## 1. Context — Why this phase exists

Phase M2 converted all 94 source files to `.ts` but intentionally relaxed strictness to unblock the migration (`strict: false`, `noImplicitAny: false`, `strictNullChecks: false`). This left:

| Debt | Count | Bug-finding value |
| --- | --- | --- |
| `noUnusedLocals` + `noUnusedParameters` violations | 21 | Dead code / incomplete refactoring |
| `as any` escape-hatch casts | 32 | Type confusion / missing type guards |
| `noImplicitAny` errors (all packages) | 2,853 | Missing parameter annotations |
| `strictNullChecks` errors (all packages) | 1,710 | Null/undefined dereference bugs |
| **Total** | **4,616** | |

A global flag flip is infeasible (4,600+ errors at once). This plan uses a **dual-tsconfig mechanism** to graduate packages to strict mode one at a time, in dependency order, fixing real bugs at each step.

---

## 2. Mechanism — Dual tsconfig

Two configs coexist; the typecheck script runs both sequentially:

- **`tsconfig.json`** (root, relaxed) — `include: ["packages/**/*.ts"]`, `exclude` grows as packages graduate. Current flags unchanged.
- **`tsconfig.strict.json`** (new) — `extends: "./tsconfig.json"` + strict overrides. `include` starts empty and grows as packages graduate.

When a package graduates:
1. Remove its glob from root `tsconfig.json` (add to `exclude`).
2. Add its glob to `tsconfig.strict.json` `include`.
3. Fix all strict errors in that package.
4. Validate.

When all packages have graduated, move strict flags into root config, delete `tsconfig.strict.json`.

**Why not project references?** `tsc -b` requires `composite: true` which implies emit, conflicting with `noEmit: true` (Node 24 type-stripping, no build step). Dual-config is the compatible alternative.

---

## 3. Tasks

### M3.0 — Infrastructure setup

**Goal:** Dual-config typecheck pipeline working with zero packages in strict yet.

1. Create `tsconfig.strict.json` at repo root:
   ```json
   {
     "extends": "./tsconfig.json",
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true,
       "strictNullChecks": true,
       "noUnusedLocals": true,
       "noUnusedParameters": true,
       "exactOptionalPropertyTypes": false
     },
     "include": []
   }
   ```
2. Update `scripts/run-typecheck.mjs` to run both configs sequentially:
   - After the existing `tsc --noEmit -p tsconfig.json` succeeds, check if `tsconfig.strict.json` has any `include` entries.
   - If yes, run `tsc --noEmit -p tsconfig.strict.json`.
   - Forward exit code.
3. Update root `tsconfig.json` comment to document the dual-config mechanism.

**Validation:**
- `npm run typecheck` green (strict config has empty include → tsc no-ops or is skipped).
- `npm run test` green.

**Commit:** `feat(m3): add dual-tsconfig strict pipeline`

---

### M3.1 — Dead code sweep (global)

**Goal:** Enable `noUnusedLocals` + `noUnusedParameters` in root config. Only 21 errors.

1. Flip `noUnusedLocals: true` and `noUnusedParameters: true` in root `tsconfig.json`.
2. Run `npm run typecheck` — fix all 21 errors:
   - Remove genuinely dead variables/parameters.
   - Prefix intentional-unused params with `_` (TypeScript allows `_`-prefixed unused params under `noUnusedParameters`).
3. These flags also go into `tsconfig.strict.json` (already set above).

**Validation:**
- `npm run typecheck` green.
- `npm run test` green.
- `npm run lint` green.

**Commit:** `feat(m3): enable noUnusedLocals/noUnusedParameters, remove dead code`

---

### M3.2 — Eliminate `as any` escape hatches (global, 32 casts)

**Goal:** Replace all 32 `as any` casts with proper types. These span 5 packages but are concentrated in `spec-core` (21 casts).

#### Pattern A: `.includes(x as any)` — 21 casts (mostly in `manifest-v2.normalize.ts`)

**Root cause:** `Array<string>.includes()` rejects values of wider/different types even when the intent is a membership check on an unknown string.

**Fix:** Add a type-guard helper in `constants.ts` (or a new `type-guards.ts`):
```typescript
export function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}
```
Replace each `ARRAY.includes(x as any)` with `isOneOf(x, ARRAY)`. This both checks membership AND narrows the type in the `if` branch — a real improvement over `as any`.

**Affected sites** (from the audit):
- `manifest-v2.normalize.ts`: ~14 casts (WORKFLOW_MATURITY_LEVELS, PACK_STATUSES, PACK_DEPRECATION_STATUSES, PACK_DOCS_VISIBILITY, PACK_RELEASE_VISIBILITY, PACK_RUNTIME_EVIDENCE_KINDS, PACK_RUNTIME_SUPPORT_STATUSES, PACK_SUPPORT_LEVELS, PACK_TRUST_TIERS, RELEASE_CHANNELS, WORKFLOW_CLASSES, WORKFLOW_DEMOTION_TRIGGER_CODES, SUPPORTED_RUNTIMES, PACK_PUBLISHER_CLASSES)
- `index.ts` (spec-core): 2 casts (SUPPORT_VERDICTS, required-phase check)
- `manifest-v2.normalize.ts`: 2 casts via `(existing.get(x) as any)?.property` — fix Map types

#### Pattern B: `(error as any).code` — 6 casts (runtimes adapters, spec-core)

**Root cause:** `Error` type doesn't have `.code`. Node errors (`ENOENT`, etc.) have it on `NodeJS.ErrnoException`.

**Fix:**
```typescript
import type { ErrnoException } from "./types.js"; // or use NodeJS.ErrnoException
// Cast: (error as NodeJS.ErrnoException).code
// Or add a type guard: function hasErrorCode(e: unknown): e is NodeJS.ErrnoException
```
Use `NodeJS.ErrnoException` (available via `@types/node`) for error code access.

#### Pattern C: `Map.get() as any` — 3 casts (manifest-v2.normalize.ts, release-trust.ts)

**Root cause:** `Map<K, V>.get()` returns `V | undefined`, and the Map's value type wasn't annotated.

**Fix:** Annotate Map generics at declaration site. Use `(map.get(key) ?? defaultValue)` pattern instead of `as any`.

#### Pattern D: `(entry as any).split(...)` / `(x as any).install_dir` — 2 casts

**Root cause:** Destructured or indexed values lose their type annotation.

**Fix:** Trace the value's origin and add the correct type annotation at the source.

**Validation:**
- `npm run typecheck` green (these fixes don't require strict mode — they work under the relaxed config too).
- `npm run test` green.
- Verify zero `as any` remain: `grep -r "as any" packages/ --include="*.ts"` returns empty.

**Commit:** `feat(m3): eliminate all \`as any\` casts with proper type guards`

---

### M3.3 — Graduate runtimes to strict (proof-of-concept)

**Goal:** Move `packages/runtimes/codex` and `packages/runtimes/copilot` to strict config. These are the smallest packages (~200 combined errors across 6 files), proving the mechanism end-to-end.

**Error budget:** ~78 `strictNullChecks` + ~120 `noImplicitAny` = ~200 errors.

1. Add to `tsconfig.strict.json`:
   ```json
   "include": ["packages/runtimes/**/*.ts"]
   ```
2. Add to root `tsconfig.json` `exclude`:
   ```json
   "packages/runtimes"
   ```
3. Run `tsc --noEmit -p tsconfig.strict.json` — fix all ~200 errors.

**Fix strategy (in order):**
- **Pass 1 — `noImplicitAny`:** Add parameter types to all functions. Most are straightforward (`: string`, `: RepoRoot`, etc.). Infer from usage and existing type definitions in spec-core.
- **Pass 2 — `strictNullChecks`:** Handle `Map.get()` returning `T | undefined`, optional chaining, null guards. These are the bug-finding errors — pay attention to cases where a missing null check could cause a runtime crash.
- **Pass 3 — `noUnusedLocals/Parameters`:** Should be zero (already fixed in M3.1).

**Bug-finding focus:** In `strictNullChecks` pass, specifically look for:
- `adapter.ts`: `spawnSync` result access — `error` field is `Error | undefined`, `.code` access must be guarded.
- `compiler.ts`: `manifest.runtime_bindings[runtime]` access — could be `undefined` if runtime not in bindings.
- `index.ts`: `error.stderr` / `error.stdout` access on spawn results — could be `null`.

**Validation:**
- `npm run typecheck` green (both configs).
- `npm run test` green (600000ms timeout — type stripping overhead).
- `npm run lint` green.

**Commit:** `feat(m3): graduate runtimes to strict TypeScript`

---

### M3.4 — Graduate core/spec-core to strict (highest type value)

**Goal:** Move `packages/core/spec-core` to strict. This is the schema/contract boundary — the highest-value package for type safety. Largest single package (~500+ `noImplicitAny` + ~400+ `strictNullChecks` errors across 20 files).

1. Add `packages/core/spec-core/**/*.ts` to `tsconfig.strict.json` include.
2. Add `packages/core/spec-core` to root `tsconfig.json` exclude.
3. Fix errors file-by-file, starting with leaf modules (no internal imports):
   - `constants.ts` (leaf, few errors)
   - `manifest-v2.schema.ts` (leaf, valibot types)
   - `manifest-v2.normalize.ts` (imports constants — ~200 errors, mostly includes-guards already fixed in M3.2)
   - `manifest.ts` (imports normalize)
   - `manifest-resolver.ts` (imports manifest)
   - `compile.ts`, `ir.ts`, `ownership-receipt.ts` (import manifest types)
   - `release-trust.ts` (~200 errors, complex)
   - `pack-catalog.ts` (~300 errors, largest file)
   - `read-authority.ts` (~150 errors)
   - `validate.ts`, `benchmark-truth.ts` (import many types)

**Fix strategy:** Same two-pass approach (noImplicitAny first, then strictNullChecks).

**Validation:** Same gates as M3.3.

**Commit:** `feat(m3): graduate spec-core to strict TypeScript`

---

### M3.5+ — Follow-on graduation (out of detailed scope)

Repeat the pattern for remaining packages in dependency order:

| Order | Package | Approx errors | Notes |
| --- | --- | --- | --- |
| 6 | `core/contract-engine` | ~150 | Small, depends on spec-core |
| 7 | `core/policy-engine` | ~200 | Small, depends on spec-core |
| 8 | `core/memory-engine` | ~400 | 10 decomposed modules |
| 9 | `tools/trace` | ~100 | Leaf package, few deps |
| 10 | `tools/doctor` | ~150 | Depends on spec-core |
| 11 | `tools/installer` | ~200 | Depends on memory-engine |
| 12 | `tools/lint-bridge` | ~50 | Small |
| 13 | `tools/compat-lab` | ~500 | Large, many fixtures |
| 14 | `tools/benchmark` | ~400 | Large |
| 15 | `tools/cli` | ~800 | Last — depends on everything |

### M3.final — Root flip

When all packages are in strict config:
1. Move all strict flags from `tsconfig.strict.json` into root `tsconfig.json`.
2. Restore root `include: ["packages/**/*.ts"]`, remove `exclude` entries.
3. Delete `tsconfig.strict.json`.
4. Simplify `run-typecheck.mjs` to single-config mode.
5. Final validation: all gates green.

**Commit:** `feat(m3): flip root tsconfig to strict — M3 complete`

---

## 4. Common fix patterns reference

| Error pattern | Example | Fix |
| --- | --- | --- |
| `TS7006: Parameter 'x' implicitly has 'any'` | `function sort(a, b)` | Add type from usage: `function sort(a: string, b: string)` |
| `TS7031: Binding element 'x' implicitly has 'any'` | `({ repoRoot, manifest }) =>` | Annotate destructured param: `({ repoRoot, manifest }: { repoRoot: string; manifest: Manifest })` |
| `TS7053: Element implicitly has 'any'` (index access) | `ORDER[level]` | Type the index: `ORDER[level as keyof typeof ORDER]` or type the `level` param |
| `TS7005: Variable implicitly has 'any[]'` | `const errors = []` | Explicit type: `const errors: string[] = []` |
| `TS2339: Property on 'undefined'` | `map.get(key).property` | Null check: `map.get(key)?.property` or guard |
| `TS2322: 'T \| undefined' not assignable to 'T'` | `const x: T = map.get(k)` | Add guard or default: `const x: T = map.get(k) ?? defaultValue` |
| `.includes(x as any)` | `ARRAY.includes(x as any)` | `isOneOf(x, ARRAY)` type guard (from M3.2) |

---

## 5. Validation plan (every sub-phase)

1. `npm run typecheck` — green (both configs).
2. `npm run test` — green (600000ms timeout).
3. `npm run lint` — green (0 errors; 18 pre-existing LINT-RUNTIME-004/LINT-TRUST-003 warnings unchanged).
4. `npm run sync:compat-lab -- --check` — green (if compatibility surfaces touched).
5. No behavioral change: CLI tests + acceptance tests unchanged.
6. No public wording change.

---

## 6. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Cross-package type mismatch surfaces late (strict package exports to non-strict importer) | Acceptable — caught when importer graduates; tests verify runtime behavior in the meantime. |
| Large error count per package makes one commit unwieldy | Sub-commit per file within a package if needed; each file is independently fixable. |
| `strictNullChecks` reveals real null-deref bugs requiring behavioral fix | Fix the bug, add a regression test, document in commit message. These are the highest-value findings. |
| Type-stripping runtime doesn't validate types | Correct — runtime behavior unchanged regardless of strictness. TS strictness is compile-time only. |
| Valibot schema type incompatibilities (`v.integer() as any`) | Investigate valibot's TypeScript export types; may need `Schema<typeof v.integer()>` or similar. |

---

## 7. Out of scope

- Track R (R1/R2/R3) — maintainer-only actions (benchmark, signing, live capture).
- Track P (P1 publish) — gated on R exit.
- Track A (A1 retrieval-engine) — gated on R3.
- Track O (O1 sync-truth + fuzz/mutation testing) — separate phase.
- `exactOptionalPropertyTypes` — too strict for initial migration, deferred.
- `verbatimModuleSyntax` — deferred to avoid massive `import type` churn.
- Converting test files (`.test.js`) to TypeScript — separate effort.
