# Advanced Packages

This directory is reserved for Phase 11 advanced optional lanes.

Public release label for everything here: `experimental`.
Runtime support expectation: `design-only` until live evidence exists.
Canonical maintainer-local docs for this slice live outside the public docs
surface, not in this directory.

Rules:

- not part of the current root npm workspace list
- not part of the current core install path
- not imported by core packages in the design-only slice
- not a place to bypass PairSlash memory or policy boundaries

Current scaffold:

- `ci-engine`
- `delegation-engine`
- `retrieval-engine`
- `retrieval-index`
- `retrieval-skill`

Current prototype package:

- `ci-engine` includes an explicit opt-in CI slice with report-first outputs,
  policy gating, provenance metadata, and proposal-only patch artifacts.
- `delegation-engine` includes a scaffold-only slice with explicit delegation
  policy, authority-subset checks, and non-authoritative result envelopes.
- `retrieval-engine` includes an explicit-invocation read-only slice with
  policy gating and non-authoritative labeling.

This directory must not become a public onboarding surface or an alternate
front door beside `/skills`.
