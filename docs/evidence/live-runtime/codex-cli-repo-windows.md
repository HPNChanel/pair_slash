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

- `packages/tools/compat-lab/src/runtime-fixtures.ts`
- `packages/tools/compat-lab/src/acceptance.ts`

## Live evidence

- `2026-04-05T12:28:24.545Z`: `npm run pairslash -- doctor --runtime codex --target repo --format json`
- `2026-04-05T12:28:31.982Z`: `npm run pairslash -- preview install pairslash-plan --runtime codex --target repo --format json`
- `2026-09-28`: `codex --version` → `codex-cli 0.153.4` (runtime version capture only; not an install or `/skills` record)
- Machine-readable sidecar: `docs/evidence/live-runtime/codex-cli-repo-windows.yaml`

## Known-issue retest protocols (recorded 2026-09-28)

### K3 — Codex read-only sandbox rejects complex PowerShell (status: degraded, retest pending)

Codex CLI `0.153.4` is installed and authenticated on this host, but the retest
run was rejected by host usage quota (`codex exec` reported "You've hit your
usage limit"), so the sandbox behavior could not be exercised. When quota is
available, run from a scratch directory:

```bash
codex exec --sandbox read-only --skip-git-repo-check \
  "Run exactly one shell command: powershell -NoProfile -Command \"\$items = @('a','b'); foreach (\$i in \$items) { Write-Output \$i }\". Report whether the sandbox allowed or rejected it."
```

Resolution verdict requires: the multi-statement command (variables plus a
`foreach`/`if` block) executes under `--sandbox read-only` on the real
runtime — an allowed simple single-statement command alone does not resolve K3.

## Claim guard

- Doctor and preview are useful here, but they are not install or `/skills`
  proof.
- Do not upgrade this lane from `prep` until a checked-in Windows live runtime
  record exists.
