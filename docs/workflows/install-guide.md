# PairSlash Install Guide

Install PairSlash workflows into Codex CLI or GitHub Copilot CLI using the
managed installability command surface.

This guide covers the shipped install path only.
It does not widen runtime support beyond
`docs/compatibility/compatibility-matrix.md` and does not prove
product-validation exit.

The current supported install path is repo-local from this checkout.
Package-manager publication is not part of the current public surface.
Legal/package boundary source of truth:
`docs/releases/legal-packaging-status.md`.

`/skills` is the canonical entrypoint after install on both runtimes.

This page shows direct CLI invocation (`node packages/tools/cli/src/bin/pairslash.js ...`) for runtime-neutral docs.
In this repo, use the equivalent shorthand `npm run pairslash -- <args>`.

## Fast path (time-to-first-success)

Use:

1. `doctor`
2. `preview install`
3. `install --apply`
4. `/skills` -> first workflow

For the shortest onboarding path, use `docs/workflows/phase-4-quickstart.md`.
For the broader operations flow, use `docs/workflows/phase-2-operations.md`.
For runtime evidence and guardrails, use `docs/compatibility/runtime-verification.md`.
For Phase 9 proof assets and evidence placeholders, use:

- `docs/examples/README.md`
- `docs/benchmarks/README.md`
- `docs/case-studies/README.md`
- `docs/case-studies/onboard-repo-before-after.md`

## Managed lifecycle commands

```bash
node packages/tools/cli/src/bin/pairslash.js doctor --runtime codex --target repo
node packages/tools/cli/src/bin/pairslash.js preview install --runtime codex --target repo --plan-out .pairslash/tmp/install-plan.json
node packages/tools/cli/src/bin/pairslash.js install --runtime codex --target repo --apply --yes
node packages/tools/cli/src/bin/pairslash.js doctor --runtime codex --target repo
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
node packages/tools/cli/src/bin/pairslash.js preview install --runtime codex --target repo
node packages/tools/cli/src/bin/pairslash.js install --runtime codex --target repo --apply --yes
node packages/tools/cli/src/bin/pairslash.js doctor --runtime codex --target repo
```

### Copilot user-scope bootstrap install

```bash
node packages/tools/cli/src/bin/pairslash.js preview install --runtime copilot --target user
node packages/tools/cli/src/bin/pairslash.js install --runtime copilot --target user --apply --yes
node packages/tools/cli/src/bin/pairslash.js doctor --runtime copilot --target user
```

### Install full core set

```bash
node packages/tools/cli/src/bin/pairslash.js preview install --runtime codex --target repo --all
node packages/tools/cli/src/bin/pairslash.js install --runtime codex --target repo --all --apply --yes
```

## Validation

After install:

1. Launch runtime from repo root.
2. Run `/skills`.
3. Select `pairslash-plan`.
4. Ask: `Create a repo plan from the current repo state.`

If setup problems appear, use `docs/workflows/phase-4-doctor-troubleshooting.md`.
