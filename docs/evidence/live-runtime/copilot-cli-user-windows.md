# GitHub Copilot CLI user Windows

- Lane: `copilot_cli` / `user` / `Windows`
- Current public support level: `prep`
- Required evidence class for promotion: `live_verification`
- Best checked-in live evidence class today: `live_smoke`
- Live evidence status: a real Windows host probe was captured on 2026-04-05,
  but `gh` was unavailable and preview blocked explicitly
- Claim consequence: keep Windows in doctor/preview prep only

## Deterministic evidence

- `docs/runtime-mapping/pilot-acceptance.md`
- `packages/tools/compat-lab/tests/acceptance.test.js`
- `packages/tools/compat-lab/tests/matrix.test.js`

## Fake/shim evidence

- `packages/tools/compat-lab/src/runtime-fixtures.js`
- `packages/tools/compat-lab/src/acceptance.js`

## Live evidence

- `2026-04-05T12:28:23.177Z`: `npm run pairslash -- doctor --runtime copilot --target user --format json`
- `2026-04-05T12:28:38.519Z`: `npm run pairslash -- preview install pairslash-plan --runtime copilot --target user --format json`
- Machine-readable sidecar: `docs/evidence/live-runtime/copilot-cli-user-windows.yaml`

## Claim guard

- The current negative evidence is host-specific and does not promote or
  globally block the lane.
- Doctor and preview are useful here, but they are not install or `/skills`
  proof.
- Do not upgrade this lane from `prep` until a checked-in Windows live runtime
  record exists.
