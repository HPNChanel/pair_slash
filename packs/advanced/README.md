# Advanced Packs

This path holds optional advanced packs implemented outside the core product
surface.

Public release label for everything here: `experimental`.
These packs are implemented but unverified at runtime — `runtime_support`
is `unverified` on both lanes until live evidence exists. They are non-core
and must not be presented as part of the default PairSlash install path or
first-run workflow story.

Current PairSlash core discovery reads from `packs/core/` only, so anything in
`packs/advanced/` is intentionally outside default discovery and install flow.

Explicit install lane: an advanced pack is installable only by naming it,
e.g. `pairslash install --packs pairslash-retrieval-addon`. Default selection,
`--pack-set`, and `--all` never include advanced packs. The install emits the
pack's `SKILL.md` plus a `pairslash.addon.yaml` descriptor (capability flags,
policy contract, provenance) into the pack's runtime skill dir; uninstall
removes that managed footprint. In-place `update` is denied — advanced packs
change via uninstall + reinstall.

Shared invariants for every advanced pack:

- report-first, non-authoritative output (`authoritative: false`,
  `truth_tier: supplemental`)
- explicit-only invocation; never implicit on behalf of other workflows
- no writes to `.pairslash/project-memory/` — durable writes route through
  `pairslash-memory-write-global`
- canonical entrypoint stays `/skills`; no new front door

Current advanced packs (all `status: experimental`):

- `packs/advanced/ci/pack.manifest.yaml` — CI lane: report-first structured
  output plus proposal-only patch artifacts under
  `.pairslash/staging/ci-proposals/`; no apply path exists
- `packs/advanced/delegation/pack.manifest.yaml` — delegation lane: bounded
  authority-subset envelopes gated by `trust/pack-authority.yaml`; no write
  path, no chain spawning
- `packs/advanced/retrieval/pack.manifest.yaml` — retrieval lane: read-only
  supplemental evidence lookup over `.pairslash/` surfaces

No advanced pack manifest should be treated as shippable until an advanced
discovery and policy layer exists; `experimental` is a status label, not a
promotion into the core catalog.

Canonical maintainer-local docs for these packs live outside the public docs
surface.
