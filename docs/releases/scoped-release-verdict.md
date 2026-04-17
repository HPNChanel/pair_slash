# PairSlash Scoped Release Verdict

Gate status: NO-GO
Last updated: 2026-04-17
Truth class: scoped-release
Claim scope: phase20-release-trust-activation
Release-covered runtimes: codex_cli, copilot_cli

This file owns scoped release/installability truth only.
It does not own the official phase statement, and it does not decide
product-validation exit.

This file answers one question only:

Can PairSlash make a scoped public release/installability claim without also
claiming product-validation exit?

## Current decision

Not yet.

PairSlash has the scoped release-trust implementation and local release gates,
but this branch is blocked from a shipped scoped release claim until at least
one protected `release-trust-candidate` run succeeds with an uploaded signed
bundle artifact.

## What this verdict proves

- Managed lifecycle behavior is implemented, test-covered, and release-gated.
- Preview-first mutation, override preservation, ownership tracking, and
  rollback-safe behavior are part of the shipped surface.
- Doctor is a machine-readable diagnosis surface for runtime detection, path
  checks, permission checks, support-lane reporting, install blocking state,
  and installed trust posture review.
- Release-readiness now requires release-trust bundle build plus structural
  checksum verification on the current branch.
- The first-party public trust root is checked into
  `trust/first-party-keys.json`, and protected CI is the only approved lane
  for live-signed release-trust bundles.
- Protected release lanes enforce
  `PAIRSLASH_RELEASE_TRUST_REQUIRE_SIGNED=1`, so missing signing material is a
  hard failure instead of a soft skip.
- `trust/pack-authority.yaml` now centrally controls `core-maintained` status
  and high-risk capability authority.
- Compatibility docs are generated from deterministic compat-lab metadata and
  kept in sync by tests.

## What this verdict does not prove

- Product validation, benchmark wins, or market validation.
- Weekly reuse, must-win wedge success, or business pull.
- Runtime parity beyond the exact lane evidence in compatibility and runtime
  verification docs.
- Signed release publication on every fork or clone without protected signing
  configuration.
- Legal/package publicness beyond current repository metadata.
- Live runtime support promotion beyond the checked-in lane records.

## Required companion sources

- Program phase truth: `docs/phase-12/authoritative-program-charter.md`
- Product-validation truth: `docs/validation/phase-3-5/verdict.md`
- Public claim policy: `docs/releases/public-claim-policy.md`
- Legal/package status boundary: `docs/releases/legal-packaging-status.md`
- Runtime support boundary: `docs/compatibility/compatibility-matrix.md`
- Runtime promotion evidence: `docs/compatibility/runtime-verification.md`
- Shipped-scope boundary: `docs/releases/phase-5-shipped-scope.md`

## Update rule

This file must return to `Gate status: NO-GO` if `npm run test:release` fails,
if release wording outruns the checked-in support evidence, or if the scoped
release story starts implying package publication or runtime parity beyond the
documented lanes.
