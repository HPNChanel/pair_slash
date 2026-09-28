# PairSlash Feature Inventory — Ecosystem Scan Sep 2026

**Status:** Authoritative inventory for the T-series tracks
**Scan window:** 2026-04-05 (last lane evidence) → 2026-09-28
**Method:** Every externally observed capability of Codex CLI, GitHub Copilot CLI, the Agent Skills spec, MCP, and the Node.js toolchain is listed below with a triage verdict. Nothing is silently dropped — a `reject` still records *why*.

## Triage legend

- `adopt` — becomes work inside a track task (see `routed_to`).
- `defer` — real and tracked, but out of this upgrade's scope; revisit at next scan.
- `reject` — conflicts with charter/CONSTRAINTS.md, or is out of product scope; rejection is permanent unless charter changes.
- `verify` — truth of the item must be established inside a task before adopt/defer is final.

---

## A. Codex CLI drift (baseline 0.116–0.118 → current ~0.157.0)

| ID | Feature | Triage | Routed to | Notes |
| --- | --- | --- | --- | --- |
| CX-01 | Plugin system: `codex plugin add/list/remove`, `/plugins` browser | adopt | T3-03, T3-05 | Distribution channel for PairSlash packs; never an entrypoint (C.2). |
| CX-02 | Plugin marketplaces: `codex plugin marketplace add/list/upgrade/remove`, GitHub shorthand `@ref`, sparse checkout | adopt | T3-03, T3-05 | Enables first-party marketplace distribution. |
| CX-03 | Implicit skill invocation via `description` matching | adopt | T4-02 | Must become opt-in manifest policy; default stays explicit (charter automation boundary). |
| CX-04 | `$skill-name` explicit mention syntax | adopt | T1-03, T4-02 | Direct-invocation surface; verify per-lane before claiming. |
| CX-05 | `.agents/skills` scanned at every dir up to repo root | adopt | T2-08 | Shared discovery root with Copilot; nested-repo semantics need doctor checks. |
| CX-06 | Skill locations: repo / user / admin / system | adopt | T1-03 | Mapping doc must cover admin/system layers for completeness. |
| CX-07 | `hooks.json` per config layer | adopt | T4-01 | Emission target for write-authority preflight. |
| CX-08 | Inline `[hooks]` tables in `config.toml` | adopt | T4-01 | Alternative emission target; one representation per layer rule. |
| CX-09 | 12 hook lifecycle events incl. `Interrupt` (v0.150), `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop` | adopt | T4-01 | Event coverage map needed for preflight hook design. |
| CX-10 | Hook trust-by-hash review flow (`/hooks` browser, changed-hook re-review) | adopt | T4-01, T4-06 | Installer must document trust-review UX; unmanaged hooks skipped until trusted. |
| CX-11 | Managed hooks via `requirements.toml` (enterprise) | defer | — | Enterprise/MDM surface; no current PairSlash requirement. |
| CX-12 | `[features] hooks = false` kill switch | adopt | T4-01, T4-06 | Doctor should detect hooks-disabled state and warn for write-authority packs. |
| CX-13 | Daemon auto-start stable default (persistent `exec-server`, v0.157) | adopt | T4-04 | Detect + report only; PairSlash must not manage it (C.8). |
| CX-14 | Fullscreen TUI default + `/tui` opt-in | defer | — | UI surface; no install semantics impact. |
| CX-15 | `/usage` dashboard incl. plugin & skill activity | adopt | T4-05 | Observability doc note: skill usage now visible to users. |
| CX-16 | `/voice` default-on, F8, bundled audio runtimes | reject | — | Out of scope: not a workflow surface; adds no contract value. |
| CX-17 | `/import` in remote & local background-server sessions | defer | — | Session-portability surface; monitor. |
| CX-18 | `/copy` picker, clickable markdown links, automatic task titling | defer | — | UX-only changes. |
| CX-19 | `@`-mention task references | defer | — | Could interact with task-memory later; not now. |
| CX-20 | Subagents / multi-agent infrastructure (v0.149+) | adopt | T8-05 (gate) | Relevant to delegation-engine design; not to core install path. |
| CX-21 | `f` fork shortcut for cross-app conversations | defer | — | Convenience UX. |
| CX-22 | `codex cloud` integration | defer | — | Cloud execution is outside repo-local trust substrate scope. |
| CX-23 | `codex resume` saved/local chat listing | defer | — | Session UX; observe for sessions/ interplay later. |
| CX-24 | `codex --search` live web search | defer | — | Runtime feature; no PairSlash contract impact. |
| CX-25 | `codex --image` visual context | defer | — | Same. |
| CX-26 | GPT-6 Sol/Luna + Bedrock provider; gpt-5.3-codex-spark deprecated 2026-09-14 | adopt | T1-02 | Model references in docs/profiles must not pin deprecated models. |
| CX-27 | Sandbox hardening (WSL escape fix, brokered shell snapshot credential guard) | adopt | T1-02, T4-06 | K3 PowerShell-sandbox note needs re-verification against newer builds. |
| CX-28 | Reasoning summaries default-off in local TUI | defer | — | No contract impact. |

## B. GitHub Copilot CLI drift (baseline "2.50.x" recorded → real current ~1.0.88)

| ID | Feature | Triage | Routed to | Notes |
| --- | --- | --- | --- | --- |
| CP-01 | `plugin.json` plugin manifest (bundles agents/skills/hooks/MCP/LSP/extensions) | adopt | T3-01, T3-02 | New compile target beside raw skill install. |
| CP-02 | Default marketplaces `copilot-plugins`, `awesome-copilot`; `copilot plugin marketplace add` | adopt | T3-05 | Distribution channel. |
| CP-03 | `enabledPlugins` declarative in `~/.copilot/settings.json` + `.github/copilot/settings.json` | adopt | T3-02, T4-06 | Repo-level declarative enablement — installer target. |
| CP-04 | `copilot plugin|skill|mcp|instruction|lsp` command groups (install/list/enable/disable/update/uninstall) | adopt | T1-03, T3-02 | Doctor should detect/manage via these verbs where supported. |
| CP-05 | `/plugin`, `/mcp`, `/skills` unified dashboard; legacy picker removed (v1.0.81); `/plugins` removed | adopt | T1-03, T1-07 | Canonical `/skills` surface changed shape — docs + evidence + lane records must reflect dashboard reality. |
| CP-06 | Custom agents `.agent.md` + subagent execution + `--agent` headless | adopt | T4-03 | Persona mapping allowed by charter §13.3; write-authority stays skill-disciplined. |
| CP-07 | `-p`/`--prompt` no longer drops plugin-provided skills/agents/MCP | verify | T1-06 | K1 "blocked" may be resolvable → re-test, then update lane record honestly. |
| CP-08 | `--add-dir` skill/agent discovery | adopt | T2-08, T4-06 | External skill dirs — doctor/discovery awareness. |
| CP-09 | `gh skill` CLI group: search/preview/install/update/publish, multi-host (incl. Codex), `--pin`, `--dry-run` | adopt | T3-04 | Distribution + validation path for PairSlash packs. |
| CP-10 | `/skills list|info|add|reload|remove`, enable/disable | adopt | T1-03 | Runtime-mapping verbs refresh. |
| CP-11 | `.agents/skills` project scan + `~/.agents/skills` personal (fixed 1.0.11) | adopt | T2-08 | Shared root with Codex → single repo-target possible. |
| CP-12 | Copilot SDK `skillDirectories`/`disabledSkills` (Node/Python/Go/.NET) | defer | — | SDK embedding is beyond CLI install scope; revisit if PairSlash ships an SDK surface. |
| CP-13 | MCP 2026-07-28 shipped in CLI/SDK/IDE/in-memory clients | adopt | T2-04, T2-05 | Drives MCP emitter spec-version awareness. |
| CP-14 | Instructions surface (`/instructions`, `copilot instruction list`) | defer | — | Adjacent to AGENTS.md handling; monitor. |
| CP-15 | LSP server plugins (`lsp.json`, `copilot lsp list`) | defer | — | No current PairSlash capability need. |
| CP-16 | IDE `extensions/` plugin kind (v1.0.62+) | reject | — | IDE extensions are outside CLI workflow-kit scope. |
| CP-17 | Plugin marketplace plugins contributing agents/skills/MCP survive `-p` runs | verify | T1-06 | Same as CP-07 — combined re-verification. |
| CP-18 | Terminal control-char sanitization in `copilot skill list` output | adopt | T2-01 | PairSlash lint should likewise reject control chars in skill name/description fields. |
| CP-19 | Hooks toggle gap (enable/disable temporarily unavailable after `/plugins` removal) | adopt | T4-01, T4-06 | Do not build flows that depend on per-hook runtime toggles. |

## C. Agent Skills specification (agentskills.io)

| ID | Item | Triage | Routed to | Notes |
| --- | --- | --- | --- | --- |
| SK-01 | `name`: ≤64 chars, lowercase `[a-z0-9-]`, must equal parent dir name, no edge/consecutive hyphens | adopt | T2-01 | Validator must enforce all sub-rules, not just prefix. |
| SK-02 | `description`: ≤1024 chars, non-empty, should include trigger keywords | adopt | T2-01 | Add lint rule + description quality guidance (implicit-invocation safety). |
| SK-03 | `license` optional field | adopt | T2-02 | Emit `Apache-2.0` for first-party packs. |
| SK-04 | `compatibility` ≤500 chars optional field | adopt | T2-02 | Emit runtime/env requirements (e.g., "Codex CLI ≥0.157"). |
| SK-05 | `metadata` arbitrary key→string map | adopt | T2-02 | Carry pack_id/version/checksum for provenance. |
| SK-06 | `allowed-tools` experimental space-separated list | defer | — | Experimental; cross-runtime semantics differ — revisit after live evidence. |
| SK-07 | `scripts/` executable resources dir | adopt | T2-03 | Compiler may emit helper scripts; ownership receipts must cover them. |
| SK-08 | `references/` documentation dir | adopt | T2-03 | Move pack `contract.md`/`example-*.md` rendering here. |
| SK-09 | `assets/` templates/resources dir | adopt | T2-03 | Templates for write-global structured input. |
| SK-10 | Unknown top-level fields ignored (forward-compat) | adopt | T2-01 | Validator warns (not errors) on unknown fields; spec-reserved casing rules enforced. |
| SK-11 | Progressive disclosure model (name+desc at startup → body on activation) | adopt | T2-02 | Keep descriptions self-sufficient for routing; no critical info only in body. |

## D. MCP 2026-07-28 specification

| ID | Item | Triage | Routed to | Notes |
| --- | --- | --- | --- | --- |
| MP-01 | Stateless protocol core; `initialize`/`initialized` retired; `Mcp-Session-Id` removed | adopt | T2-05 | Emitter output must not rely on session-scoped assumptions. |
| MP-02 | Per-request `_meta` `io.modelcontextprotocol/{protocolVersion,clientInfo,clientCapabilities,logLevel}` | adopt | T2-05 | Generated mcp config/docs reference the new shape. |
| MP-03 | `server/discover` RPC (optional pre-flight capability discovery) | adopt | T2-05 | Doctor may use discover when probing MCP servers. |
| MP-04 | `Mcp-Method` + `Mcp-Name` required HTTP headers on Streamable HTTP | adopt | T2-05 | Documented in emitted MCP sidecars. |
| MP-05 | `UnsupportedProtocolVersionError` (-32022) version negotiation | adopt | T2-05, T2-06 | Doctor/lint messaging for dual-era servers. |
| MP-06 | Cacheable `tools/list`, `prompts/list`, `resources/list` results | defer | — | Performance note only. |
| MP-07 | Extensions framework + MCP Apps (server-rendered UI) | defer | — | UI surface; out of scope for CLI workflow kit. |
| MP-08 | Tasks extension (long-running work) | defer | — | Interesting for delegation-engine later. |
| MP-09 | Authorization hardening (OAuth/OIDC alignment) | adopt | T2-05 | Sidecar docs must not suggest legacy auth patterns. |
| MP-10 | Formal deprecation policy + reserved error codes | adopt | T2-06 | Lint rule: pack MCP declarations must declare `spec_era` (legacy/modern/dual). |
| MP-11 | `spec_version` pinning for `required_mcp_servers` manifest field | adopt | T2-04 | Schema addition to manifest-v2. |

## E. Node.js / toolchain drift

| ID | Item | Triage | Routed to | Notes |
| --- | --- | --- | --- | --- |
| ND-01 | Node 26.x Current since 2026-05; **Active LTS 2026-10-28** | adopt | T10-01, T10-02 | Add CI matrix + compat verification now; widen engines at LTS. |
| ND-02 | Node 24 → maintenance LTS 2026-10-20 | adopt | T10-02 | Keep `>=24` floor through the transition window. |
| ND-03 | New release cadence (1 major/yr April, all releases become LTS, alpha channel) from Node 27 | adopt | T10-02 | Document cadence expectation in maintainer docs. |
| ND-04 | `@types/node` 26.x published | adopt | T0-03, T10-02 | Bump now to 24.19.0; move to 26.x at T10-02. |
| ND-05 | npm 11.14.x current vs `packageManager: npm@11.7.0` | adopt | T0-03 | Realign pin (exact-pin policy decision recorded). |
| ND-06 | valibot 1.5.0, yaml 2.9.1 available | adopt | T0-03 | Routine bump with test gates. |

## F. Repo-internal capability debt surfaced by the scan

| ID | Item | Triage | Routed to | Notes |
| --- | --- | --- | --- | --- |
| RB-01 | `npm run typecheck` fails — uncommitted trace WIP (7 errors) | adopt | T0-01 | Restore green before anything else. |
| RB-02 | Stray artifacts: `firebase-debug.log`, `.git_commit_msg`, empty `dist/` | adopt | T0-02 | Hygiene. |
| RB-03 | Copilot version "2.50.x" in matrix conflicts with real 1.0.x series | verify | T1-01 | Data-integrity check before editing truth files. |
| RB-04 | Advanced engines still `.js`, outside workspaces | adopt | T8-01..T8-05 | Migrated + implemented under T8. |
| RB-05 | `pairslash.ts` bin dispatcher + handlers monolith partially decomposed (done M1) | adopt | T5-* | Residual decomposition per mega plan. |
| RB-06 | ~3,331 strict TS errors outstanding (post-compilers graduation) | adopt | T5-05..T5-13 | Big-batch completion. |
| RB-07 | `/skills` picker → dashboard semantic change invalidates captured picker evidence | adopt | T1-06, T1-07 | Old "canonical picker" evidence references may need `superseded` marking. |
| RB-08 | `sync-truth` multi-file promotion tool absent (manual 5–7 file sync) | adopt | T9-01 | From deferred O1. |
| RB-09 | No SBOM artifact / audit gating on release lane | adopt | T10-04 | Partially present via repo-checks `npm audit`; extend to release lane. |
| RB-10 | Real-OS CI coverage nightly-only; PR lane is ubuntu-only | adopt | T10-03 | Extend phase4-acceptance to macOS/Windows. |

## G. Explicitly rejected (permanent unless charter changes)

| Item | Reason |
| --- | --- |
| Adding a third runtime target (Claude Code, Cursor, Gemini CLI) | C.1 — two-runtime boundary is constitutional. `gh skill` multi-host support is a *distribution* tool, not a runtime expansion. |
| Background daemon/watcher inside PairSlash | C.8 — Codex's own exec-server is detected only, never managed. |
| Implicit/auto skill invocation as default | Charter automation boundary — description-triggered activation is opt-in per pack (T4-02). |
| Vector DB / heavy retrieval as core prerequisite | CLAUDE.md §16 anti-goal; retrieval slice stays opt-in advanced (T8). |
| Publishing to npm before T6 gates clear | C.6 — `private: true` stays until T7 checklist + legal sign-off. |
| Voice/TUI/cloud surfaces as product features | Out of scope — PairSlash is a workflow kit, not a runtime UI. |

**Inventory totals:** ~84 tracked items — adopt 52, defer 18, verify 3 (folded into adopt tasks), reject 6 (+5 permanent rejections).
