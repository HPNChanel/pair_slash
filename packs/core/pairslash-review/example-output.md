# pairslash-review -- Example Output

## SUMMARY
- subject: Phase 2 memory hardening changes
- scope: `.pairslash/`, `packs/core/`, `packages/spec-core/`
- overall_risk: medium

## FINDINGS
- severity: high
  file_or_area: packs/core/pairslash-memory-write-global
  issue: Missing side-effect contract section in workflow contract docs.
  evidence: contract.md lacks explicit filesystem/git/network side-effect declaration.
  recommended_fix: Add a dedicated side-effect contract section.

## MISSING_TESTS
- golden check for preview patch determinism not present.
- fixture for invalid-scope rejection not present.

## OPEN_QUESTIONS
- Should legacy system records be validated by a dedicated schema or merged into mutable schema?

## RECOMMENDATION
- status: proceed-with-fixes
- next_workflow: pairslash-plan

