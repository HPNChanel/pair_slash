# GitHub Copilot CLI Mapping

Copilot bundles are emitted as `copilot-package-bundle`.

## Install roots

- Repo target: `.github/skills/<pack-id>/`
- User target: `~/.copilot/skills/<pack-id>/`

## Surface mapping

| Logical surface | Runtime path |
|---|---|
| `canonical_skill` | `SKILL.md` or source-relative root file |
| `support_doc` | source-relative root file |
| `metadata` | `package/pairslash-bundle.json` |
| `agent` | `agents/<file>` |
| `hook` | `hooks/<file>` |
| `mcp` | `mcp/<file>` |
| ownership receipt | `pairslash.install.json` |

## Generated assets

- `package/pairslash-bundle.json`
- `agents/runtime-context.md`
- `hooks/preflight.yaml` for write-authority or MCP-dependent packs
- `mcp/servers.yaml` when MCP dependencies are declared
- `pairslash.install.json`

## Notes

- `/skills` stays canonical even when `/<pack-id>` is available.
- Hooks stay declarative in Phase 4; no background service or daemon is introduced.
- Update preserves valid local overrides on override-eligible files and blocks unmanaged conflicts.
