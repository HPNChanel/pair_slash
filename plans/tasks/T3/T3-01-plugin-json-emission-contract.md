---
id: T3-01
track: T3
title: Design plugin.json emission contract (schema + pack-manifest mapping)
status: todo
depends_on: []
est_size: M
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Define the canonical mapping from a PairSlash `pack.manifest.yaml` to a runtime plugin bundle — starting with Copilot's `plugin.json` shape — as a schema-level contract both T3-02 (Copilot emitter) and T3-03 (Codex layout) build against.

## Context & sources

- Copilot `plugin.json` shape (verified): `name`, `description`, `version`, `author{name,email}`, `license`, `keywords[]`, `agents`, `skills` (string or list), `hooks`, `mcpServers` — components live at `agents/*.agent.md`, `skills/*/SKILL.md`, `hooks.json`, `.mcp.json`, `lsp.json`, `extensions/`.
- PairSlash manifest has: `pack_name`, `display_name`, `pack_version`, `summary`, `category`, `workflow_class`, `capabilities`, `supported_runtimes`, `runtime_assets`, `memory_permissions`, `risk_level`, `required_tools`, `required_mcp_servers`.
- Key design question: is a "plugin" a per-pack unit or a bundle-of-packs unit? Recommend per-pack plugin with a future `pack-set → plugin` aggregation option (keep scope narrow, C.17.3-style).
- Trust posture: `pack.trust.yaml`/`trust/` material — decide what (if anything) maps into plugin metadata (e.g., `metadata.pairslash.*` fields) vs stays internal.

## Files to touch

- New doc/schema: `docs/architecture/plugin-emission-contract.md` or a spec-core schema module `packages/core/spec-core/src/plugin-ir.ts`
- Possibly `manifest-v2.schema.ts` — optional `plugin` section if manifest opts into plugin emission
- Do NOT touch: emitters (T3-02/T3-03 implement this contract), installer

## Work steps

1. Inventory Copilot `plugin.json` fields + Codex plugin layout (from T1-01 research + docs) — produce field-by-field mapping table: manifest → plugin.json / codex-plugin.
2. Define PairSlash-side contract: which manifest fields map where; how workflow assets (SKILL.md, references/, scripts/) map into plugin `skills/` subdir; whether `hooks`/`mcpServers` get emitted when declared.
3. Decide + record: per-pack plugin unit (recommended) vs aggregate; metadata namespacing (`pairslash.*`); `enabledPlugins` declarative integration posture (Copilot repo-level settings).
4. Write the contract doc + (if warranted) a `plugin-ir.ts` IR type mirroring existing `runtime-asset-ir.ts` patterns.
5. Review against CONSTRAINTS: nothing in the plugin maps to hidden writes/implicit activation without manifest opt-in.

## Constraints (STRICT)

- MUST NOT emit agent files for write-authority workflows (charter §13.3 — write-authority stays skill-disciplined); agent emission is T4-03's domain and restricted.
- MUST keep plugin bundle a *distribution unit* — contract must not introduce a new invocation path into PairSlash semantics (C.2).
- MUST be version-pinned to the verified plugin.json format — include a `format_version`/era note so future drift is detectable.
- MUST NOT include secrets/user-local paths in emitted plugin metadata.
- Contract MUST preserve provenance: emitted plugin carries pack id/version/checksum in `metadata`.

## Acceptance gates

- [ ] Mapping table complete for both runtimes
- [ ] Contract doc or IR module committed
- [ ] Decision records (per-pack unit; metadata namespacing) explicit
- [ ] `npm run lint`, `npm run test` green (if IR module added: typecheck green)

## Evidence to record

- Contract doc path; mapping table.

## Rollback

`git revert` — docs/types only.
