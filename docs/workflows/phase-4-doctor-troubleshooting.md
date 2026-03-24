# PairSlash Phase 4 Doctor Troubleshooting

Use `pairslash doctor` after install, before update, and before declaring a runtime lane usable.

## Verdicts

- `pass`: runtime lane is compatible and no blocking issue was found
- `warn`: install can proceed, but there is a non-blocking issue to review
- `degraded`: runtime lane works with reduced safety or missing optional capability
- `fail`: install/update/use is blocked until the issue is fixed

## Common checks and remediations

- `runtime.detect`
  Run `codex --version` or `gh copilot --version` and make sure the runtime is installed and on `PATH`.
- `runtime.version_range`
  Upgrade or downgrade the runtime until it falls inside `supported_runtime_ranges` from the pack manifest.
- `filesystem.config_home`
  Ensure the config-home path is a directory, not a file. Codex uses `.agents/` or `~/.agents/`; Copilot uses `.github/` or `~/.copilot/`.
- `filesystem.write_permission`
  Fix directory permissions before retrying install or update.
- `manifest.naming_conflicts`
  Rename the conflicting pack id or direct invocation so each runtime surface stays unique.
- `dependencies.required_tools`
  Install the declared tool or remove the pack from the install set.
- `dependencies.required_mcp_servers`
  Restore the required MCP fragment or install the missing server configuration.
- `install_state.owned_files_integrity`
  Run `pairslash update --preview` to inspect preserved overrides and blocked conflicts before any apply step.
- `conflict.unmanaged_install_root`
  Move or remove the unmanaged runtime folder that blocks PairSlash ownership.
- `platform.os_shell_support`
  Use PowerShell, cmd, bash, zsh, or sh on a supported OS before filing a runtime bug.

## Suggested operator flow

```bash
node packages/cli/src/bin/pairslash.js doctor --runtime codex --target repo
node packages/cli/src/bin/pairslash.js doctor --runtime copilot --target user
node packages/cli/src/bin/pairslash.js doctor --runtime auto --target repo --format json
```

If the verdict is `degraded` or `fail`, fix the issue first. Do not force `update` or `uninstall` around a failing doctor result.
