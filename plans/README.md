# plans/ — PairSlash Sep-2026 Upgrade Program

Hierarchical execution plan for realigning PairSlash 0.4.0 with the current runtime ecosystem and finishing the deferred July-2026 tracks.

## Read order

1. [`MASTER.md`](MASTER.md) — program context, track map, sequencing, risks.
2. [`CONSTRAINTS.md`](CONSTRAINTS.md) — **binding global invariants**; read before touching any task.
3. [`EXECUTION.md`](EXECUTION.md) — task lifecycle, gates, evidence rules.
4. [`FEATURE-INVENTORY.md`](FEATURE-INVENTORY.md) — ~84 ecosystem features triaged adopt/defer/reject.
5. [`tracks/`](tracks/) — 11 sub-plans (T0–T10).
6. [`tasks/`](tasks/) — 69 session-sized task files grouped by track.

## Track index

| Track | File | Tasks | Gate |
| --- | --- | --- | --- |
| T0 Stabilize repo | `tracks/T0-stabilize-repo.md` | 4 | prerequisite for all |
| T1 Runtime surface realignment | `tracks/T1-runtime-surface-realignment.md` | 7 | T0 |
| T2 Standards alignment | `tracks/T2-standards-alignment.md` | 8 | T0, T1 |
| T3 Distribution: plugins & marketplaces | `tracks/T3-distribution-plugins.md` | 7 | T2 |
| T4 Runtime capability policy | `tracks/T4-runtime-capabilities-policy.md` | 6 | T1, T2 |
| T5 M3 strict + decomposition | `tracks/T5-m3-strict-and-decomposition.md` | 14 | T0 |
| T6 Release unblocks | `tracks/T6-release-unblock.md` | 4 | T0, T1 |
| T7 Publish prep | `tracks/T7-publish-prep.md` | 4 | T6 all GO |
| T8 Advanced slices | `tracks/T8-advanced-slices.md` | 6 | T5 spec-core clean |
| T9 Ops automation | `tracks/T9-ops-automation.md` | 4 | T5 decomposition done |
| T10 Toolchain modernization | `tracks/T10-toolchain-modernization.md` | 5 | T0 |

## Status legend

Task frontmatter: `todo` → `in_progress` → `done` (or `blocked` with reason). Progress is the source of truth in each `plans/tasks/**.md` file.

## Hard rules (summary — CONSTRAINTS.md is authoritative)

- Two runtimes only; `/skills` canonical; explicit-write-only memory; preview-first; fail-closed; evidence-bounded claims; file-based reviewable truth; no hidden automation; `private: true` stays until T7 gates clear.
- One task = one session = one commit (preferred). All acceptance gates green in the same tree.
- Truth-layer edits sync every downstream rendering in the same commit.
