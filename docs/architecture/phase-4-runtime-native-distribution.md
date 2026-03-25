# PairSlash Phase 4 Runtime-Native Distribution

Phase 4 introduces a managed install layer without changing the PairSlash runtime boundary:

- only `codex-cli` and `github-copilot-cli` are supported
- canonical entrypoint remains `/skills`
- `packs/core/` remains source-of-truth
- runtime install paths remain derived artifacts

## Core model

- `pack.manifest.yaml` v2 sits next to each source pack and defines the install/distribution contract.
- compiler v2 emits deterministic runtime-native outputs for Codex CLI and Copilot CLI.
- install/update/uninstall operate through a preview plan and a repo-local install state under `.pairslash/install-state/`.
- `pairslash.install.json` is generated into each compiled pack footprint so ownership is explicit.

## Ownership rules

- PairSlash only removes files it created.
- Existing local files on override-eligible paths are preserved.
- Preserved overrides remain visible in update previews and doctor verdicts.
- Local install state tracks `owned_by_pairslash` separately from `local_override`.

## Command surface

- `pairslash preview install|update|uninstall`
- `pairslash install`
- `pairslash update`
- `pairslash uninstall`
- `pairslash doctor`
- `pairslash lint --phase4`

## Runtime mapping references

- `docs/runtime-mapping/codex-cli.md`
- `docs/runtime-mapping/copilot-cli.md`
- `docs/runtime-mapping/pilot-acceptance.md`

These pages document where each logical install surface lands on each runtime.
They are descriptive companions to the compiler and adapter code, not a second
spec source.

## Bridge scope

Phase 4 intentionally stops at:

- deterministic compilers
- managed lifecycle commands
- doctor verdicts
- bridge lint
- compat-lab bootstrap

It does not add:

- third runtimes
- remote registries
- auto-update daemons
- hardening automation beyond local bridge checks

Internal release gating for this phase is tracked in
`docs/releases/release-checklist-0.4.0.md`.
