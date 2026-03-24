# Fixture Repos

These directories are the Phase 4 bootstrap layout for compat-lab fixtures.

The current bootstrap keeps fixture source lightweight: test runs materialize temp repos from the fixture registry in `src/fixtures.js` plus selected source packs from `packs/core/`.

Reserved fixture ids:

- `repo-basic-readonly`
- `repo-write-authority-memory`
- `repo-backend-mcp`
- `repo-monorepo-workspaces`
- `repo-conflict-existing-runtime`

If Phase 6 later needs fully checked-in fixture repos, expand these directories instead of changing the Phase 4 smoke API.
