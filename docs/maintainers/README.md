# PairSlash Maintainers

This entrypoint is for triage, support routing, and release hygiene.
It complements `docs/phase-9/maintainer-playbook.md` with operational links used during daily issue handling.

## Start Here

- Support triage flow: `docs/support/triage-playbook.md`
- Reproduction evidence requirements: `docs/support/repro-assets.md`
- Taxonomy and labels: `docs/phase-9/issue-taxonomy.md`
- Maintainer decision model: `docs/phase-9/maintainer-playbook.md`

## Release Hygiene

- Shipped scope guardrail: `docs/releases/phase-5-shipped-scope.md`
- Validation guardrail: `docs/validation/phase-3-5/verdict.md`
- Compatibility wording guardrail: `docs/compatibility/compatibility-matrix.md`
- Runtime promotion evidence: `docs/compatibility/runtime-verification.md`

## Regression Handling

- Treat `severity:s0` and `severity:s1` as release-critical until fixed or claim-downgraded.
- Require deterministic regression coverage for lifecycle and memory trust issues.
- Keep docs claims synchronized with compatibility and runtime-verification evidence.
- Route docs overclaim to docs downgrade when code is operating as documented scope allows.

