# Codex CLI Mapping

Codex bundles are emitted as `codex-skill-bundle`.

## Install roots

- Repo target: `.agents/skills/<pack-id>/`
- User target: `~/.agents/skills/<pack-id>/`

## Surface mapping

| Logical surface | Runtime path |
|---|---|
| `canonical_skill` | `SKILL.md` or source-relative root file |
| `support_doc` | source-relative root file |
| `metadata` | `agents/openai.yaml` |
| `context` | `fragments/context/<file>` |
| `config` | `fragments/config/<file>` |
| `mcp` | `fragments/mcp/<file>` |
| ownership receipt | `pairslash.install.json` |

## Generated assets

- `agents/openai.yaml`
- `fragments/context/runtime-context.md`
- `fragments/config/pack-config.yaml`
- `fragments/config/write-authority.yaml` for write-authority packs
- `fragments/mcp/servers.yaml` when MCP dependencies are declared
- `pairslash.install.json`

## Notes

- `/skills` is the only documented activation path in Phase 4.
- Write-authority behavior is declared in metadata; it is not inferred by installer.
- Uninstall removes only PairSlash-owned unchanged files recorded in the receipt/state.
