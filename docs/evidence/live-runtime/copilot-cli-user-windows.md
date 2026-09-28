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

- `packages/tools/compat-lab/src/runtime-fixtures.ts`
- `packages/tools/compat-lab/src/acceptance.ts`

## Live evidence

- `2026-04-05T12:28:23.177Z`: `npm run pairslash -- doctor --runtime copilot --target user --format json`
- `2026-04-05T12:28:38.519Z`: `npm run pairslash -- preview install pairslash-plan --runtime copilot --target user --format json`
- `2026-09-28`: host re-probe — `gh` 2.96.0 present, `gh copilot --help` exits 0 via the
  built-in wrapper, but the `copilot` binary is absent; wrapper presence is not
  Copilot CLI proof (negative observation, not a promotion record)
- Machine-readable sidecar: `docs/evidence/live-runtime/copilot-cli-user-windows.yaml`

## Known-issue retest protocols (recorded 2026-09-28)

### K1 — Copilot direct invocation with `-p`/`--prompt` (status: blocked, retest pending)

The `copilot` binary is absent on this host (`gh copilot --version` reports
"! Copilot CLI not installed"), so no live retest was possible. On a host with
Copilot CLI installed, run:

1. `npm run pairslash -- install pairslash-plan --runtime copilot --target user --apply --yes`
   (records an install into the user lane).
2. `copilot -p "/pairslash-plan give me a one-line repo plan" --output-format json`
   from the repo root; capture whether the plugin-installed skill is visible
   and executes in prompt mode.
3. Control: `copilot -p "what is 2+2"` to confirm `-p` itself works.
4. Resolution verdict requires: the installed skill executes under `-p` on the
   real runtime — changelog claims (CP-07/CP-17) alone do not resolve K1.

## Claim guard

- The current negative evidence is host-specific and does not promote or
  globally block the lane.
- Doctor and preview are useful here, but they are not install or `/skills`
  proof.
- Do not upgrade this lane from `prep` until a checked-in Windows live runtime
  record exists.
