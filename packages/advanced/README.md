# Advanced Packages

This directory holds Phase 11 advanced optional lanes: implemented slices
that remain experimental and opt-in.

Public release label for everything here: `experimental`.
Runtime support expectation: `unverified` until live evidence exists —
implemented does not mean stable or shipped.
Canonical maintainer-local docs for this slice live outside the public docs
surface, not in this directory.

Rules:

- not part of the current root npm workspace list
- not part of the current core install path
- not imported by core packages
- not a place to bypass PairSlash memory or policy boundaries

Current packages (all implemented, all experimental):

- `ci-engine` — explicit opt-in CI slice with report-first outputs, policy
  gating, provenance metadata, and proposal-only patch artifacts under
  `.pairslash/staging/ci-proposals/`; no apply path exists
- `delegation-engine` — bounded delegation slice with explicit policy,
  authority-subset checks against `trust/pack-authority.yaml`, and
  non-authoritative result envelopes that route durable writes back through
  `pairslash-memory-write-global`
- `retrieval-engine` — explicit-invocation read-only slice with policy
  gating and non-authoritative `retrieved` labeling
- `retrieval-index` — deterministic on-disk index over `.pairslash/` read
  surfaces under `.pairslash/observability/indexes/retrieval/`; never writes
  to memory surfaces
- `retrieval-skill` — descriptor for the retrieval pack's explicit install
  lane

This directory must not become a public onboarding surface or an alternate
front door beside `/skills`.
