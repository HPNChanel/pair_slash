# Codex CLI repo Windows

- Lane: `codex_cli` / `repo` / `Windows`
- Current public support level: `prep`
- Required evidence class for promotion: `live_verification`
- Best checked-in live evidence class today: `live_smoke`
- Live evidence status: real Windows doctor and preview smoke were recorded on
  2026-04-05 and re-run on 2026-09-29; install apply smoke was recorded on
  2026-09-29; canonical `/skills` picker verification remains unrecorded
- Claim consequence: keep Windows in prep until canonical picker evidence lands

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
- `2026-09-29T12:44:00Z`: `npm run pairslash -- doctor --runtime codex --target repo --format json` → support_verdict=degraded, install_blocked=false, codex_cli available at 0.153.4
- `2026-09-29T12:44:30Z`: `npm run pairslash -- preview install pairslash-plan --runtime codex --target repo --format json` → can_apply=true, status needs-explicit-approval
- `2026-09-29T12:46:04Z`: `install pairslash-plan --runtime codex --target repo --apply --yes` executed from a scratch mirror of this repo (temp dir) — 9 managed files written under `.agents/skills/pairslash-plan/`, journal + `repo-codex_cli.json` state written; real codex host detected at 0.153.4
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

- Doctor, preview, and install-apply are live smoke proof here, but they are
  not canonical `/skills` picker proof.
- Do not upgrade this lane from `prep` until canonical picker evidence is
  recorded (`canonical_skills_listing`, `workflow_selection_from_skills`,
  `workflow_prompt_and_response_capture`, `memory_write_preview_observation`
  remain manual-required steps per runbook policy).
