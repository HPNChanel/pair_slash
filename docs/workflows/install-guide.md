# PairSlash Install Guide

Install PairSlash workflows into Codex CLI or GitHub Copilot CLI using the
managed Phase 4 command surface.

`/skills` is the canonical entrypoint after install on both runtimes.

## Fast path (time-to-first-success)

Use:

1. `doctor`
2. `preview install`
3. `install --apply`
4. `/skills` -> first workflow

For the shortest onboarding path, use `docs/workflows/phase-4-quickstart.md`.
For the broader operations flow, use `docs/workflows/phase-2-operations.md`.
For runtime evidence and guardrails, use `docs/compatibility/runtime-verification.md`.

## Managed lifecycle commands

```bash
node packages/cli/src/bin/pairslash.js doctor --runtime codex --target repo
node packages/cli/src/bin/pairslash.js preview install --runtime codex --target repo --plan-out .pairslash/tmp/install-plan.json
node packages/cli/src/bin/pairslash.js install --runtime codex --target repo --apply --yes
node packages/cli/src/bin/pairslash.js doctor --runtime codex --target repo
```

Swap `--runtime codex` for `--runtime copilot` and `--target repo` for
`--target user` when that is your lane.

## Default pack selection

- `pairslash install` with no pack id uses bootstrap pack-set (currently `pairslash-plan`).
- Use `--pack-set core` or `--all` to install all valid manifests under `packs/core/`.
- `update` and `uninstall` with no pack id select all managed packs in the chosen lane.

## Examples

### Codex repo-scope bootstrap install

```bash
node packages/cli/src/bin/pairslash.js preview install --runtime codex --target repo
node packages/cli/src/bin/pairslash.js install --runtime codex --target repo --apply --yes
node packages/cli/src/bin/pairslash.js doctor --runtime codex --target repo
```

### Copilot user-scope bootstrap install

```bash
node packages/cli/src/bin/pairslash.js preview install --runtime copilot --target user
node packages/cli/src/bin/pairslash.js install --runtime copilot --target user --apply --yes
node packages/cli/src/bin/pairslash.js doctor --runtime copilot --target user
```

### Install full core set

```bash
node packages/cli/src/bin/pairslash.js preview install --runtime codex --target repo --all
node packages/cli/src/bin/pairslash.js install --runtime codex --target repo --all --apply --yes
```

## Validation

After install:

1. Launch runtime from repo root.
2. Run `/skills`.
3. Select `pairslash-plan`.
4. Ask: `Create a repo plan from the current repo state.`

If setup problems appear, use `docs/workflows/phase-4-doctor-troubleshooting.md`.
