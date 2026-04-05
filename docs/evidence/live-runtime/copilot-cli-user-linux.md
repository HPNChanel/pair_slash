# GitHub Copilot CLI user Linux

- Lane: `copilot_cli` / `user` / `Linux`
- Current public support level: `prep`
- Required evidence class for promotion: `live_verification`
- Best checked-in live evidence class today: none recorded
- Live evidence status: none recorded
- Claim consequence: keep this lane `prep` until a checked-in canonical
  `/skills` verification exists

## Deterministic evidence

- `docs/runtime-mapping/pilot-acceptance.md`
- `packages/tools/compat-lab/tests/acceptance.test.js`
- `packages/tools/compat-lab/tests/matrix.test.js`

## Fake/shim evidence

- `packages/tools/compat-lab/src/runtime-fixtures.js`
- `packages/tools/compat-lab/src/acceptance.js`

## Live evidence

- None recorded for the exact Linux user lane.
- Machine-readable sidecar: `docs/evidence/live-runtime/copilot-cli-user-linux.yaml`

## Claim guard

- Compat-lab acceptance proves deterministic installability coverage only.
- No checked-in `/skills` interaction record exists yet for GitHub Copilot CLI
  on Linux user scope.
- Keep release and onboarding wording explicit that this lane is `prep`, not
  parity with any stronger lane.
