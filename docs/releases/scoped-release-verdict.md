# PairSlash Scoped Release Verdict

Gate status: GO
Last updated: 2026-04-02
Truth class: scoped-release
Claim scope: phase4-installability-substrate
Validated runtimes: codex_cli, copilot_cli

This file owns scoped release/installability truth only.
It does not own the official phase statement, and it does not decide
product-validation exit.

This file answers one question only:

Can PairSlash make a scoped public release/installability claim without also
claiming product-validation exit?

## Current decision

Yes, for a scoped claim.

PairSlash can publicly claim a technically shipped installability substrate for
exactly two runtimes, with `/skills` as the canonical front door and explicit,
preview-first managed commands (`doctor`, `preview`, `install`, `update`,
`uninstall`).

## What this verdict proves

- Managed lifecycle behavior is implemented, test-covered, and release-gated.
- Preview-first mutation, override preservation, ownership tracking, and
  rollback-safe behavior are part of the shipped surface.
- Doctor is a machine-readable diagnosis surface for runtime detection, path
  checks, permission checks, support-lane reporting, and install blocking state.
- Compatibility docs are generated from deterministic compat-lab metadata and
  kept in sync by tests.
- `npm run test:release` passes on the current branch as of 2026-04-02.

## What this verdict does not prove

- Product validation, benchmark wins, or market validation.
- Weekly reuse, must-win wedge success, or business pull.
- Runtime parity beyond the exact lane evidence in compatibility and runtime
  verification docs.
- Legal/package publicness beyond current repository metadata.

## Required companion sources

- Program phase truth: `docs/phase-12/authoritative-program-charter.md`
- Product-validation truth: `docs/validation/phase-3-5/verdict.md`
- Public claim policy: `docs/releases/public-claim-policy.md`
- Runtime support boundary: `docs/compatibility/compatibility-matrix.md`
- Runtime promotion evidence: `docs/compatibility/runtime-verification.md`
- Shipped-scope boundary: `docs/releases/phase-5-shipped-scope.md`

## Update rule

Change this file back to `Gate status: NO-GO` if managed lifecycle trust
guarantees regress, compatibility artifacts drift from generation, or release
readiness stops passing.
