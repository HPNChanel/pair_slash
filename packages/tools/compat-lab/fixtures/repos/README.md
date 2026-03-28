# Compat Fixture Repos

These directories are the checked-in repo roots used by Phase 6 compat-lab.

Each template exists to model a real PairSlash pain point:

- `monorepo/`: workspace root resolution and multi-pack selection
- `node-service/`: backend workflow and generated runtime assets
- `python-service/`: non-Node service repos that still consume PairSlash
- `docs-heavy/`: planning/review surfaces with high doc churn
- `infra-repo/`: config-heavy repo with release and devops workflows
- `unsafe-repo/`: destructive/script-heavy repo for policy and fallback checks

Templates are copied into temp directories and then combined with canonical
packs from `packs/core/` plus deterministic overlays and setup hooks.
