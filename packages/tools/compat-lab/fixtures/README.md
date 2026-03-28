# Compat-Lab Fixtures

Phase 6 fixtures are checked-in repo templates plus deterministic overlays used
to exercise compiler, installer, doctor, preview, policy, and regression
behavior before merge or release.

Every fixture carries explicit metadata:

- why it exists
- which workflows it exercises
- what risks it models
- which runtime lanes it is intended to cover
- which capabilities must remain available

Required archetypes in the checked-in corpus:

- `repo-monorepo-workspaces`
- `repo-node-service`
- `repo-python-service`
- `repo-docs-heavy`
- `repo-infra-repo`
- `repo-unsafe-repo`

Support fixtures retained for regression control:

- `repo-basic-readonly`
- `repo-write-authority-memory`
- `repo-backend-mcp`
- `repo-conflict-existing-runtime`

Fixtures are materialized into temp repos during tests. Canonical pack source
still comes from `packs/core/`; compat-lab never forks PairSlash runtime logic
into fixture-specific pack copies.

## Design Rules

- Fixture repos should feel like small real repos, not toy folders.
- Ordering and generated metadata must stay deterministic.
- Multi-language corpus is allowed inside compat-lab even though PairSlash
  implementation remains Node-only.
- Runtime differences stay in adapters and lane expectations, not in duplicated
  source specs.
