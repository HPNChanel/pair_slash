# ci-engine

TypeScript implementation of the Phase 11 CI lane (advanced, opt-in,
experimental).

Current responsibility:

- explicit, opt-in CI lane execution only
- artifact-first and report-first outputs
- read-only repo scan plus deterministic validation checks
- optional patch artifact generation (proposal only) written via
  `writeCiProposals` to `.pairslash/staging/ci-proposals/<ci_run_id>/` —
  never auto-applied; there is no apply path
- provenance metadata with fake-vs-live evidence labeling; proposal writes are
  fail-closed on incomplete provenance (explicit `ci_run_id`, `commit_sha`,
  resolved capability flags required)
- policy verdicts for CI actions (`allow`, `ask`, `deny`, `require-preview`)

Out of scope in this slice:

- direct commit or merge
- direct Global Project Memory writes
- direct writes into `.pairslash/project-memory`
- CI vendor-specific integrations
- background jobs, daemons, or implicit triggers
