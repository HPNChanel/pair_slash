# Plugin Emission Contract

> Status: Accepted (T3-01, 2026-09-28)
> Scope: how a PairSlash `pack.manifest.yaml` maps to runtime-native plugin
> bundles. Implemented by T3-02 (Copilot `plugin.json`) and T3-03 (Codex
> `.codex-plugin/plugin.json`).

## Purpose

Both runtimes now ship plugin ecosystems. PairSlash packs gain a second,
opt-in *distribution* form: a per-pack plugin bundle. Plugins change how packs
are **distributed**, never how they are **invoked** — `/skills` remains the
canonical invocation surface (charter C.2), and the direct skill install stays
the default (`--skill-root`, `--emit` are opt-in).

## Verified runtime shapes (sources: docs.github.com Copilot CLI plugin
reference; openai/codex `plugin-json-spec.md`, verified 2026-09-28)

### Copilot plugin directory

```text
<plugin-name>/
  plugin.json            # required manifest at plugin root
  skills/<skill-name>/   # SKILL.md + support files
  agents/                # *.agent.md (PairSlash: never emitted, see decisions)
  hooks.json             # optional hooks config
  .mcp.json              # optional MCP server config
  lsp.json               # optional LSP config (not emitted)
```

`plugin.json` fields: `name` (required, kebab ≤64), `$schema`, `description`
(≤1024), `version` (semver), `author{name,email,url}`, `homepage`,
`repository`, `license`, `keywords[]`, `category`, `tags[]`, plus component
path fields `agents` (default `agents/`), `skills` (default `skills/`),
`commands`, `hooks`, `extensions`, `mcpServers`, `lspServers`.

### Codex plugin directory

```text
<plugin-name>/
  .codex-plugin/plugin.json   # manifest inside .codex-plugin/
  skills/<skill-name>/        # SKILL.md + support files
  hooks.json, .mcp.json, .app.json  # optional
```

Codex `plugin.json` fields: `name`, `version`, `description`, `author`,
`homepage`, `repository`, `license`, `keywords[]`, `skills`, `hooks`,
`mcpServers`, `apps`, `interface{displayName, shortDescription,
longDescription, developerName, category, capabilities[], websiteURL,
privacyPolicyURL, termsOfServiceURL, defaultPrompt[], brandColor, icons,
screenshots[]}`. Repo/team marketplace entries live at
`<root>/.agents/plugins/marketplace.json` (emission is a T3-05 decision).

## Mapping table (pack.manifest → plugin.json)

| Manifest field | Copilot `plugin.json` | Codex `plugin.json` |
|---|---|---|
| `pack_name` | `name` | `name` |
| `summary` (fallback `display_name`) | `description` (≤1024, truncated) | `description` |
| `pack_version` | `version` | `version` |
| `category` | `category` | `interface.category` |
| `display_name` | — | `interface.displayName` |
| repo license | `license: "Apache-2.0"` | `license: "Apache-2.0"` |
| — | `keywords: ["pairslash", category]` | `keywords: ["pairslash", category]` |
| — | — | `interface.shortDescription` (← `summary`, ≤256) |
| — | — | `interface.developerName: "PairSlash"` |
| runtime_assets (skill tree) | `skills/<pack-id>/…` | `skills/<pack-id>/…` |
| — | `skills: "skills/"` | `skills: "skills/"` |
| `author` | *omitted — manifest has no author field* | *omitted* |
| `required_mcp_servers` | *not emitted* | *not emitted* |
| `hook` assets | *not emitted* | *not emitted* |
| `agent` assets | *never emitted* | *never emitted* |
| trust/policy material | provenance sidecar only | provenance sidecar only |

## Decisions

1. **Per-pack plugin unit.** One `pack.manifest.yaml` → one plugin directory
   `<pack-id>/`. A future `pack-set → plugin` aggregate is explicitly deferred;
   it is not part of this contract.
2. **Provenance via sidecar.** Neither runtime's `plugin.json` has a stable
   freeform metadata field. Emitted bundles carry `pairslash-plugin.json`:
   `{kind, format_version, pack_id, pack_version, runtime, manifest_digest,
   distribution_mode, invocation_surface}` — deterministic, no timestamps.
   `manifest_digest` = sha256 of the normalized manifest.
3. **`format_version` pin.** `PLUGIN_FORMAT_VERSION = "1.0.0"` in
   `spec-core/plugin-ir.ts`; bump when either runtime's verified plugin schema
   changes. Emitters fail closed on unknown runtime.
4. **No `agents/` emission.** Agent files are never emitted from workflow
   packs (write-authority stays skill-disciplined; agent emission is T4-03's
   restricted domain).
5. **No `hooks`/`mcpServers` emission in v1.** `required_mcp_servers` entries
   are `{id, spec_era}` requirement declarations, not endpoint configs — a
   plugin `.mcp.json` cannot be synthesized from them. PairSlash hook assets
   (`hooks/preflight.yaml`) are PairSlash-format, not runtime-native
   `hooks.json`. Both deferred until the manifest can describe native shapes.
6. **No secrets or absolute/user-local paths** in emitted plugin metadata —
   all paths are bundle-relative.
7. **`enabledPlugins` / marketplace writes are out of scope.** The installer
   must not edit runtime settings files; plugin install is previewed as a
   directory emission (T3-07), never a silent settings mutation.

## Constraints carried forward

- Plugin bundles are distribution units only; no new invocation path (C.2).
- Ownership receipts continue to gate all writes; `install_mode` distinguishes
  plugin vs skill installs in receipts (T3-07).
- Lane support claims unchanged — plugin emission is a compile/install option,
  not a runtime support claim.
