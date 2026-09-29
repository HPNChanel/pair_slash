# Advanced Packs

This path is reserved for future advanced optional packs.

Public release label for everything here: `experimental`.
These packs are non-core and must not be presented as part of the default
PairSlash install path or first-run workflow story.

Current PairSlash core discovery reads from `packs/core/` only, so anything in
`packs/advanced/` is intentionally outside default discovery and install flow.

Explicit install lane: an advanced pack is installable only by naming it,
e.g. `pairslash install --packs pairslash-retrieval-addon`. Default selection,
`--pack-set`, and `--all` never include advanced packs. The install emits the
pack's `SKILL.md` plus a `pairslash.addon.yaml` descriptor (capability flags,
policy contract, provenance) into the pack's runtime skill dir; uninstall
removes that managed footprint. In-place `update` is denied — advanced packs
change via uninstall + reinstall.

No advanced pack manifest should be treated as shippable until an advanced
discovery and policy layer exists.

Current advanced prototype:

- `packs/advanced/ci/pack.manifest.yaml` (lane-local, non-core)
- `packs/advanced/delegation/pack.manifest.yaml` (lane-local, non-core)
- `packs/advanced/retrieval/pack.manifest.yaml` (lane-local, non-core)

Canonical maintainer-local docs for these packs live outside the public docs
surface.
