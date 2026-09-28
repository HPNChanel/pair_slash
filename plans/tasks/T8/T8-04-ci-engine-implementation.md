---
id: T8-04
track: T8
title: ci-engine — report-first outputs + proposal-only patches
status: todo
depends_on: []
est_size: M
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Implement `packages/advanced/ci-engine` as a TS slice: CI-run structured reports plus proposal-only patch artifacts written to `.pairslash/staging/ci-proposals/` — never auto-applied.

## Context & sources

- Current: `src/{capabilities,index,policy-contract,runner}.js` scaffold.
- Requirements (July A2): report-first output; policy gating via policy-engine; patches = proposal artifacts under staging only; provenance per proposal (commit SHA, run ID, capabilities).
- `packs/advanced/ci/contract.md` is the intent source.

## Files to touch

- `packages/advanced/ci-engine/src/*.js` → `.ts` + implement
- `packages/advanced/ci-engine/package.json`, tests
- `.pairslash/staging/` conventions — proposals dir usage
- Do NOT touch: CI workflows themselves (engine analyzes/reports; it doesn't rewrite CI), apply-anything paths (none exist — by design)

## Work steps

1. Read scaffold + contract; design report shape (run summary, findings, proposal refs).
2. Implement: ingest CI state (from provided inputs — file/command output, not network calls), produce structured report; proposals emitted as `patches/*.patch`-equivalent artifacts under staging/ci-proposals with provenance metadata.
3. Policy gate: any apply-shaped operation → deny (there is no apply path — assert structurally).
4. Strict-clean TS; tests: proposal-only invariant (no write path exists outside staging), provenance completeness, report determinism.
5. Gates.

## Constraints (STRICT)

- MUST NOT have an apply path — proposals are files in staging; application is a human decision outside the engine (charter).
- Provenance REQUIRED per proposal: commit SHA, run id, capability declarations — incomplete provenance = invalid proposal (fail closed).
- Reports deterministic; proposals clearly marked non-authoritative.
- MUST NOT touch CI config files — analysis only.

## Acceptance gates

- [ ] Report + proposal artifacts generated; no apply path exists (test asserts)
- [ ] Provenance fields enforced
- [ ] Gates green

## Evidence to record

- Report/proposal examples; invariant test results.

## Rollback

`git revert`.
