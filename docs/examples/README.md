# Examples

`docs/examples/` is documentation-oriented and non-authoritative.

Phase 4 regression truth for compiler/install/doctor lives under `packages/tools/compat-lab/`.

Current mapping:

- `docs/examples/node-api` relates to `repo-basic-readonly`
- `docs/examples/rails-service` relates to `repo-backend-mcp`
- `docs/examples/monorepo` relates to `repo-monorepo-workspaces`

Write-authority and conflict fixtures are intentionally kept only in `packages/tools/compat-lab/` because they are CI guardrails rather than user-facing starter examples.

Use `docs/runtime-mapping/` together with these examples when you need the
runtime-native surface map for Codex or Copilot installs.

## Phase 9 Proof Index

Do not treat these example assets as benchmark evidence by default.
Official benchmark evidence remains governed by:

- `docs/validation/phase-3-5/benchmark-tasks.md`
- `docs/validation/phase-3-5/scoring-rubric.md`
- `docs/validation/phase-3-5/evidence-log.md`

Current proof-layer registry:

| Asset | Workflow | Runtime lane | Evidence status | Classification |
| --- | --- | --- | --- | --- |
| `docs/examples/node-api` | `pairslash-plan` | `codex-cli` repo | `not-measured` | not-yet-validated example |
| `docs/examples/monorepo` | `pairslash-onboard-repo` | `codex-cli` repo | `not-measured` | not-yet-validated example |
| `docs/examples/rails-service` | `pairslash-backend` | `codex-cli` repo | `not-measured` | not-yet-validated example |
| `docs/case-studies/onboard-repo-before-after.md` | `pairslash-onboard-repo` | primary: `codex-cli` repo | `not-measured` | measured before/after placeholder |
| `docs/case-studies/memory-write-global-trust-event.md` | `pairslash-memory-candidate -> pairslash-memory-write-global` | primary: `codex-cli` repo | `not-measured` | measured before/after placeholder |
| `docs/case-studies/failure-mode-runtime-mismatch.md` | `pairslash-plan` plus doctor/support flow | `copilot-cli` prompt-mode and Windows prep lanes | `not-measured` | failure-case placeholder |

Guardrails:

- Do not claim runtime parity from these assets.
- Do not claim benchmark wins until measured fields are filled with artifact refs and run IDs.
- Keep `/skills` as the canonical workflow entrypoint in every runnable example.
