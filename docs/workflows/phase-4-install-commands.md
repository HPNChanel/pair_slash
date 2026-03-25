# PairSlash Phase 4 Install Commands

Phase 4 treats `install`, `update`, and `uninstall` as the main managed product
surface for distribution and lifecycle work. `packs/core/` stays canonical
source. Runtime folders stay derived artifacts. `/skills` stays the canonical
entrypoint after install.

## Quick start

Use this path when you want first success with the least friction:

```bash
node packages/cli/src/bin/pairslash.js doctor --runtime codex --target repo
node packages/cli/src/bin/pairslash.js preview install pairslash-plan --runtime codex --target repo --plan-out .pairslash/tmp/install-plan.json
node packages/cli/src/bin/pairslash.js install pairslash-plan --runtime codex --target repo --apply --yes
node packages/cli/src/bin/pairslash.js doctor --runtime codex --target repo
```

Swap `--runtime codex` for `--runtime copilot` and `--target repo` for
`--target user` when that is the lane you actually want.

## Command defaults

- `install`, `update`, and `uninstall` are preview-first. Without `--apply`,
  they only emit a plan.
- `--dry-run` is explicit preview mode. It never mutates runtime folders or
  install state.
- `--plan-out <path>` writes the preview plan JSON to disk before any apply
  step. This is safe to use in preview mode and dry-run mode.
- `--apply` enables mutation. In non-interactive runs, pair it with `--yes`.
- Omit pack ids on `install` to select all valid manifests under `packs/core/`.
- Omit pack ids on `update` or `uninstall` to select all installed packs for
  the chosen runtime and target.
- `--runtime auto` is allowed, but it fails if both supported runtimes are
  detectable and no state disambiguates the lane.
- Exit code `0` means success. Exit code `1` means invalid usage, blocked
  preview, failed doctor/lint, or failed apply.

## Install

Use `install` to go from source packs to managed runtime-native assets.

```bash
node packages/cli/src/bin/pairslash.js install pairslash-plan --runtime codex --target repo
node packages/cli/src/bin/pairslash.js install pairslash-plan --runtime codex --target repo --dry-run
node packages/cli/src/bin/pairslash.js install pairslash-plan --runtime codex --target repo --apply --yes
node packages/cli/src/bin/pairslash.js install --runtime codex --target repo --format json
```

Install semantics:

- Detect the requested runtime lane.
- Check supported runtime range before apply.
- Run preview-first conflict detection.
- Write only PairSlash-owned files into the derived install root.
- Record ownership and digests in repo-local install state.
- Write a transaction journal so apply can roll back on failure.

## Update

Use `update` to refresh managed packs without clobbering valid local overrides.

```bash
node packages/cli/src/bin/pairslash.js preview update --runtime copilot --target user
node packages/cli/src/bin/pairslash.js update --runtime copilot --target user --dry-run
node packages/cli/src/bin/pairslash.js update --runtime copilot --target user --apply --yes
node packages/cli/src/bin/pairslash.js update pairslash-plan --runtime codex --from 0.4.0 --to packs/core/pairslash-plan/pack.manifest.yaml --dry-run
```

Update semantics:

- Diff against the last managed receipt, not just the current filesystem tree.
- Replace a file only when it still matches the last managed digest.
- Preserve override-eligible local edits as `preserve_override`.
- Block non-override local drift as `blocked_conflict`.
- Remove orphaned managed assets only when ownership state proves they are
  PairSlash-managed.
- Use the transaction journal to roll back if the write phase fails.

## Uninstall

Use `uninstall` to remove only PairSlash-managed footprint for the chosen lane.

```bash
node packages/cli/src/bin/pairslash.js preview uninstall --runtime codex --target repo
node packages/cli/src/bin/pairslash.js uninstall --runtime codex --target repo --dry-run
node packages/cli/src/bin/pairslash.js uninstall --runtime codex --target repo --apply --yes
node packages/cli/src/bin/pairslash.js uninstall --runtime codex --target repo --format json
```

Uninstall semantics:

- Only files marked as PairSlash-owned and still unchanged are removed.
- User files, unmanaged files, and locally edited managed files are preserved.
- Preserved files show up as `skip_unmanaged` in the preview or result summary.
- The install state is detached or removed after a successful uninstall.
- The transaction journal allows rollback if uninstall fails mid-flight.

## Runtime roots, state, and reports

- Repo target writes into `.agents/skills/` for Codex and `.github/skills/`
  for Copilot.
- User target writes into `~/.agents/skills/` for Codex and `~/.copilot/skills/`
  for Copilot.
- Install state is stored under `.pairslash/install-state/`.
- Apply writes a transaction journal under `.pairslash/install-journal/`.
- Use `pairslash doctor` before install or update when you need a structured
  diagnosis of runtime detection, manifest compatibility, support lane status,
  both-scope writability, naming conflicts, override risk, or missing
  tool/MCP config.

```bash
node packages/cli/src/bin/pairslash.js doctor --runtime codex --target repo
node packages/cli/src/bin/pairslash.js doctor --runtime copilot --target user
node packages/cli/src/bin/pairslash.js lint --phase4
```

Doctor verdict meanings and common remediations live in
`docs/workflows/phase-4-doctor-troubleshooting.md`.

## Related references

- Manual copy fallback: `docs/workflows/install-guide.md`
- Release gate: `docs/releases/release-checklist-0.4.0.md`
- Runtime lane evidence: `docs/runtime-mapping/pilot-acceptance.md`
