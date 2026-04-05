# PairSlash Scoped Release Verdict

Gate status: NO-GO
Last updated: 2026-04-05
Truth class: scoped-release
Claim scope: phase4-installability-substrate
Release-covered runtimes: codex_cli, copilot_cli

This file owns scoped release/installability truth only.
It does not own the official phase statement, and it does not decide
product-validation exit.

This file answers one question only:

Can PairSlash make a scoped public release/installability claim without also
claiming product-validation exit?

## Current decision

Not on the current branch.

PairSlash still has a technically shipped installability substrate for exactly
two runtimes, with `/skills` as the canonical front door and explicit,
preview-first managed commands (`doctor`, `preview`, `install`, `update`,
`uninstall`), but the current branch is not entitled to a scoped release claim
while release-readiness is failing.

## What this verdict proves

- Managed lifecycle behavior is implemented, test-covered, and release-gated.
- Preview-first mutation, override preservation, ownership tracking, and
  rollback-safe behavior are part of the shipped surface.
- Doctor is a machine-readable diagnosis surface for runtime detection, path
  checks, permission checks, support-lane reporting, and install blocking state.
- Compatibility docs are generated from deterministic compat-lab metadata and
  kept in sync by tests.

## What this verdict does not prove

- Product validation, benchmark wins, or market validation.
- Weekly reuse, must-win wedge success, or business pull.
- Runtime parity beyond the exact lane evidence in compatibility and runtime
  verification docs.
- Legal/package publicness beyond current repository metadata.
- That the current branch is release-ready while `npm run test:release` fails.

## Required companion sources

- Program phase truth: `docs/phase-12/authoritative-program-charter.md`
- Product-validation truth: `docs/validation/phase-3-5/verdict.md`
- Public claim policy: `docs/releases/public-claim-policy.md`
- Legal/package status boundary: `docs/releases/legal-packaging-status.md`
- Runtime support boundary: `docs/compatibility/compatibility-matrix.md`
- Runtime promotion evidence: `docs/compatibility/runtime-verification.md`
- Shipped-scope boundary: `docs/releases/phase-5-shipped-scope.md`

## Update rule

This file must stay `Gate status: NO-GO` until `npm run test:release` is green
again and public support wording stays inside the checked-in live evidence.
