# PairSlash CI Lane Contract (Prototype Slice)

This advanced lane is optional and isolated from core discovery/install flow.

## Authority Model

- Explicit opt-in is mandatory.
- Report-first and artifact-first outputs are mandatory.
- CI lane cannot commit or merge by default.
- CI lane cannot write Global Project Memory.
- CI lane cannot silently promote candidate memory writes.

## Allowed Surface in This Slice

- read repository files inside declared repo boundary
- run deterministic validation checks in disposable execution context
- generate patch or diff proposal artifacts (manual apply only)
- emit provenance metadata and policy verdict records

## Explicitly Forbidden Surface

- direct repository commit or merge
- direct writes under `.pairslash/project-memory`
- direct call path to Global Project Memory write authority
- implicit CI trigger or background execution
