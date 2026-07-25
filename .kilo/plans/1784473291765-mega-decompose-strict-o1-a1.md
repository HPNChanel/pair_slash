# PairSlash Multi-Track Build-Out Plan

**Status:** Implementation-ready
**Date:** 2026-07-25
**Scope:** Mega-file decomposition → M3 strict big-batch → Track O1 ops automation → Track A1 retrieval slice.
**Authoritative constraints:** `docs/phase-12/authoritative-program-charter.md`, `docs/architecture/phase-18-workflow-maturity-charter.md`, `docs/releases/public-claim-policy.md`, `docs/compatibility/runtime-surface-matrix.yaml`.

---

## 1. Context — verified ground truth (corrects stale summary)

Prior context summary claimed "all M3 work uncommitted" and "~4,600 strict errors." Both are **inaccurate**. Verified reality:

| Claim (stale) | Verified truth |
| --- | --- |
| M3.0–M3.2 uncommitted | M3.1 (`noUnusedLocals/Parameters: true` in root `tsconfig.json`) + M3.2 (`as any` count = **0**, `isOneOf<T>` helper in `constants.ts:346`) are **already committed** in `faf4894`. |
| ~4,600 strict errors | **3,331** strict errors measured via `tsc --strict --noImplicitAny --strictNullChecks`. |
| 8 uncommitted files = all M3 | 8 uncommitted files are a small strict-prep WIP (21 insertions): `NodeJS.ErrnoException` casts, Map typings in runtimes adapters, doctor, installer, release-trust, manifest-v2.normalize, `tsconfig.strict.json`. |

### Strict error breakdown (3,331 total) — measured
| Code | Meaning | Count | Class |
| --- | --- | --- | --- |
| TS7006 | Parameter implicitly `any` | 1,790 | noImplicitAny |
| TS7031 | Binding element implicitly `any` | 573 | noImplicitAny |
| TS7005 | Variable implicitly `any` | 152 | noImplicitAny |
| TS7053 | Element implicitly `any` (index) | 40 | noImplicitAny |
| TS7034 | Variable implicitly `any[]` | 22 | noImplicitAny |
| TS2322 | Type not assignable | 548 | mixed (null + assign) |
| TS2339 | Property does not exist | 61 | mixed |
| TS2345 | Argument not assignable | 36 | mixed |
| TS18046 | Variable of type `any` | 57 | any-leak |
| TS18048 | Possibly `undefined` | 27 | strictNullChecks |
| TS18047 | Possibly null/undefined | 7 | strictNullChecks |
| TS7023 | — | 5 | — |

→ **~2,577 errors are noImplicitAny-class** (mechanical: add parameter annotations). The remainder are null-safety + assignment (higher bug-finding value). Strategy: fix noImplicitAny-class first (bulk, low-risk), then null-safety class (higher-care).

### Current gate state
- Root `tsconfig.json`: `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`, `noUnusedLocals/Parameters: true`, `noFallthroughCasesInSwitch: true`. `include: ["packages/**/*.ts"]`, no `packages/runtimes` exclude.
- `tsconfig.strict.json`: strict flags on, `include: []` (empty → skipped by `run-typecheck.mjs`).
- `run-typecheck.mjs` runs relaxed config, then strict config only if its `include` is non-empty.
- CI `repo-checks.yml` runs `npm run typecheck` (relaxed → green). This gate must stay green throughout.

---

## 2. Decisions resolved

| Decision | Chosen | Rationale |
| --- | --- | --- |
| Tracks in scope | M3 strict + decomposition + O1 + A1 (all four) | User-selected. |
| M3 strategy | **Big-batch**: fix all 3,331 errors, then flip root to strict | User-selected. Dual-config cannot isolate packages (transitive source imports); fixing everything makes isolation moot. |
| Sequencing | Decompose **before** strict-fix | Smaller files make the 3,331 errors tractable per-module; pure-refactor phase first keeps risk low. |
| Strict gate during batch | Keep strict config **out of CI** until 0 errors | Add `typecheck:strict` script for local progress; CI `typecheck` stays relaxed/green. Fold in at the end. |
| A1 vs R3 gate | **Implement code now**, keep `experimental`/`design-only` labels; do NOT widen public claims | Roadmap gates A1 *promotion* on R3 (maintainer-only, not done). Code implementation + tests are safe under charter as long as labels and `private` posture are unchanged. |

---

## 3. Hard constraints (invariant across all phases)

- No third runtime (only `codex_cli`, `copilot_cli`).
- `/skills` remains the canonical front door; advanced slices must not compete.
- Global Project Memory stays explicit-write-only; retrieval slice is read-only, `truth_tier: "supplemental"`, never authoritative.
- No claim skips claim-ladder levels. No public wording stronger than current legal/package metadata (`private: true` stays).
- Every phase: no behavioral change unless a strict-error fix reveals a real bug (then fix + regression test + commit-message note).

---

## 4. Sequencing

```
Phase 0  → commit/verify 8-file WIP                (prerequisite, ~minutes)
Phase 1  → decompose 4 mega-files                  (pure refactor, no strict change)
Phase 2  → M3 big-batch strictness (3,331 errors)  (noImplicitAny-class first, then null)
Phase 3  → Track O1 ops automation                 (sync-truth + perf/mutation/fuzz)
Phase 4  → Track A1 retrieval slice                (engine→.ts, index, skill, tests)
```
Phases 3 and 4 are independent of each other and of Phase 2's tail; they may interleave once Phase 1 is done and Phase 2's spec-core package is clean (A1 imports spec-core).

---

## 5. Phase 0 — Commit the uncommitted WIP (prerequisite)

**Goal:** Land the 8-file strict-prep WIP so the tree is clean before new work.

**Tasks:**
1. Run full gates: `npm run test`, `npm run typecheck`, `npm run lint`, `npm run sync:compat-lab -- --check`. Confirm green.
2. If green: `git add -A && git commit -m "refactor(m3): add strict-prep casts (NodeJS.ErrnoException, typed Maps)"`.
3. If any gate fails: fix or revert the offending hunk; do not commit red.

**Validation:** All gates green; `git status` clean.
**Rollback:** `git checkout -- .` (discards the 21-insertion WIP — all changes are also reflected in committed code via the relaxed config, so discarding is safe).

---

## 6. Phase 1 — Decompose the four mega-files (pure refactor)

**Goal:** Split each mega-file into focused sibling modules; keep the original as a **barrel** re-exporting the identical public API. No behavioral change. This is the proven M1 pattern (already applied to CLI + memory-engine).

**Universal rule:** public `export` names + signatures in the barrel file MUST be byte-identical to today. The existing test file is the contract (no test edits — they must pass unmodified).

### Decomposition boundaries (from function inventory)

| File | Size | Sub-modules | Contract test |
| --- | --- | --- | --- |
| `packages/core/spec-core/src/validate.ts` | 155KB, 55 fns | `validate/primitives.ts` (lines 89–265: push, isObject, validateObject/NonEmptyString/Boolean/StringArray, reason-code validators), `validate/canonical.ts` (lines 523–938: all `validateCanonical*`), `validate/records/*.ts` (one per exported `validate*Record` — group: lifecycle [Manifest,NormalizedIr,CompiledPack], runtime-support [TrustDescriptor], install [InstallState,PreviewPlan,InstallJournal], observability [DoctorReport,LintReport,Trace*,SupportBundle], explainability [ContextExplanation,PolicyExplanation,DebugReport,TelemetrySummary]). Barrel `validate.ts` re-exports. | `spec-core/tests/spec-core.test.js`, `manifest-v2.conformance.test.js` |
| `packages/core/spec-core/src/pack-catalog.ts` | 86KB, 66 fns | `catalog/constants.ts` (DEFAULT_PUBLIC_* frozen objects), `catalog/helpers.ts` (clone..normalizeEvidenceScopeCollectionForCompare), `catalog/workflow-maturity.ts` (normalizeWorkflowMaturity..resolveWorkflowMaturity, all `collect*MaturityBlockers`, `deriveDemotionTriggers`), `catalog/lane-records.ts` (validate* runbook/iso/lane), `catalog/builders.ts` (buildCatalogRuntimeSupport..renderPackCatalogIndexYaml). Barrel re-exports. | `spec-core/tests/spec-core.test.js` |
| `packages/tools/doctor/src/index.ts` | 97KB, 69 fns | `doctor/helpers.ts` (lines 66–274), `doctor/checks/*.ts` (group the ~24 `run*` check fns by domain: runtime-detect, platform, scope, install-root, manifest, required-tools, owned-files, trust-posture, unmanaged, preview-risk, asset-placement, workflow-maturity), `doctor/report.ts` (build* aggregators, remediation, verdict, summary, guidance). Barrel re-exports `runDoctor`. | `doctor/tests/doctor.test.js` |
| `packages/tools/installer/src/index.ts` | 94KB, 63 fns | `installer/plan.ts` (createPlan, buildOperation, buildAssetDiff, manifestSelection, compileSelection), `installer/state.ts` (buildStatePack, trust receipts, loadStateForDoctor), `installer/environment.ts` (runRequiredToolChecks, resolve*Environment, boundary inspection), `installer/journal.ts` (mutation journal, rollback), `installer/install.ts` (buildInstallOperations, planInstall, applyInstall), `installer/update.ts` (buildUpdateOperations, planUpdate, applyUpdate, validateManagedOwnershipFile), `installer/uninstall.ts` (buildUninstallOperations, planUninstall, applyUninstall). Barrel re-exports all public fns. | `installer/tests/installer.test.js` |

**Per-file task pattern (repeat for each mega-file):**
1. Create subdirectory; create the target module file(s); **move** the function bodies verbatim (including internal helpers they depend on — promote shared helpers to a `helpers.ts` or keep duplicated only if trivial).
2. Replace the original file body with `export * from "./subdir/..."` re-exports preserving the exact public names.
3. Run that package's contract test + `npm run typecheck` + `npm run lint`. Must be green.
4. Commit per mega-file: `refactor(<pkg>): decompose <file>.ts into focused modules`.

**Validation:** `npm run test`, `npm run typecheck`, `npm run lint`, `npm run test:release` all green. No test file edited. No public export name/signature changed (diff the barrel's exported names against pre-decomposition).
**Rollback:** Each mega-file decomposition is one commit; revert independently. Decomposition is pure relocation; behavior is unchanged.

---

## 7. Phase 2 — M3 big-batch strictness (3,331 errors)

**Goal:** Reach zero strict errors, then flip root `tsconfig.json` to strict and delete the dual-config mechanism.

### 2a. Wire up a non-gated strict tracker
1. Set `tsconfig.strict.json` `include: ["packages/**/*.ts"]`, `exclude: []` (drop the `packages/runtimes` exclusion concept — irrelevant now).
2. In `run-typecheck.mjs`: split into two scripts. `npm run typecheck` (CI gate) runs **only** the relaxed root config. New `npm run typecheck:strict` runs the strict config. Add `"typecheck:strict"` to root `package.json` scripts.
3. Confirm CI still runs `npm run typecheck` (relaxed → green). `typecheck:strict` is **not** in any CI workflow yet.

### 2b. Fix errors in dependency order, package by package
Order (leaf deps first, mirroring the M3.5 table):
1. `core/spec-core` (largest: constants→manifest-v2.schema→manifest-v2.normalize→manifest→compile/ir→release-trust→pack-catalog→read-authority→validate) — now decomposed into smaller modules from Phase 1.
2. `core/contract-engine`
3. `core/policy-engine`
4. `core/memory-engine` (already decomposed in M1)
5. `tools/trace` → `tools/doctor` → `tools/installer` → `tools/lint-bridge` → `tools/compat-lab` → `tools/benchmark`
6. `runtimes/codex` + `runtimes/copilot`
7. `tools/cli` (last)

**Per-package fix pass:**
- **Pass A — noImplicitAny-class (TS7006/7031/7005/7053/7034):** add parameter/variable annotations. Infer from usage + existing valibot/manifest types. Mechanical, low-risk. Run `npm run test` after each file batch.
- **Pass B — null-safety + assignment (TS18046/18048/18047/2322/2339/2345):** handle `Map.get()` → `T|undefined` with guards/defaults; optional chaining; null checks. **Flag real null-deref bugs** — if a fix changes behavior, add a regression test and note it in the commit message.
- **Pass C — any-leak (TS18046):** eliminate remaining `any` propagation; use the `isOneOf` guard and record types.
- After each package: `npm run typecheck:strict` error count for that package drops to 0; `npm run test` green. Commit: `feat(m3): graduate <pkg> to strict TypeScript`.

**Bug-finding focus (high-value):** `Map.get()` without default; `spawnSync().error` / `.stderr` / `.stdout` (null/undefined); `manifest.runtime_bindings[runtime]` (undefined if runtime absent); `JSON.parse` result indexing.

### 2c. Root flip (when `typecheck:strict` reports 0)
1. Move `strict: true`, `noImplicitAny: true`, `strictNullChecks: true` from `tsconfig.strict.json` into root `tsconfig.json` (set `strict: true`; remove the individual false overrides).
2. Delete `tsconfig.strict.json`.
3. Simplify `run-typecheck.mjs` to single-config; remove `typecheck:strict` script (or keep `typecheck` pointing at strict root).
4. Final: all gates green.

**Validation (whole phase):** `npm run typecheck:strict` → 0 errors. `npm run test` green throughout (600000ms timeout). `npm run lint` green (0 errors; 18 pre-existing warnings unchanged). `npm run sync:compat-lab -- --check` green. No public wording change.
**Rollback:** Per-package commits are independently revertible (the relaxed config still compiles the reverted state). Root flip is one commit — revert it to restore relaxed mode if a post-flip regression appears.

---

## 8. Phase 3 — Track O1 ops automation (gated on M1 ✅)

### 3a. `pairslash sync-truth` — preview-first multi-file sync
**Goal:** Replace the manual 5–7-file sync on every truth-layer change with one preview-first command.

**Tasks:**
1. Add a new CLI command module `packages/tools/cli/src/commands/sync-truth.ts` following the existing command-handler pattern (M1 dispatcher).
2. Signature: `pairslash sync-truth --lane <id> --bump-evidence <class> [--preview | --apply]` (default `--preview`).
3. When run, it updates in lockstep: `docs/compatibility/runtime-surface-matrix.yaml` (evidence class + support_level + last_verified_at + surface_verdicts), regenerates `docs/compatibility/compatibility-matrix.md` (reuse existing `sync-compat-lab-artifacts.mjs` logic), updates the lane record `docs/evidence/live-runtime/<lane>.{md,yaml}`, and updates `packs/core/*/pack.manifest.yaml` `support.workflow_evidence.live_workflow_refs` for affected packs.
4. **Default `--preview` prints the multi-file diff and exits without writing.** Only `--apply` mutates (charter preview-first invariant).
5. Tests: preview produces a correct multi-file patch for a sample lane bump; `--apply` writes atomically; invalid lane/evidence-class fails closed; a `--check`-equivalent post-state passes `npm run sync:compat-lab -- --check`.

### 3b. Perf regression tests (nightly only)
- Add `tests/perf/` with latency baselines for `planInstall`/preview, `planUpdate`, and a memory-write. Wire into `compat-lab-nightly.yml` only (NOT `repo-checks.yml`).

### 3c. Mutation testing pilot (nightly only)
- Add `stryker` devDependency (Apache-2.0). Scope to `packages/core/memory-engine` only. Report mutation score; do **not** gate CI.

### 3d. Fuzz harness (nightly only)
- Add `fast-check` devDependency (MIT). `tests/fuzz/memory-conflict.fuzz.js` fuzzes memory-engine conflict detection. Nightly only.

**Validation:** `npm run test` green (pilts are nightly-only and must not break the default suite). `pairslash sync-truth --preview` produces a verified-correct patch. Public wording unchanged.
**Rollback:** Each O1 task is independently revertible. `sync-truth` defaults to preview and never mutates without `--apply`.

---

## 9. Phase 4 — Track A1 retrieval slice

**Charter caveat:** A1 *promotion* to anything claimable is gated on R3 (maintainer live-capture, not done). This phase **implements the slice + tests** under `experimental`/`design-only` labels and does NOT widen any public claim, runtime-lane support, or workflow-maturity ceiling.

### 4a. retrieval-engine → TypeScript + harden
- Convert `packages/advanced/retrieval-engine/src/index.js` (168 lines, working read-only slice) → `.ts`. It already has: capability defaults, policy contract (`deny` external + hidden_write + memory.promote), `buildPolicy`, `searchSource`, `runRetrievalQuery` (returns `authoritative: false`, `truth_tier: "supplemental"`), `resolveRetrievedFactAgainstGlobalMemory`.
- Type-annotate fully (it will now be covered by Phase 2 strict).
- Keep `retrieval_enabled: false` default; external queries stay `deny`.

### 4b. retrieval-index — deterministic indexer
- Implement `packages/advanced/retrieval-index/src/index.ts`: indexes `.pairslash/project-memory/`, `.pairslash/task-memory/`, `.pairslash/staging/` **read-only**. Writes on-disk index only under `.pairslash/observability/retrieval-index/` (confirm no collision with existing trace storage — see Open Q3). Never writes to `project-memory/`.

### 4c. retrieval-skill — opt-in skill descriptor
- Implement `packages/advanced/retrieval-skill/` pack descriptor. Installable **only** via explicit `--pack` flag; never via `--pack-set core` or `--all`.

### 4d. Workspace opt-in (separate group, private)
- Add a **separate** workspace entry for advanced packages (do NOT add to root `workspaces` core list). All advanced `package.json` stay `private: true`, `experimental` label.

### 4e. Tests + lint guard
- Tests: (1) policy gating blocks any authoritative write attempt; (2) results labeled `authoritative: false` / `truth_tier: "supplemental"` always; (3) index is read-only over project-memory (write attempt throws); (4) external query denied; (5) global-memory precedence on conflict.
- Lint rule: lint fails closed if `packages/advanced/retrieval-engine` ever imports `packages/core/memory-engine`'s write pipeline.

**Validation:** retrieval slice callable via explicit invocation only. Policy engine blocks writes. `npm run test` green. Charter regression suite green (no third runtime, no competing front door, no implicit memory write). `packages/advanced/README.md` reflects promoted status with `experimental`/`design-only` label. Public wording unchanged.
**Rollback:** Advanced packages are workspace-opt-in; remove from the advanced workspace list to disable without touching core.

---

## 10. Cross-cutting risks

| Risk | Mitigation |
| --- | --- |
| Decomposition changes behavior subtly. | Contract tests are byte-identical pre/post; run full `test`+`test:release` after each file. Public exports diffed. |
| Big-batch strictness reveals real null-deref bugs requiring behavioral fixes. | Fix the bug, add regression test, document in commit. These are the highest-value findings — do NOT paper over with `!`. |
| `typecheck:strict` red blocks CI mid-batch. | It is NOT in CI until 2c root flip. CI runs relaxed `typecheck` (green) throughout. |
| Mutation/fuzz/perf pilots break the default suite. | Nightly-only; excluded from `repo-checks.yml` and `npm run test`. |
| retrieval slice becomes a competing front door. | Workspace-opt-in, `experimental` label, lint rule blocks write-pipeline imports, never in core pack-set. |
| SBOM task from M1 still appears unverified. | Verify/complete CycloneDX SBOM on release lane if the implementing agent finds it missing (low priority, out of these 4 tracks — see Open Q1). |
| Charter drift from A1 before R3. | A1 ships code+labels only; `packages/advanced/README.md` and public wording unchanged; no runtime-lane or workflow-maturity promotion. |

---

## 11. Validation plan (every phase)

1. `npm run lint` green (0 errors; 18 pre-existing LINT-RUNTIME-004/LINT-TRUST-003 warnings unchanged).
2. `npm run test` green (364 tests, 600000ms timeout).
3. `npm run typecheck` green (relaxed) throughout; `npm run typecheck:strict` → 0 by end of Phase 2.
4. `npm run test:release` green.
5. `npm run sync:compat-lab -- --check` green (where compatibility surfaces touched).
6. Charter regression checks (`tests/` truth-governance suite) green.
7. No public wording change unless a verdict explicitly moved (none of these phases move R1/R2/R3).
8. Dated entry per phase in `.pairslash/audit-log/` or relevant evidence path.

---

## 12. Open questions for implementing agent (non-blocking)

1. **SBOM completion:** is CycloneDX SBOM generation actually present on the release lane? The M1 plan called for it; verify and complete if missing (low priority vs the 4 chosen tracks).
2. **`sync-truth` naming:** confirm the CLI subcommand `pairslash sync-truth` does not collide semantically with the npm script `sync:compat-lab` (different namespaces — npm script vs CLI subcommand — but ensure the help text distinguishes them). Alternative name if collision concern: `pairslash promote-evidence`.
3. **retrieval-index storage:** confirm `.pairslash/observability/retrieval-index/` does not collide with existing trace storage under `.pairslash/observability/`.
4. **`typecheck:strict` timeout:** the strict pass over all packages may exceed the default 120s; the implementing agent should expect `600000ms` and run package-by-package.
5. **Phase 2 ordering vs spec-core dependency:** A1 (Phase 4) imports spec-core types — ensure Phase 2 has graduated `core/spec-core` before starting 4a, OR accept relaxed-typed imports during A1 and tighten later.
