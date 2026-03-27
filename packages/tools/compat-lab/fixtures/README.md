# Compat-Lab Fixtures

Phase 4 fixtures are environment models for compiler, install, and doctor regression coverage.

- `repo-basic-readonly`: baseline read-only installability
- `repo-write-authority-memory`: write-authority and Global Memory layout
- `repo-backend-mcp`: MCP/tool declaration and degraded doctor coverage
- `repo-monorepo-workspaces`: nested workspace path resolution
- `repo-conflict-existing-runtime`: unmanaged runtime footprint and orphaned state

These fixtures are materialized into temp repos during tests. Source packs are copied from the main `packs/core/` tree and selectively mutated per fixture to keep one-spec-two-runtimes coverage while avoiding duplicate pack sources inside the lab.

## Acceptance slice

Phase 4 acceptance uses `repo-basic-readonly` as the pilot repo fixture for
time-to-first-success, fresh install, update override preservation, and safe
uninstall. Negative doctor coverage reuses `repo-conflict-existing-runtime`
instead of creating a second pilot repo so the acceptance slice stays small and
deterministic.
