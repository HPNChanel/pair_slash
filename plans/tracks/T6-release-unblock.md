# Track T6 — Release unblocks (R1–R3 merged)

**Status:** Approved | **Priority:** P1 (verdict movement) | **Depends on:** T0, T1
**Goal:** Move the three standing `NO-GO`/stale verdicts: record the first official Phase-19 benchmark round (R1), complete one protected signed `release-trust-candidate` run (R2), and capture canonical `/skills` live evidence on at least one lane (R3). Several steps are **human-in-the-loop** — a blocked state with notes is acceptable and honest.

## Context

From the July roadmap (unchanged intent, refreshed target versions):
- Product-validation `NO-GO` (`docs/validation/phase-3-5/verdict.md`): benchmark apparatus exists (`npm run benchmark:*`); no official round ever recorded.
- Scoped-release `NO-GO` (`docs/releases/scoped-release-verdict.md`): signing infra + protected CI exist; no successful signed-bundle run.
- Runtime lanes all `prep`/`degraded`: no canonical `/skills` live captures. Note: Copilot's `/skills` surface is now a **dashboard** (CP-05) — capture steps must reflect the real interaction.

## Entry gate

- T0 green; T1 realigned truth (benchmarks/lane captures must run against current runtime versions).

## Tasks (ordered)

| Task | Title | Depends on |
| --- | --- | --- |
| T6-01 | R1 — record official Phase-19 benchmark round 1 | — |
| T6-02 | R2 — protected signed release-trust-candidate run | — |
| T6-03 | R3 — live `/skills` evidence capture on ≥1 lane | — |
| T6-04 | Update verdict docs + claim sync (only if evidence moved) | T6-01, T6-02, T6-03 |

## Exit gate

- `benchmark-truth.yaml` records ≥1 official run OR `verdict.md` documents a dated specific gap.
- A signed release-trust artifact verifies locally OR the gap is recorded with date + missing piece.
- ≥1 lane reaches `preview` via a schema-valid lane record, OR lanes remain prep/degraded with refreshed dated notes.
- Verdict/claim files updated **only** insofar as evidence actually moved (C.6 — no ladder skipping).

## Risks

- Human-only steps (real runtime access, GitHub secrets, signing key custody) may block — record precisely what a human must do.
- Live capture on the new dashboard surface differs from old picker evidence — lane record schema may need a `surface_variant` note (checked in T6-03).
- Signing key custody decision (offline HSM/hardware) is out-of-scope for code but required before T7 exit.
