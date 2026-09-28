# GitHub Copilot CLI Mapping

Copilot bundles are emitted as `copilot-package-bundle`.

## Install roots

- Repo target (default): `.github/skills/<pack-id>/`
- User target (default): `~/.copilot/skills/<pack-id>/`

Opt-in shared root (`--skill-root shared-agents`):

- Repo target: `.agents/skills/<pack-id>/`
- User target: `~/.agents/skills/<pack-id>/`

The shared root lets one repo-level install serve both runtimes. It requires
Copilot CLI >= 1.0.11 (the `.agents/skills` project scan shipped in that line);
`pairslash doctor --skill-root shared-agents` warns when the detected runtime is
below the floor or cannot be verified. Shared-root installs keep their own state
file (`<target>-<runtime>-shared-agents.json`) so they never collide with
default-root state.

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
  (advisory declaration; native hook wiring ships in plugin emit mode)
- `mcp/servers.yaml` when MCP dependencies are declared
- `pairslash.install.json`

## Runtime surface notes (verified 2026-09-28, @github/copilot 1.0.88)

These are runtime capabilities, not PairSlash support claims (see claim policy):

- `/skills` surface: documented in Phase 4 as a picker; in the v1.0.x series it
  is a unified dashboard surface. The `/skills` canonical-entrypoint statements
  in this repo still hold — the surface changed shape, not name.
- Detection caveat: `gh copilot` is a built-in `gh` wrapper, not a `gh`
  extension. `gh copilot --help` exits 0 even when the `copilot` binary is
  absent — wrapper presence is not Copilot CLI proof. Version reported by
  `gh --version` is the gh host CLI version, not the Copilot CLI version.
- Command groups: `copilot plugin`, `copilot skill`, `copilot mcp` exist in the
  v1.0.x series; `gh skill` is a distribution channel. PairSlash emits plugin
  bundles via `--emit plugin` (track T3) but never invokes `copilot plugin
  install` — user activation stays on the runtime's own command path.
- Plugin hooks: legacy-format `plugin.json` supports a `hooks` pointer to a
  `hooks/hooks.json` config. PairSlash emits advisory-only hook wiring for
  write-authority packs in plugin emit mode (track T4-01); canonical events
  without an advisory channel on Copilot (`turn-stop` → `agentStop`,
  `pre-tool-use`, `session-end`, `pre-compact`) are skipped rather than wired
  dead.
- Other runtime surfaces observed upstream: `enabledPlugins` settings and
  `.agent.md` agent files; PairSlash emission is unverified/deferred.
- Direct invocation (`-p`/prompt mode): remains `blocked` per known issue K1
  pending live re-verification (T1-06).

## Notes

- `/skills` is the only documented activation path in Phase 4.
- Hooks stay declarative in Phase 4; no background service or daemon is introduced.
- Update preserves valid local overrides on override-eligible files and blocks unmanaged conflicts.
