# Codex CLI Mapping

Codex bundles are emitted as `codex-skill-bundle`.

## Install roots

- Repo target: `.agents/skills/<pack-id>/`
- User target: `~/.agents/skills/<pack-id>/`

Codex scans `.agents/skills` natively, so both `--skill-root runtime-default`
and `--skill-root shared-agents` resolve to the same directories. The shared
root matters when the same repo also installs for Copilot: one `.agents/skills`
tree is then scanned by both runtimes. Shared-root installs keep a separate
state file (`<target>-codex_cli-shared-agents.json`).

## Surface mapping

| Logical surface | Runtime path |
|---|---|
| `canonical_skill` | `SKILL.md` or source-relative root file |
| `support_doc` | source-relative root file |
| `metadata` | `agents/openai.yaml` |
| `context` | `fragments/context/<file>` |
| `config` | `fragments/config/<file>` |
| `hook` | `fragments/hooks/<file>` |
| `mcp` | `fragments/mcp/<file>` |
| ownership receipt | `pairslash.install.json` |

## Generated assets

- `agents/openai.yaml`
- `fragments/context/runtime-context.md`
- `fragments/config/pack-config.yaml`
- `fragments/config/write-authority.yaml` for write-authority packs
- `fragments/hooks/preflight.yaml` for write-authority or MCP-dependent packs
  (advisory declaration; native hook wiring ships in plugin emit mode)
- `fragments/mcp/servers.yaml` when MCP dependencies are declared
- `pairslash.install.json`

## Runtime surface notes (verified 2026-09-28, codex-cli 0.153.4)

These are runtime capabilities, not PairSlash support claims (see claim policy):

- Plugin system: `codex plugin` manages plugins and marketplace installs.
  PairSlash emits plugin bundles via `--emit plugin` (track T3); repo-scope
  placement is file-level only and PairSlash never invokes `codex plugin add`.
- File-based hooks: Codex loads `hooks/hooks.json` from plugin directories.
  PairSlash emits advisory-only hook configs in plugin emit mode (track T4-01);
  PairSlash hooks never block, deny, or mutate — wrapper enforcement stays
  authoritative. Codex skips untrusted hook configs until the user reviews them
  (`/hooks` trust flow); PairSlash never pre-trusts its own emitted hooks — the
  emitted `description` field and this note are the trust-review surface.
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
