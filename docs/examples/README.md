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

## Public status

These examples are runnable documentation only.
They are not public benchmark proof, case-study proof, or product-validation evidence.

Guardrails:

- Do not claim runtime parity from these assets.
- Do not claim benchmark wins from these assets.
- Keep `/skills` as the canonical workflow entrypoint in every runnable example.
