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

## Runtime surface notes (verified 2026-09-28, codex-cli 0.153.4)

These are runtime capabilities, not PairSlash support claims (see claim policy):

- Plugin system: `codex plugin` manages plugins and marketplace installs.
  PairSlash does not yet emit plugin manifests (tracked in plan track T3).
- Daemon: a shared local app-server daemon backs `codex agents`,
  `codex app-server`, and `codex remote-control` (experimental surfaces).
- Built-in diagnostics: `codex doctor`, `codex features` (feature flags),
  `codex cloud`, `codex exec-server`, `codex sandbox`.
- Invocation surfaces: `/skills` remains the canonical PairSlash entrypoint;
  direct `$`-mention/direct invocation is a runtime surface. PairSlash lane
  evidence records `direct_invocation: pass` only as archived macOS live smoke
  via `codex exec`; it is unrecorded on other lanes.

## Notes

- `/skills` is the only documented activation path in Phase 4.
- Write-authority behavior is declared in metadata; it is not inferred by installer.
- Uninstall removes only PairSlash-owned unchanged files recorded in the receipt/state.
