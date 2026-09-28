---
id: T1-03
track: T1
title: Refresh runtime-mapping docs (codex-cli.md, copilot-cli.md)
status: done
depends_on: [T1-01]
est_size: M
claimed_by: devin-session
claimed_at: 2026-09-28
completed_at: 2026-09-28
evidence: docs/runtime-mapping/codex-cli.md, copilot-cli.md, pilot-acceptance.md refreshed
---

## Objective

Bring `docs/runtime-mapping/codex-cli.md` and `docs/runtime-mapping/copilot-cli.md` up to the current runtime surfaces: install roots, surface mapping, generated assets, invocation verbs, and new capability notes.

## Context & sources

- Current `copilot-cli.md` (read): repo target `.github/skills/`, user `~/.copilot/skills/`; surfaces `canonical_skill`/`support_doc`/`metadata`/`agent`/`hook`/`mcp`; generated assets incl. `hooks/preflight.yaml`, `mcp/servers.yaml`; note "/skills is the only documented activation path in Phase 4".
- Reality delta: Copilot now also scans `.agents/skills` (repo) + `~/.agents/skills` (personal); `/skills` is a dashboard; `copilot plugin|skill` command groups exist; `.agent.md` agents; `enabledPlugins` settings; `gh skill` distribution.
- `codex-cli.md` needs the same treatment: `.agents/skills` tree scan, plugin/marketplace surfaces, hooks files, `$`-mention, daemon.
- Check `docs/runtime-mapping/README.md` and `pilot-acceptance.md` for stale references in the same pass.

## Files to touch

- `docs/runtime-mapping/codex-cli.md`, `docs/runtime-mapping/copilot-cli.md`
- `docs/runtime-mapping/README.md` if it summarizes stale surfaces
- `docs/runtime-mapping/pilot-acceptance.md` — only if it references superseded surfaces (mark superseded, don't rewrite history)
- Do NOT touch: lane evidence records, matrix YAML, public claim statements in README (wording changes beyond factual refresh need T1-07 sign-off)

## Work steps

1. For each runtime doc, add/update: install roots (all current roots incl. `.agents/skills`), surface mapping for new asset kinds (plugin manifest, hooks files, agent files), invocation verbs (`/skills` dashboard note for Copilot; `$`-mention + `/skills` picker for Codex), generated assets list.
2. Add a "Runtime surface notes" section: plugin system present, hooks capability, daemon auto-start (Codex), unified dashboard (Copilot), MCP 2026-07-28 support.
3. Mark superseded statements honestly ("documented Phase 4: picker-based /skills" → "current: dashboard-based") rather than deleting history.
4. Keep wording inside claim policy: descriptive of runtime capability, not PairSlash support claims.
5. Gates: lint, test green (docs changes shouldn't break; if lint validates docs links, confirm).

## Constraints (STRICT)

- MUST NOT claim PairSlash support for a surface merely because the runtime has it — capability ≠ support (C.6).
- MUST NOT remove the `/skills`-canonical statements; update them to reflect the dashboard reality.
- MUST label direct-invocation surfaces as `unverified`/`verified` consistently with lane evidence.
- MUST keep docs deterministic ordering (G8): tables/sections in stable order.

## Acceptance gates

- [x] Both runtime-mapping docs reflect Sep-2026 surfaces
- [x] No support-level claims strengthened — capability notes labeled "runtime capabilities, not PairSlash support claims"
- [x] `npm run lint` green (docs linting if enforced)
- [x] Cross-links resolve — stale `pairslash.js` paths corrected to `pairslash.ts`

## Evidence to record

- Commit hash; list of surfaces added per runtime in commit body.

## Rollback

`git revert` — docs-only.
