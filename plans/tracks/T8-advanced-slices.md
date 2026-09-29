# Track T8 — Advanced slices: retrieval → ci → delegation

**Status:** Done (6/6 tasks, 2026-09-29) | **Priority:** P3 | **Depends on:** T5 (spec-core strict-clean)
**Goal:** Promote `packages/advanced/{retrieval-engine,retrieval-index,retrieval-skill,ci-engine,delegation-engine}` from `.js` scaffolds to implemented, opt-in, policy-gated slices — without letting them into the core install path or default catalog.

## Context

Charter constraints on advanced slices (from CLAUDE.md §15/§16 + ADR-0002 intent): opt-in only, explicit-invocation only, never authoritative, never a competing front door, never silently promoted. Sequence: retrieval first (semantic memory search = core product value), ci-engine second (adoption leverage), delegation last (governance-heavy). New context since July: Copilot custom agents/subagents (CP-06) and Codex multi-agent infra (CX-20) are now real surfaces delegation design can reference — still gated.

## Entry gate

- T5 done (advanced slices import spec-core types; they must not inherit relaxed-typing debt).
- No public claim change — slices stay `experimental`/design-labeled until T6 evidence exists.

## Tasks (ordered)

| Task | Title | Depends on |
| --- | --- | --- |
| T8-01 | retrieval-engine → TS + policy gating + non-authoritative envelopes | — |
| T8-02 | retrieval-index: deterministic indexer over `.pairslash/` read-only surfaces | T8-01 |
| T8-03 | retrieval-skill: opt-in descriptor + explicit `--pack` install path | T8-02 |
| T8-04 | ci-engine: report-first outputs, proposal-only patches to staging | — |
| T8-05 | delegation-engine: authority-subset checks vs policy-engine + pack-authority | — |
| T8-06 | Advanced README/catalog sync + experimental labeling | T8-01…T8-05 |

## Exit gate

- Each implemented slice: callable only via explicit invocation; policy engine blocks any authoritative write; tests green incl. a charter regression (no third runtime, no competing front door, no hidden write path).
- `packages/advanced/README.md` reflects real status with `experimental` labels.
- Lint rule: advanced packages importing memory-engine's write pipeline fails closed.
- Workspace inclusion only after each slice has test coverage — per-slice opt-in.

## Risks

- Retrieval index storage colliding with trace storage under `.pairslash/observability/` — T8-02 verifies the layout boundary first.
- Delegation toward subagents could look like a third runtime path — keep envelopes strictly non-authoritative; route all durable writes back through `pairslash-memory-write-global` (C.3).
- These remain `.js`-era scaffolds — migrating to TS is part of each task, not a separate track.
