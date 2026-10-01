# Track T9 — Ops automation (O1 carried forward)

**Status:** Done (2026-10-01) | **Priority:** P3 | **Depends on:** T5 decomposition complete (T5-01…T5-04)
**Goal:** Eliminate the manual 5–7-file truth sync on every evidence promotion, and add perf/mutation/fuzz depth to the nightly lane — all preview-first per charter.

## Context

Every truth-layer change currently requires hand-editing `runtime-surface-matrix.yaml`, regenerating `compatibility-matrix.md`, updating lane records, and touching `pack.manifest.yaml` `workflow_evidence` refs. T1 executes this manually once; T9 automates the repeatable version. Perf/mutation/fuzz pilots broaden regression depth without gating PRs.

## Entry gate

- T5-01…T5-04 decompositions done (sync tooling lands on decomposed modules).

## Tasks (ordered)

| Task | Title | Depends on |
| --- | --- | --- |
| T9-01 | `pairslash sync-truth` subcommand — preview-first multi-file promotion | — |
| T9-02 | Perf regression suite (`tests/perf/`, nightly-only) | — |
| T9-03 | Mutation testing pilot scoped to memory-engine (report-only) | — |
| T9-04 | Fuzz harness for memory conflict detection (nightly-only) | — |

## Exit gate

- `pairslash sync-truth --preview` produces a correct multi-file patch for a sample evidence bump; `--apply` writes atomically with journal.
- Perf/mutation/fuzz pilots run under `nightly-smoke` without affecting `npm run test` duration materially.
- Public wording unchanged; no new capability is claimed (C.6).

## Risks

- `sync-truth` touches many truth files — its preview must be a real patch diff, and apply must refuse partial states (atomic journal).
- New devDependencies (stryker / fast-check or equivalents) need G9 review — prefer pinned versions ≥7 days old; report-only, never gating.
