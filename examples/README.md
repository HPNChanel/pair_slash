# PairSlash Phase 9 Example Assets Index

This index is for first-wave public example assets used by the Phase 9 proof
layer.

Do not treat this directory as benchmark evidence by default.
Official benchmark evidence remains governed by:

- `docs/validation/phase-3-5/benchmark-tasks.md`
- `docs/validation/phase-3-5/scoring-rubric.md`
- `docs/validation/phase-3-5/evidence-log.md`

## Asset Registry

| Asset | Workflow | Runtime lane | Evidence status | Classification |
| --- | --- | --- | --- | --- |
| `docs/examples/node-api` | `pairslash-plan` | `codex-cli` repo | `not-measured` | not-yet-validated example |
| `docs/examples/monorepo` | `pairslash-onboard-repo` | `codex-cli` repo | `not-measured` | not-yet-validated example |
| `docs/examples/rails-service` | `pairslash-backend` | `codex-cli` repo | `not-measured` | not-yet-validated example |
| `docs/case-studies/onboard-repo-before-after.md` | `pairslash-onboard-repo` | primary: `codex-cli` repo | `not-measured` | measured before/after placeholder |
| `docs/case-studies/memory-write-global-trust-event.md` | `pairslash-memory-candidate -> pairslash-memory-write-global` | primary: `codex-cli` repo | `not-measured` | measured before/after placeholder |
| `docs/case-studies/failure-mode-runtime-mismatch.md` | `pairslash-plan` plus doctor/support flow | `copilot-cli` prompt-mode and Windows prep lanes | `not-measured` | failure-case placeholder |

## Where To Log Measurement

- Benchmark index: [docs/benchmarks/README.md](../docs/benchmarks/README.md)
- Case-study taxonomy: [docs/case-studies/README.md](../docs/case-studies/README.md)
- Phase 9 proof plan: [docs/phase-9/examples-and-benchmarks.md](../docs/phase-9/examples-and-benchmarks.md)

## Guardrails

- Do not claim runtime parity from these assets.
- Do not claim benchmark wins until measured fields are filled with artifact
  refs and run IDs.
- Keep `/skills` as the canonical workflow entrypoint in every runnable
  example.
