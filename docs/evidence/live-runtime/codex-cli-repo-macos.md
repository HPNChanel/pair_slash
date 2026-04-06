# Codex CLI repo macOS

- Lane: `codex_cli` / `repo` / `macOS`
- Current public support level: `degraded`
- Required evidence class for promotion: `live_verification`
- Best checked-in live evidence class today: `live_smoke`
- Live evidence status: archived direct-invocation evidence exists for Codex CLI
  `0.116.0`, but canonical `/skills` proof is still unrecorded
- Claim consequence: do not tell a `stable-tested` story for this lane until a
  fresh canonical `/skills` verification is checked in

## Deterministic evidence

- `docs/runtime-mapping/pilot-acceptance.md`
- `packages/tools/compat-lab/tests/acceptance.test.js`
- `packages/tools/compat-lab/tests/matrix.test.js`

## Fake/shim evidence

- `packages/tools/compat-lab/src/runtime-fixtures.js`
- `packages/tools/compat-lab/src/acceptance.js`

## Live evidence

- `.pairslash/project-memory/60-architecture-decisions/phase-0-codex-cli-verification-on-v0-116-0.yaml`
- `.pairslash/project-memory/70-known-good-patterns/codex-exec-as-non-interactive-skill-testing-surface.yaml`
- Machine-readable sidecar: `docs/evidence/live-runtime/codex-cli-repo-macos.yaml`

## Claim guard

- The archived live run was done through `codex exec`, not a checked-in
  canonical `/skills` picker capture.
- A one-off archived run is not enough for a `stable-tested` claim.
- Doctor, preview, and compat-lab output do not refresh this lane by
  themselves.
