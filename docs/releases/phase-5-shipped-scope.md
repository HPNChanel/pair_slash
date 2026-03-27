# Phase 5 Shipped Scope (Maintainer Notes)

## What is shipped

- `contract-engine` now emits machine-readable workflow contracts for input/output/failure/memory/tool/capability scope.
- `policy-engine` evaluates machine-readable verdicts (`allow | ask | deny | require-preview`) with explainable reasons and no-silent-fallback semantics.
- `memory-engine` enforces authoritative write pipeline for `pairslash-memory-write-global`:
  - schema validation
  - related record lookup
  - duplicate/conflict detection
  - scope validation
  - preview patch generation
  - explicit approval gate
  - commit path
  - audit log append
  - deterministic memory index update
- `runtime-codex-adapter` and `runtime-copilot-adapter` enforce contract+policy at runtime adapter layer with structured refusals.
- CLI gates are usable:
  - `pairslash lint`
  - `pairslash preview`
  - `pairslash memory write-global`

## Invariants enforced

- Canonical entrypoint stays `/skills` on both runtimes.
- Only two runtimes are supported: `codex_cli` and `copilot_cli`.
- Read-oriented workflows cannot acquire authoritative memory write.
- No hidden authoritative memory writes.
- No silent fallback when capability/runtime surface is unsupported.
- Authoritative writes require preview and explicit approval before apply.

## Regression coverage in repo

- Conflict detection: `packages/core/memory-engine/tests/memory-engine.test.js` and `tests/phase5/phase5.hardening-sweep.test.js`
- Duplicate detection: `packages/core/memory-engine/tests/memory-engine.test.js` and `tests/phase5/phase5.hardening-sweep.test.js`
- No-silent-fallback: `packages/core/policy-engine/tests/policy-engine.test.js`, `tests/preview/preview.command.test.js`, and `tests/phase5/phase5.hardening-sweep.test.js`
- Preview mandatory: `packages/core/policy-engine/tests/policy-engine.test.js`, `packages/tools/cli/tests/cli.test.js`, and `tests/phase5/phase5.hardening-sweep.test.js`
- Runtime capability mismatch: `packages/core/contract-engine/tests/contract-engine.test.js`, runtime adapter tests, and `tests/phase5/phase5.hardening-sweep.test.js`

## Known gaps (current)

- Runtime compatibility statuses still include `unverified` in several packs, so lint emits non-blocking warnings (`LINT-RUNTIME-004`) until runtime evidence is promoted.
- Windows lanes remain prep/degraded in doctor/compat evidence unless additional live runtime verification is recorded.

## RC readiness

- Verdict: `READY`
- Audit basis:
  - `node scripts/run-phase4-tests.mjs`
  - `npm run pairslash -- lint --runtime all --target repo --format json`
  - `npm run pairslash -- preview install pairslash-plan --runtime codex --target repo --format json`
  - `npm run pairslash -- memory write-global ... --apply --yes` without a staged preview stays blocked with explicit `preview-required`
- Accepted risks before Phase 6:
  - `LINT-RUNTIME-004` warnings remain evidence-bound and do not silently promote runtime support.
  - Windows remains a prep/degraded evidence lane rather than a fully verified live runtime lane.
