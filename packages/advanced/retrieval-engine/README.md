# retrieval-engine

Prototype slice for the Phase 11 Retrieval Lane.

Current responsibility:

- explicit, opt-in retrieval queries only
- repo-local and artifact-local read-only lookup
- result labeling as non-authoritative retrieved evidence
- conflict resolution helper where Global Project Memory always wins
- policy verdicts for retrieval actions (`allow`, `ask`, `deny`, `require-preview`)

Out of scope in this slice:

- Global Project Memory writes
- task/session/staging writes
- runtime install changes
- background crawling or auto-index daemons
- external connectors enabled by default
