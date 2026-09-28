# Track T2 — Standards alignment (Agent Skills spec, MCP 2026-07-28, AGENTS.md)

**Status:** Done (8/8 tasks, 2026-09-28) | **Priority:** P1 | **Depends on:** T0, T1
**Goal:** Make every artifact PairSlash emits or validates comply with the current open standards: the Agent Skills specification, MCP 2026-07-28 era awareness, and the AGENTS.md convention.

## Context

The Agent Skills spec is now a governed open standard (agentskills.io): `name` ≤64 lowercase-hyphen matching the parent dir, `description` ≤1024, optional `license`/`compatibility`/`metadata`/`allowed-tools`, conventional `scripts/`, `references/`, `assets/` dirs, unknown-field forward compatibility, progressive disclosure. PairSlash's SKILL.md emitters predate the spec's formalization — they mostly comply but are not *validated* against it, and they emit none of the optional fields.

MCP 2026-07-28 is a breaking protocol revision: stateless core, `server/discover`, `Mcp-Method`/`Mcp-Name` headers, per-request `_meta`, formal deprecation policy. Copilot CLI ships it. PairSlash's `required_mcp_servers` manifest field and `mcp/servers.yaml` emitters carry no spec-era awareness.

## Entry gate

- T0 green; T1 truth realignment done (emitters must target verified-current surfaces).

## Tasks (ordered)

| Task | Title | Depends on |
| --- | --- | --- |
| T2-01 | Agent Skills spec validator in spec-core + lint-bridge wiring | — |
| T2-02 | SKILL.md frontmatter emitter upgrade (license, compatibility, metadata) | T2-01 |
| T2-03 | Adopt scripts/references/assets conventions in both compilers | T2-01 |
| T2-04 | Manifest-v2 schema: `spec_era` on `required_mcp_servers` | T2-01 |
| T2-05 | MCP emitter upgrade for 2026-07-28 era | T2-04 |
| T2-06 | MCP deprecation/dual-era guardrails in lint + doctor | T2-05 |
| T2-07 | AGENTS.md currency verification + emission decision | — |
| T2-08 | Shared `.agents/skills` repo-root feasibility + installer flag | T2-01 |

## Exit gate

- `npm run lint` includes spec-validation rules; all existing core packs pass (or are minimally fixed to pass).
- Compiled output for both runtimes emits spec-compliant SKILL.md with new optional fields populated from manifest.
- MCP sidecars carry `spec_era` and 2026-07-28-aware guidance.
- A decision record exists for shared `.agents/skills` install root (adopt or reject with reasons).
- Charter invariants intact: assets are metadata/docs only — no behavioral write paths added (C.3, C.4).

## Risks

- `allowed-tools` semantics differ across runtimes — deferred; do not emit it (recorded in FEATURE-INVENTORY SK-06).
- Shared install root changes install/uninstall ownership tracking — T2-08 is study + gated flag only; no default change.
- Adding a schema field to manifest-v2 requires schema_version bump discipline and backward-compat handling for existing packs.
