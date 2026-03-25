# Pilot Acceptance Lanes

Phase 4 automation is local and deterministic. Support claims still need
runtime evidence.

## Lanes

- macOS pilot: Codex CLI, repo target, `preview install`, `install --apply --yes`, `doctor`
- Linux pilot: GitHub Copilot CLI, user target, `preview install`, `install --apply --yes`, `doctor`
- Windows prep lane: `doctor`, `preview install`, and install-root/path/profile checks only unless live runtime evidence is recorded

## Minimum commands

```bash
node packages/cli/src/bin/pairslash.js preview install pairslash-plan --runtime codex --target repo
node packages/cli/src/bin/pairslash.js install pairslash-plan --runtime codex --target repo --apply --yes
node packages/cli/src/bin/pairslash.js doctor --runtime codex --target repo

node packages/cli/src/bin/pairslash.js preview install pairslash-plan --runtime copilot --target user
node packages/cli/src/bin/pairslash.js install pairslash-plan --runtime copilot --target user --apply --yes
node packages/cli/src/bin/pairslash.js doctor --runtime copilot --target user
```

## Evidence discipline

- Record what runtime and OS were actually used.
- Keep Windows as a prep lane until the runtime behavior is observed, not inferred.
- Do not mark a lane supported only because fake-runtime tests passed.
