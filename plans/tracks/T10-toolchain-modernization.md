# Track T10 — Toolchain modernization

**Status:** Done | **Priority:** P2 | **Depends on:** T0
**Goal:** Align the toolchain with the Oct-2026 reality: Node 26 Active LTS window, Node 24 maintenance, current npm, real cross-OS CI lanes, and refreshed supply-chain gates.

## Context

- Node 26.x is Current now and becomes Active LTS 2026-10-28; Node 24 drops to maintenance 2026-10-20. Engines currently `>=24.0.0` — correct floor, but 26 must be *verified* and added to CI before LTS day. New cadence (1 major/yr, all-LTS) starts with Node 27 — maintainers should expect the next bump cycle April 2027.
- CI quick-checks run ubuntu-only; nightly has the 3-OS matrix. The deterministic acceptance lane should cover macOS/Windows on PRs (within reason/cost).
- `npm audit` runs on quick-checks; the release lane should also emit an SBOM artifact (July M1 intent — verify current state).
- `packageManager` pin vs reality fixed in T0-03; this track handles structural toolchain concerns.

## Entry gate

- T0 green.

## Tasks (ordered)

| Task | Title | Depends on |
| --- | --- | --- |
| T10-01 | Node 26 CI matrix entry + compatibility verification | — |
| T10-02 | Engines/`@types/node` alignment at Node 26 LTS + cadence doc | T10-01 |
| T10-03 | Cross-OS PR acceptance lanes (macOS/Windows deterministic) | — |
| T10-04 | Release-lane SBOM artifact + audit hardening | — |
| T10-05 | Contributor/dev docs refresh (CONTRIBUTING.md, AGENTS.md sync) | T10-02 |

## Exit gate

- CI green on Node 24 AND Node 26 (matrix or dual-lane).
- `@types/node` matches the max tested major; `engines` reflects tested reality.
- Deterministic acceptance runs on macOS + Windows PR lanes (or documented cost decision).
- Release lane produces an SBOM artifact; `npm audit --omit=dev --audit-level=high` enforced.

## Risks

- Node 26 type-stripping behavior may differ subtly (e.g., `--experimental-strip-types` default changes, erasableSyntaxOnly) — T10-01 must verify `node packages/tools/cli/src/bin/pairslash.ts` runs clean on both majors.
- Real-OS PR lanes cost minutes — mitigate by gating them to relevant file paths if needed; record the decision.
