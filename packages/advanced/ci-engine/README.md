# ci-engine

Prototype slice for the Phase 11 CI lane.

Current responsibility:

- explicit, opt-in CI lane execution only
- artifact-first and report-first outputs
- read-only repo scan plus deterministic validation checks
- optional patch artifact generation (proposal only)
- provenance metadata with fake-vs-live evidence labeling
- policy verdicts for CI actions (`allow`, `ask`, `deny`, `require-preview`)

Out of scope in this slice:

- direct commit or merge
- direct Global Project Memory writes
- direct writes into `.pairslash/project-memory`
- CI vendor-specific integrations
- background jobs, daemons, or implicit triggers
