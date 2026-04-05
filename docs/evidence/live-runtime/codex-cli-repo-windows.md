# Codex CLI repo Windows

- Lane: `codex_cli` / `repo` / `Windows`
- Current public support level: `prep`
- Required evidence class for promotion: `live_verification`
- Best checked-in live evidence class today: `live_smoke`
- Live evidence status: real Windows doctor and preview smoke were recorded on
  2026-04-05, but install apply and canonical `/skills` remain unrecorded
- Claim consequence: keep Windows in doctor/preview prep only

## Deterministic evidence

- `docs/runtime-mapping/pilot-acceptance.md`
- `packages/tools/compat-lab/tests/acceptance.test.js`
- `packages/tools/compat-lab/tests/matrix.test.js`

## Fake/shim evidence

- `packages/tools/compat-lab/src/runtime-fixtures.js`
- `packages/tools/compat-lab/src/acceptance.js`

## Live evidence

- `2026-04-05T12:28:24.545Z`: `npm run pairslash -- doctor --runtime codex --target repo --format json`
- `2026-04-05T12:28:31.982Z`: `npm run pairslash -- preview install pairslash-plan --runtime codex --target repo --format json`
- Machine-readable sidecar: `docs/evidence/live-runtime/codex-cli-repo-windows.yaml`

## Claim guard

- Doctor and preview are useful here, but they are not install or `/skills`
  proof.
- Do not upgrade this lane from `prep` until a checked-in Windows live runtime
  record exists.
