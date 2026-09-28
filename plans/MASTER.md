# PairSlash Master Upgrade Plan — Sep 2026 Rebaseline

**Status:** Approved master plan — governs all work under `plans/`
**Date:** 2026-09-28
**Supersedes:** `.kilo/plans/1784473291765-comprehensive-upgrade-roadmap.md` (July 2026) — its unfinished tracks R1–R3, P1, A1–A3, O1 are merged here as T6–T9 with updated context.
**Binding documents:** `plans/CONSTRAINTS.md` (global invariants), `plans/EXECUTION.md` (task protocol), `plans/FEATURE-INVENTORY.md` (triage source).

---

## 1. Why this plan exists

Two months of upstream drift (Apr→Sep 2026) invalidated core assumptions PairSlash was built against:

- **Codex CLI** moved 0.118 → 0.157: plugins + marketplaces, implicit skill invocation, a 12-event hooks framework with trust-by-hash review, and a daemon (`exec-server`) that is now the stable default.
- **Copilot CLI** landed its full plugin system (v1.0.6x–1.0.88): `plugin.json` bundles, marketplaces (`copilot-plugins`, `awesome-copilot`), declarative `enabledPlugins`, unified `/skills` dashboard (legacy picker removed), custom agents, and `gh skill` distribution.
- **Both runtimes now scan `.agents/skills/`** — the install-root split (`repo`→`.agents` vs `user`→`~/.copilot`) can be revisited.
- **Agent Skills** became a proper open spec (agentskills.io) with field constraints, optional fields, and directory conventions.
- **MCP 2026-07-28** rewrote the protocol (stateless core, `server/discover`, routing headers, deprecation policy); Copilot already ships it.
- **Node 26** enters Active LTS 2026-10-28; Node 24 moves to maintenance.
- **Repo itself is red:** `npm run typecheck` fails on uncommitted `trace` WIP; deps and runtime pins are stale; Copilot version entries ("2.50.x") contradict reality (1.0.x).

Meanwhile the July roadmap's release-unblock, publish-prep, advanced-slice, and ops-automation tracks were never executed. This plan merges everything into one sequenced program.

## 2. Program goals

1. **Green baseline** — all gates pass on a clean tree.
2. **Truth realignment** — runtime pins, lane records, and docs reflect Sep-2026 reality or honestly record their staleness.
3. **Standards compliance** — emitted skills are Agent-Skills-spec valid; MCP emitters are spec-era aware.
4. **Distribution upgrade** — packs compile to plugin bundles for both marketplaces without weakening `/skills` primacy.
5. **Capability policy** — hooks, implicit invocation, agents, and daemon awareness enter the spec/policy layer with opt-in discipline.
6. **Finish the deferred tracks** — M3 strict, release unblocks, publish prep, advanced slices, ops automation.
7. **Toolchain modernization** — Node 26 readiness, refreshed deps, hardened CI.

## 3. Non-goals (this cycle)

- No third runtime; no GUI; no daemon inside PairSlash; no implicit-invocation default flip; no npm publication (`private: true` stays); no vector-DB prerequisite; no weakening of preview/audit invariants.

## 4. Track map

| Track | Title | Depends on | Tasks | Track file |
| --- | --- | --- | --- | --- |
| T0 | Stabilize repo | — | 4 | `tracks/T0-stabilize-repo.md` |
| T1 | Runtime surface realignment | T0 | 7 | `tracks/T1-runtime-surface-realignment.md` |
| T2 | Standards alignment (Agent Skills, MCP, AGENTS.md) | T0, T1 | 8 | `tracks/T2-standards-alignment.md` |
| T3 | Distribution: plugins & marketplaces | T2 | 7 | `tracks/T3-distribution-plugins.md` |
| T4 | Runtime capability policy layer | T1, T2 | 6 | `tracks/T4-runtime-capabilities-policy.md` |
| T5 | M3 strict completion + mega-file decomposition | T0 | 14 | `tracks/T5-m3-strict-and-decomposition.md` |
| T6 | Release unblocks (benchmark, signed trust, live lane) | T0, T1 | 4 | `tracks/T6-release-unblock.md` |
| T7 | Publish prep (posture NOT flipped) | T6 | 4 | `tracks/T7-publish-prep.md` |
| T8 | Advanced slices (retrieval, ci, delegation) | T5 | 6 | `tracks/T8-advanced-slices.md` |
| T9 | Ops automation (sync-truth, perf, mutation, fuzz) | T5 (partial) | 4 | `tracks/T9-ops-automation.md` |
| T10 | Toolchain modernization (Node 26, CI, supply chain) | T0 | 5 | `tracks/T10-toolchain-modernization.md` |

**Total: 69 tasks.**

## 5. Sequencing

```
T0 (all)  ─────────────────────────────────────────►  unblocks everything
   ├─► T1 ──► T2 ──► T3            (runtime truth → standards → distribution)
   │     └─► T4                    (capability policy; needs T1 truth + T2 schema)
   ├─► T5                         (strict + decomposition; parallel-safe vs T1–T4 on disjoint files)
   │     ├─► T9 (O1 sync/perf/mutation/fuzz — needs decomposed modules)
   │     └─► T8 (advanced slices — needs spec-core strict-clean)
   ├─► T6 (R1 benchmark ‖ R2 signing ‖ R3 live lane — human actions inside)
   │     └─► T7 (publish prep — gate: all T6 exits GO)
   └─► T10                        (toolchain; may start after T0, completes at Node 26 LTS)
```

## 6. Execution protocol (summary — full spec in EXECUTION.md)

- One task = one session = one commit (preferred); status tracked in task frontmatter.
- Every task obeys `CONSTRAINTS.md` + its local STRICT constraints; violation = task failure.
- Truth-layer changes sync all downstream renderings in the same commit (§6 of EXECUTION.md).
- Blocked tasks are recorded with a reason and escalation — never silently dropped.

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| Docx-era claims in `docs-private/` conflict with new plan | `docs-private` is maintainer-local; public wording governed by charter + claim policy only. |
| Implicit invocation (CX-03) pressures the explicit-first UX | T4-02 makes it manifest opt-in per pack; default unchanged; docs explain the boundary. |
| Plugin distribution could blur `/skills` primacy | T3 tasks carry explicit "distribution channel, not entrypoint" constraint; lint check asserts no pack manifest marks plugin as entrypoint. |
| T5 scale (~3,300 strict errors) | Big-batch ordering measured in the July mega-plan; decomposition first makes errors tractable. |
| Live-evidence tasks need a human with real runtimes | T6 tasks are explicitly human-in-the-loop; `blocked` state is acceptable with notes. |
| Copilot version contradiction (2.50.x vs 1.0.x) | T1-01 verifies ground truth before any truth-file edit. |

## 8. Success definition

Program is complete when: all gates green on `main`; runtime truth files verified against ≥ Codex 0.157 / Copilot 1.0.88 reality; emitted skills pass the Agent-Skills validator; MCP emitters carry spec-era awareness; plugin bundles compile for both runtimes; M3 strict folded into CI; T6 verdicts either moved or documented with dated gaps; T7 infra dry-run clean; advanced slices implemented but opt-in; toolchain verified on Node 24 + 26.
