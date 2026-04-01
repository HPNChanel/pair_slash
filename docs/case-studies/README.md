# Phase 9 Case Studies Index

This directory contains evidence scaffolds for public proof assets.

Case studies must always state what is measured, what is anecdotal, and what
is not yet validated.

## Classification Rules

| Classification | Meaning | Allowed public usage |
| --- | --- | --- |
| measured before/after | paired baseline vs PairSlash comparison with artifact refs | can support narrow public claims |
| anecdotal notes | qualitative feedback without full paired measurement | context only, not a benchmark claim |
| not-yet-validated example | placeholder or runnable example without completed benchmark schema | onboarding aid only, no performance claim |

## Case Study Registry

| File | Workflow | Runtime lane | Evidence status | Classification |
| --- | --- | --- | --- | --- |
| `docs/case-studies/onboard-repo-before-after.md` | `pairslash-onboard-repo` | primary: `codex-cli` repo | `not-measured` | measured before/after placeholder |
| `docs/case-studies/memory-write-global-trust-event.md` | `pairslash-memory-candidate -> pairslash-memory-write-global` | primary: `codex-cli` repo | `not-measured` | measured before/after placeholder |
| `docs/case-studies/failure-mode-runtime-mismatch.md` | `pairslash-plan` plus doctor/support | `copilot-cli` prompt-mode and Windows prep lanes | `not-measured` | failure-case placeholder |

## Cross-Links

- Benchmark index: [docs/benchmarks/README.md](../benchmarks/README.md)
- Phase 9 proof plan: [docs/phase-9/examples-and-benchmarks.md](../phase-9/examples-and-benchmarks.md)
- Phase 9 onboarding path: [docs/phase-9/onboarding-path.md](../phase-9/onboarding-path.md)

## Guardrails

- Do not write success narrative text into placeholders.
- Do not mark a case as measured without explicit run IDs and artifact refs.
- Keep runtime lane tags aligned with `docs/compatibility/compatibility-matrix.md`.
