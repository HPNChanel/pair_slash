# PairSlash Phase 4 Install Commands

Phase 4 adds a managed install/update/uninstall path on top of the existing source packs.

## Principles

- Always preview before apply.
- `/skills` remains the canonical runtime entrypoint.
- Update preserves valid local overrides.
- Uninstall removes only PairSlash-owned footprint.

## Preview

```bash
node packages/cli/src/bin/pairslash.js preview install pairslash-plan --runtime codex --target repo --plan-out .pairslash/tmp/install-plan.json
node packages/cli/src/bin/pairslash.js preview update --runtime copilot --target user
node packages/cli/src/bin/pairslash.js preview uninstall --runtime codex --target repo
```

## Install

```bash
node packages/cli/src/bin/pairslash.js install pairslash-plan --runtime codex --target repo
node packages/cli/src/bin/pairslash.js install pairslash-plan --runtime codex --target repo --dry-run
node packages/cli/src/bin/pairslash.js install pairslash-plan --runtime codex --target repo --apply --yes
node packages/cli/src/bin/pairslash.js install pairslash-plan --runtime auto --target repo --plan-out .pairslash/tmp/install-plan.json
```

## Update

```bash
node packages/cli/src/bin/pairslash.js update --runtime copilot --target repo --preview
node packages/cli/src/bin/pairslash.js update --runtime copilot --target repo --apply
```

## Uninstall

```bash
node packages/cli/src/bin/pairslash.js uninstall --runtime codex --target repo --preview
node packages/cli/src/bin/pairslash.js uninstall --runtime codex --target repo --apply
```

## Doctor and lint

```bash
node packages/cli/src/bin/pairslash.js doctor --runtime codex --target repo
node packages/cli/src/bin/pairslash.js lint --phase4
```

Doctor verdict meanings and common remediations live in
`docs/workflows/phase-4-doctor-troubleshooting.md`.

## Notes

- Repo target installs write into `.agents/skills/` for Codex and `.github/skills/` for Copilot.
- User target installs write into `~/.agents/skills/` for Codex and `~/.copilot/skills/` for Copilot.
- Install state is stored under `.pairslash/install-state/`.
- Install apply writes a transaction journal under `.pairslash/install-journal/` for rollback.
- `install`, `update`, and `uninstall` stay preview-first; use `--dry-run` for explicit dry-run and add `--apply --yes` for non-interactive mutation.
- Manual copy remains available through `docs/workflows/install-guide.md` as a fallback path.
- Final internal release gate lives in `docs/releases/release-checklist-0.4.0.md`.
