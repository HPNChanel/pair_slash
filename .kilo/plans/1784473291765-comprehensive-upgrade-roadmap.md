# PairSlash Comprehensive Upgrade Roadmap

**Status:** Draft for implementation handoff
**Date:** 2026-07-19
**Scope:** Multi-phase roadmap covering release-unblock, modernization, stage-toward-publish, advanced build-out, and operational automation.
**Authoritative constraints:** `docs/phase-12/authoritative-program-charter.md`, `docs/architecture/phase-18-workflow-maturity-charter.md`, `docs/compatibility/runtime-surface-matrix.yaml`, `docs/releases/public-claim-policy.md`.

---

## 1. Context — Why this roadmap exists

PairSlash v0.4.0 ships a technically complete Phase 4 installability + trust substrate (managed lifecycle, preview-first mutations, explicit-write-only Global Project Memory, release-trust bundle verification, lane-bound compatibility governance). The repo is green: `npm run lint`, `npm run test`, `npm run test:release` all pass.

What is **not** shipped — and what holds the program at Phase 3.5 — is captured in three `NO-GO` verdicts plus a fully quarantined advanced slice:

| Blocker | Authoritative source | Root cause |
| --- | --- | --- |
| Product-validation `NO-GO` | `docs/validation/phase-3-5/verdict.md` | Phase 19 benchmark apparatus built; no official round recorded. |
| Scoped release `NO-GO` | `docs/releases/scoped-release-verdict.md` | Signing infra + protected CI built; no successful `release-trust-candidate` run with uploaded signed bundle. |
| Runtime lanes all `prep`/`degraded` | `docs/compatibility/runtime-surface-matrix.yaml` | No canonical `/skills` live captures; Phase 18 caps every core workflow at `canary`. |
| Advanced packages design-only | `packages/advanced/README.md` | `ci-engine`, `delegation-engine`, `retrieval-engine/index/skill` are scaffolds, not in workspace. |

Additional modernization debt observed in codebase:
- No TypeScript; runtime validation via valibot only.
- `packages/tools/cli/src/bin/pairslash.js` is 1650 lines; `packages/core/memory-engine/src/index.js` is 1390 lines.
- CI matrix is `ubuntu-latest` only; cross-OS acceptance relies entirely on compat-lab fake fixtures + shims.
- No SBOM, no `npm audit` gate, no dependency provenance.
- Every truth-layer change must be synced manually across 5–7 files (`runtime-surface-matrix.yaml`, `compatibility-matrix.md`, lane records, charter sync targets, project-memory pointer).

## 2. Decisions resolved

| Decision | Chosen option | Rationale |
| --- | --- | --- |
| Plan scope | Comprehensive multi-phase roadmap | User-selected. |
| Publication posture | **Stage-toward-publish** | Build publish infra now; flip `private: true` → publish only at a phase gate after R1+R2+R3 exit, to avoid overclaiming publication before validation clears. |
| TypeScript strategy | **Layered per-package** | spec-core first (highest static-type value at schema/contract boundary), then contract → memory → installer → doctor → cli. JS/TS coexist during transition. |
| Advanced packages | **Sequence: retrieval → ci → delegation** | retrieval unlocks core product value (semantic memory search); ci-engine unlocks adoption; delegation-engine is governance-heavy, lowest urgency. |

## 3. Hard out-of-scope guarantees (charter constraints)

These are invariant across every phase. Any phase that appears to require changing one of them must be rejected or escalated:

- No third runtime (only `codex_cli`, `copilot_cli`).
- `/skills` remains the canonical front door; advanced slices may not become a competing entrypoint.
- Global Project Memory stays explicit-write-only; no background/hidden writes, no autopilot application.
- No claim may skip claim-ladder levels (`implemented` → `repo-verified` → `deterministic-covered` → `lane-live-verified` → `publicly claimable`).
- Workflow maturity labels (`canary`/`preview`/`beta`/`stable`/`deprecated`) stay distinct from runtime-lane labels (`prep`/`degraded`/`preview`/`stable-tested`/`blocked`) and release-channel labels.
- No public wording stronger than current legal/package metadata allows (`private: true` until P1 gate).
- Read workflows never mutate authoritative memory; only `pairslash-memory-write-global` writes.

## 4. Roadmap structure

Five tracks, ordered by dependency. Phases inside each track are sequential. Tracks R and M can run in parallel; track P is gated on R exit; track A is gated on M2 exit; track O can start anytime after M1.

```
Track R (Release unblock)     R1 → R2 → R3
Track M (Modernize)           M1 → M2
Track P (Publish prep)        [gate: R1+R2+R3 GO] → P1
Track A (Advanced build-out)  [gate: M2 done] → A1 → A2 → A3
Track O (Ops automation)      [gate: M1 done] → O1
```

---

## Track R — Unblock the three NO-GO verdicts

Goal: move `docs/validation/phase-3-5/verdict.md`, `docs/releases/scoped-release-verdict.md`, and at least one runtime lane to a publicly claimable state, without skipping evidence levels.

### Phase R1 — Official Phase 19 benchmark round 1

**Goal:** Flip product-validation verdict from `NO-GO` by recording the first official benchmark round under the current method.

**Tasks:**
1. Confirm `docs/validation/phase-3-5/benchmark-truth.yaml`, `benchmark-task-catalog.yaml`, `benchmark-log-schema.yaml`, `benchmark-scoring-rubric.yaml`, `benchmark-lane-wording.yaml` are the active method (already checked in).
2. Run `npm run benchmark:round1` against the documented must-win workflows (`pairslash-plan`, `pairslash-memory-write-global`) on at least one real Codex CLI repo lane.
3. Capture raw logs into the maintainer-local benchmark log directory; record summarized evidence pointers in `benchmark-truth.yaml` only at the granularity the public-claim policy permits.
4. Score the round using `npm run benchmark:score`; persist the scoring artifact.
5. Update `docs/validation/phase-3-5/verdict.md` only if scoring satisfies the maintainer validation criteria. Otherwise record the gap and keep `NO-GO` with a dated rationale.
6. Sync the official phase sentence in charter sync targets only if the verdict actually moves.

**Exit gate:**
- `benchmark-truth.yaml` records at least one official run with timestamps and lane IDs, OR verdict.md documents a dated, specific gap.
- `npm run test:release` stays green.
- No public wording changes unless verdict moves.

**Rollback:** Revert `verdict.md` and `benchmark-truth.yaml` to prior commit; benchmark raw logs are maintainer-local and do not affect the public surface.

### Phase R2 — Protected release-trust-candidate lane activation

**Goal:** Flip scoped-release verdict from `NO-GO` by completing one successful protected signed-bundle run.

**Tasks:**
1. Generate a first-party signing keypair; record the public key in `trust/first-party-keys.json` and the key ID in `trust/pack-authority.yaml` (if not already present).
2. Configure GitHub Actions secrets `PAIRSLASH_RELEASE_TRUST_PRIVATE_KEY` and `PAIRSLASH_RELEASE_TRUST_KEY_ID` on the repo.
3. Confirm `.github/workflows/repo-checks.yml`, `compat-lab-nightly.yml`, `release-trust-candidate.yml` enforce `PAIRSLASH_RELEASE_TRUST_REQUIRE_SIGNED=1` on protected lanes (already coded; verify no soft-skip path remains).
4. Trigger a `release-trust-candidate` run on `main`; confirm the signed bundle uploads as an artifact.
5. Run `npm run release:trust:verify -- --trust-dir <downloaded-artifact>` locally to confirm structural + signature verification.
6. Record the candidate run in the maintainer evidence file `release-candidate-evidence-0.4.0.md` (per `docs/releases/upgrade-notes-0.4.0.md` step 6).
7. Run `npm run test:release:ship` — must pass.
8. Update `docs/releases/scoped-release-verdict.md` from `NO-GO` to `GO` (scoped installability claim only — not product-validation).

**Exit gate:**
- At least one protected signed bundle artifact exists and verifies.
- `release-candidate-evidence-0.4.0.md` records the run with checksums and timestamp.
- `npm run test:release:ship` green.
- `scoped-release-verdict.md` explicitly states it does **not** imply product-validation exit.

**Rollback:** Keep `PAIRSLASH_RELEASE_TRUST_REQUIRE_SIGNED=1` fail-closed; any signing regression automatically re-blocks. Revert verdict to `NO-GO` if `npm run test:release` fails on any subsequent commit (per the verdict's own update rule).

### Phase R3 — Live runtime lane evidence capture

**Goal:** Promote at least one lane off `prep`/`degraded` to `preview` (single fresh canonical `/skills` live verification on the exact lane). Codex CLI repo macOS is the closest candidate (already `degraded` with archived direct-invocation smoke).

**Tasks:**
1. For the chosen lane (recommend `codex-cli-repo-macos` first), follow `docs/compatibility/runtime-surface-matrix.yaml` `runbook_policy` exactly:
   - Scripted allowed: `host_profile_capture`, `runtime_version_capture`, `doctor`, `preview_install`, `install_apply`.
   - Manual required: `canonical_skills_listing`, `workflow_selection_from_skills`, `workflow_prompt_and_response_capture`, `memory_write_preview_observation`.
2. Capture artifacts into `docs/evidence/live-runtime/codex-cli-repo-macos.{md,yaml}` using `docs/evidence/live-runtime/schema.live-runtime-lane-record.yaml`.
3. Update `runtime-surface-matrix.yaml` for that lane: `actual_evidence_class: live_verification`, `support_level: preview`, `last_verified_at`, `surface_verdicts.canonical_picker: pass`, etc.
4. Re-run `npm run sync:compat-lab -- --check` to confirm `compatibility-matrix.md` regenerates consistently.
5. Repeat on a second distinct host profile within freshness window if aiming for `stable-tested` (deferred — out of R3 scope; R3 targets `preview` only).
6. After lane promotion, revisit the relevant `pack.manifest.yaml` `support.workflow_evidence.live_workflow_refs` entries for the promoted runtime.

**Exit gate:**
- At least one lane moves from `prep`/`degraded` to `preview` in `runtime-surface-matrix.yaml`.
- Lane record YAML validates against the schema.
- `npm run test:release` green; compat-lab matrix sync check passes.
- Phase 18 catalog still reports the workflow effective maturity correctly (likely still `canary` because both runtimes need live evidence for `preview` workflow maturity — this is expected; do not overclaim).

**Rollback:** Lane record updates are git-tracked; revert the YAML + matrix regeneration in one commit. Live evidence captures themselves are kept (negative/positive history is valuable).

---

## Track M — Modernize the foundation

Goal: reduce single-file blast radius, add static type safety incrementally, harden supply chain, and add real cross-OS CI coverage.

### Phase M1 — Modernization foundation (no behavioral change)

**Goal:** Lay infrastructure for TS adoption, decompose the two largest files, and add supply-chain gates — all behind a no-behavioral-change contract.

**Tasks:**
1. **TS build setup at repo root** without converting any source yet: add `tsconfig.json` (per-package references via TS project references), `typescript` devDependency, `npm run typecheck` script. Output: `npm run typecheck` is a no-op pass on day one (allows gradual opt-in).
2. **Decompose `packages/tools/cli/src/bin/pairslash.js` (1650 lines)** into command handlers under `packages/tools/cli/src/commands/` (one module per command: `install.js`, `update.js`, `uninstall.js`, `doctor.js`, `lint.js`, `memory.js`, `explain-context.js`, `explain-policy.js`, `debug.js`, `trace.js`, `telemetry.js`). Keep `bin/pairslash.js` as the dispatcher only. Behavior must stay identical — existing CLI tests are the contract.
3. **Decompose `packages/core/memory-engine/src/index.js` (1390 lines)** into `write-pipeline.js`, `audit.js` (already exists), `candidate.js` (already exists), `preview.js`, `conflict.js`. Behavior must stay identical — existing memory-engine tests are the contract.
4. **Supply-chain gate:** add `npm audit --audit-level=high` step to `.github/workflows/repo-checks.yml` quick-checks job; add SBOM generation via `npm sbom` (or `@cyclonedx/cyclonedx-npm`) producing `dist/sbom.cyclonedx.json` on release lane only (not committed on every PR).
5. **Real cross-OS CI matrix:** extend `.github/workflows/phase4-acceptance.yml` to add `macos-latest` and `windows-latest` runners alongside `ubuntu-latest` for the deterministic acceptance lane. Keep the fake/shim compat-lab lanes intact; this adds a real-OS deterministic regression layer (it does **not** satisfy live-verification policy — only R3 does).
6. Add regression tests asserting decomposed modules re-export the same public API surface as before.

**Exit gate:**
- `npm run lint`, `npm run test`, `npm run test:release` all green.
- `npm run typecheck` exists and passes (no source converted yet).
- New cross-OS CI matrix green on a sample PR.
- SBOM artifact produced on release lane.
- No public claim wording changes.

**Rollback:** Each decomposition task is one commit; revert independently. TS setup is additive; remove `tsconfig.json` + `typecheck` script if abandoned.

### Phase M2 — TypeScript layered per-package migration

**Goal:** Convert packages to TS in dependency order, leaving JS/TS coexistence permitted during the transition.

**Tasks (each is a sub-gate):**
1. `packages/core/spec-core` → TS first (schemas, pack-catalog, read-authority, validate). Emit `.d.ts` and JS dist. Update importers to consume dist.
2. `packages/core/contract-engine` → TS.
3. `packages/core/policy-engine` → TS.
4. `packages/core/memory-engine` → TS (after M1 decomposition).
5. `packages/runtimes/codex/*` and `packages/runtimes/copilot/*` → TS together (parallel sub-phase).
6. `packages/tools/installer` → TS.
7. `packages/tools/doctor` → TS.
8. `packages/tools/cli` → TS last (depends on all above).
9. Each sub-gate: `npm run typecheck` green, `npm run test` green, no behavioral diff.

**Exit gate (overall M2):**
- All packages in `packages/core/*`, `packages/runtimes/*`, `packages/tools/*` compile under TS.
- Public runtime behavior unchanged (CLI tests + acceptance gates unchanged).
- `npm run typecheck` is part of `repo-checks.yml`.

**Rollback:** Per-package — a package can be reverted to JS independently because JS/TS coexistence is permitted.

---

## Track P — Stage-toward-publish (gated)

**Gate:** P1 may begin only after R1 + R2 + R3 exit gates are green (verdicts moved, at least one lane at `preview`). This honors the charter anti-drift rule that README/install docs must not imply package publication while manifests stay `private: true`.

### Phase P1 — Publish infrastructure (posture not flipped yet)

**Goal:** Have all infra ready so flipping `private: true` is a one-line, one-commit decision when the maintainer chooses.

**Tasks:**
1. Add `publishConfig` (registry, access scope `@pairslash`) to root and PairSlash-owned package manifests, gated behind an env flag (e.g., `PAIRSLASH_PUBLISH_READY=1`) so they remain inert by default.
2. Add `prepublishOnly` + `prepare` build scripts producing a `dist/` artifact for `@pairslash/cli` (ESM bundle via `esbuild` or `tsup`, plus type declarations from M2).
3. Add `NOTICE` file at repo root (currently absent per `docs/releases/legal-packaging-status.md`); the file's content is governed by the legal/package boundary doc, not invented here.
4. Add `npm publish --dry-run` smoke step to `release-trust-candidate.yml` (does not actually publish; verifies the manifest is publishable when the day comes).
5. Add a `docs/releases/publication-readiness-checklist.md` that records the exact gate conditions under which the maintainer may flip posture (R1+R2+R3 exit + legal sign-off + scoped-release GO).
6. **Do not** flip `private: true`. **Do not** update README to claim publication.

**Exit gate:**
- `npm publish --dry-run` succeeds end-to-end on the candidate lane.
- `NOTICE` exists and is referenced by `docs/releases/legal-packaging-status.md`.
- `publication-readiness-checklist.md` exists with explicit gate conditions.
- Public wording unchanged (still "repo-local install path").

**Rollback:** All P1 changes are additive; revertible independently. The actual posture flip is a separate, future commit gated on the checklist.

---

## Track A — Advanced packages build-out (gated)

**Gate:** A1 may begin only after M2 spec-core is TS-converted (advanced packages will import spec-core types) and after R3 has captured at least one live lane (so policy gating has a real lane to test against).

Charter constraint reminder: every advanced slice must remain **opt-in**, **explicit-invocation**, and must **not** become a competing front door beside `/skills`. They stay out of the core install path and the default catalog.

### Phase A1 — retrieval-engine + retrieval-index + retrieval-skill

**Goal:** Promote the retrieval family from `design-only` scaffold to implemented, workspace-included slice.

**Tasks:**
1. Add `packages/advanced/retrieval-engine`, `retrieval-index`, `retrieval-skill` to a **separate** workspace group (do **not** add to root `workspaces` until M2-equivalent test coverage exists; use a dedicated `packages/advanced/*/package.json` with `private: true`).
2. retrieval-engine: explicit-invocation read-only slice with policy gating (reuse `@pairslash/policy-engine`), non-authoritative result envelopes (tagged `supporting` per Phase 17 read-authority charter, never `authoritative`).
3. retrieval-index: deterministic indexer over `.pairslash/project-memory/`, `.pairslash/task-memory/`, `.pairslash/staging/` — produces an on-disk index under `.pairslash/observability/` only; never writes to `project-memory/`.
4. retrieval-skill: an opt-in advanced skill descriptor; installable only via explicit `--pack` flag, never via `--pack-set core` or `--all`.
5. Tests: policy gating prevents authoritative writes; non-authoritative labeling is enforced; index is read-only over project-memory.
6. Lint extension: lint fails closed if retrieval-engine ever imports memory-engine's write pipeline.

**Exit gate:**
- retrieval slice is callable via explicit invocation only.
- Policy engine blocks any write attempt.
- Tests green; charter regression check (no third runtime, no competing front door) green.
- `packages/advanced/README.md` reflects the promoted status with `experimental` label.

**Rollback:** Advanced packages are workspace-opt-in; remove from workspace list to disable without touching core.

### Phase A2 — ci-engine implemented slice

**Goal:** Promote ci-engine from scaffold to implemented opt-in CI slice with report-first outputs and proposal-only patches.

**Tasks:**
1. Implement report-first outputs (CI run produces a structured report, never an auto-applied patch).
2. Policy gating reuses `@pairslash/policy-engine`; patches are proposal artifacts only (`patches/*.patch` written to `.pairslash/staging/ci-proposals/`, never applied).
3. Provenance metadata recorded per proposal (commit SHA, run ID, capability declarations).
4. Tests: proposal-only invariant, no apply path, provenance completeness.

**Exit gate:** Same shape as A1 (explicit-invocation, policy-gated, non-authoritative, tests green).

### Phase A3 — delegation-engine implemented slice

**Goal:** Promote delegation-engine from scaffold to implemented opt-in slice with authority-subset checks and non-authoritative result envelopes.

**Tasks:**
1. Explicit delegation policy (sub-agent may operate only within a declared authority subset).
2. Authority-subset checks against `@pairslash/policy-engine` and `trust/pack-authority.yaml`.
3. Result envelopes tagged non-authoritative; any authoritative action must route back through the canonical `pairslash-memory-write-global` pipeline.
4. Tests: authority-subset violation blocks; non-authoritative labeling enforced; no implicit promotion path.

**Exit gate:** Same shape as A1/A2.

---

## Track O — Operational automation (gated on M1)

**Gate:** O1 may begin after M1 (decomposed modules + typecheck script) so the sync tooling can be TS-friendly.

### Phase O1 — Evidence-promotion sync workflow + test depth

**Goal:** Eliminate the manual 5–7-file sync on every truth-layer change, and broaden regression coverage.

**Tasks:**
1. **One-command evidence-promotion sync:** a new CLI subcommand `pairslash sync-truth --lane <id> --bump-evidence <class>` that updates `runtime-surface-matrix.yaml`, regenerates `compatibility-matrix.md`, updates the relevant lane record YAML/MD, and updates `pack.manifest.yaml` `workflow_evidence.live_workflow_refs` for affected packs — all behind `--preview` by default (preview-first per charter).
2. **Perf regression tests:** add `tests/perf/` with a small benchmark suite pinning install/preview/memory-write latency baselines; wire into `nightly-smoke` only.
3. **Mutation testing pilot:** add `stryker` (or equivalent) scoped to `packages/core/memory-engine` only; report mutation score, do not gate CI on it yet.
4. **Fuzzing pilot:** add a fuzz harness for memory-engine conflict detection (`tests/fuzz/memory-conflict.fuzz.js`) using `fast-check` or equivalent; nightly-only.

**Exit gate:**
- `pairslash sync-truth --preview` produces a correct multi-file patch for a sample lane bump.
- Perf/mutation/fuzz pilots run nightly without breaking `npm run test`.
- Public wording unchanged.

**Rollback:** Each O1 task is independently revertible; the sync subcommand defaults to `--preview` and never mutates without `--apply`.

---

## 5. Cross-cutting risks

| Risk | Mitigation |
| --- | --- |
| Charter drift: a phase accidentally overclaims. | Every phase exit gate includes "public wording unchanged unless verdict explicitly moved"; charter regression tests are part of `npm run test`. |
| TS migration introduces subtle behavioral drift. | Each M2 sub-gate keeps the package's existing test suite as the contract; JS/TS coexistence permits per-package rollback. |
| Advanced slice becomes a competing front door. | A1/A2/A3 stay workspace-opt-in, never in `--pack-set core` / `--all`; lint rule blocks write-pipeline imports. |
| Publish posture flipped prematurely. | P1 explicitly forbids the flip; checklist gates the future flip on R1+R2+R3 + legal sign-off. |
| Real macOS/Windows CI minutes cost. | M1 adds them only to the deterministic acceptance lane (not every PR's lint); nightly-smoke absorbs deeper runs. |
| Manual `/skills` capture is unreproducible. | R3 follows the runbook's scripted-allowed vs manual-required boundary exactly; lane record schema enforces required fields. |
| Single-maintainer bottleneck for live evidence. | R3 captures one lane first (Codex macOS) to prove the loop; broader rollout deferred after the loop is validated. |

## 6. Validation plan (per phase)

Every phase must demonstrate:
1. `npm run lint` green.
2. `npm run test` green.
3. `npm run test:release` green (where the phase touches release-relevant surfaces).
4. `npm run sync:compat-lab -- --check` green (where the phase touches compatibility surfaces).
5. Charter regression checks (`tests/` truth-governance suite) green.
6. A dated entry in the phase's evidence/audit trail under `.pairslash/audit-log/` or the relevant docs evidence path.

## 7. Open questions for implementation agent

These are left for the implementing agent to resolve within the constraints of this plan; they do not block plan finalization:

- **O1 sync subcommand naming:** confirm `sync-truth` does not collide with existing `sync:compat-lab` script semantics.
- **M1 SBOM format:** CycloneDX vs SPDX — pick based on what release-trust bundle consumers expect (likely CycloneDX; verify against `docs/releases/scoped-release-verdict.md` consumer assumptions).
- **M2 module resolution:** confirm TS `moduleResolution: bundler` vs `node16` is compatible with the existing ESM + workspace `imports` usage in `packages/tools/cli/src/bin/pairslash.js`.
- **A1 retrieval-index storage location:** `.pairslash/observability/` is proposed; confirm it does not collide with existing trace storage under the same prefix.
- **R2 signing key custody:** where the first-party private key is stored outside GitHub Actions secrets (offline HSM / hardware key) — out of scope for code but required before P1 exit.

## 8. Sequencing summary

```
Now      → R1 (benchmark round 1)
          → R2 (protected signing lane)        ┐ can run in parallel with R1
          → R3 (live /skills capture, 1 lane)  ┘
M1       → modernization foundation (TS setup, decompose, SBOM, cross-OS CI)
M2       → TS per-package migration (spec-core → ... → cli)
O1       → sync-truth + perf/mutation/fuzz  (after M1)
[gate R1+R2+R3 GO]
P1       → publish infra (no posture flip)
[gate M2 done + R3 done]
A1       → retrieval slice
A2       → ci-engine slice
A3       → delegation slice
```

The single most important next action is **R1**: running the first official Phase 19 benchmark round. Everything else is preparatory or downstream of the three verdict unblocks.
