# PairSlash Pack Lifecycle Checklist

Use this checklist when adding, previewing, promoting, deprecating, or
archiving a core PairSlash pack after Phase 14.

This document is maintainer-only operational guidance.
It does not widen runtime support claims, release scope, or product-validation
status on its own.

## Truth stack

- Authoritative pack truth: `packs/core/*/pack.manifest.yaml`
- Pack catalog consumer API: `packages/core/spec-core/src/pack-catalog.js`
- Derived pack index only: `packages/core/spec-core/registry/packs.yaml`
- Runtime support truth: `docs/compatibility/runtime-surface-matrix.yaml`
- Live runtime promotion evidence: `docs/compatibility/runtime-verification.md`
- Public claim guardrail: `docs/releases/public-claim-policy.md`

Do not hand-edit the derived index.
Do not treat `packages/core/spec-core/specs/*.spec.yaml` or
`packs/core/*/pack.trust.yaml` as a competing truth root.

## Add

- Create the pack under `packs/core/<pack-id>/`.
- Add `pack.manifest.yaml` and make it pass the v2 schema and conformance gates.
- Keep `canonical_entrypoint: /skills`.
- Fill `catalog.pack_class`, `catalog.maturity`, `catalog.docs_visibility`,
  `catalog.default_discovery`, `catalog.default_recommendation`,
  `catalog.release_visibility`, and `catalog.deprecation_status`.
- Fill `support.publisher`, `support.tier_claim`,
  `support.support_level_claim`, `support.runtime_support.codex_cli`,
  `support.runtime_support.copilot_cli`, and `support.maintainers`.
- If `support.runtime_support.<runtime>.status` is `supported` or `partial`,
  provide `evidence_ref`. Do not leave it blank.
- Keep direct invocation narrower than or equal to `/skills`.
  If runtime proof is missing, mark direct invocation `unverified`.
- Add `docs_refs`, `runtime_assets`, `asset_ownership`, and `smoke_checks`.
- If the pack is public, set machine-readable `maturity` and
  `support_level_claim` before asking for review.
- If a spec file or trust descriptor exists, sync it from the manifest after
  the manifest is final. Do not start from the downstream file.

## Preview

- Default new public packs to `catalog.maturity: preview` or `canary` unless
  there is already review-approved reason to start at `stable`.
- Default new public packs to `support.support_level_claim: official-preview`
  unless live pack-scoped evidence justifies something stronger.
- Keep `catalog.default_recommendation: false` unless the pack is meant to be
  the default discover/recommend path.
- Do not treat `docs/compatibility/runtime-surface-matrix.yaml` alone as
  promotion proof. `lane-matrix` evidence can support preview wording but does
  not make the pack promotion-ready.
- Make sure `catalog.default_recommendation: true` never appears with
  `catalog.default_discovery: false`.
- Keep `docs_visibility` and `release_visibility` aligned with how public the
  pack is actually allowed to be.

## Promote

- Promote only from the manifest, not by editing release docs first.
- Update `catalog.maturity` and `support.support_level_claim` together when the
  pack is moving to a stronger public posture.
- Keep `catalog.maturity` equal to `release_channel`.
- For every runtime surface that is required for promotion, use
  `evidence_kind: pack-runtime-live` and point `evidence_ref` at real live
  proof recorded in `docs/compatibility/runtime-verification.md` or the linked
  pack-scoped evidence artifact.
- Do not promote from `doctor`, `preview`, compat-lab, or acceptance alone.
  Those are not live pack-runtime promotion evidence.
- Update `docs/compatibility/runtime-surface-matrix.yaml` and the derived
  public compatibility markdown if the pack promotion changes the public support
  story.
- Recheck whether `catalog.default_recommendation` should change.
  Do not make a `canary` or `preview` pack the default by accident.
- Re-run release gates before merging.

## Deprecate

- Change `status` to `deprecated` when the pack is no longer recommended.
- Change `catalog.deprecation_status` to `deprecated`.
- Fill `catalog.replacement_pack` when there is a successor pack.
- Add `catalog.backward_compatibility_notes` when users need migration or
  behavior caveats.
- Lower `catalog.release_visibility` or `catalog.docs_visibility` if the pack
  should stop appearing in the main public path.
- If the pack stays installable for compatibility, keep support wording honest.
  `deprecated` does not automatically mean `unsupported`.
- Update release wording if a public pack is deprecated.

## Archive

- Treat archive as a guarded path. The schema supports it, but the repo does
  not yet have an operational archived core pack example.
- Set `status: deprecated` before setting
  `catalog.deprecation_status: archived`.
- Remove the pack from default discovery and recommendation.
- Lower `catalog.docs_visibility` to `maintainer` or `hidden`.
- Lower `catalog.release_visibility` to `appendix` or `hidden`.
- Keep enough manifest metadata in place for catalog regeneration and
  compatibility/report consumers to stop cleanly. Do not create orphaned docs
  or orphaned derived metadata.
- If the pack is replaced, keep `replacement_pack` and compatibility notes
  until the removal path is clear in docs and release notes.
- Only delete files after catalog consumers, lint, and release checks prove the
  removal is clean.

## Required checks

Run these after any lifecycle change:

- `npm run lint`
- `node --test packages/core/spec-core/tests/manifest-v2.conformance.test.js`
- `node --test packages/tools/compat-lab/tests/matrix.test.js`
- `npm run test`

Run these in addition after `promote`, `deprecate`, or `archive`:

- `npm run test:release`

## Maintainer mistakes to avoid

1. Editing `packages/core/spec-core/registry/packs.yaml` directly instead of the
   manifest source.
2. Marking a runtime surface `supported` or `partial` without `evidence_ref`.
3. Treating `lane-matrix` evidence as if it were `pack-runtime-live`.
4. Letting direct invocation claim more support than `/skills`.
5. Setting `catalog.maturity` to a value that does not match `release_channel`.
6. Turning on `default_recommendation` for a pack that is not meant to be the
   canonical default path.
7. Forgetting to update runtime-support docs when a public support claim changes.
8. Deprecating a pack without `replacement_pack` or compatibility notes when a
   migration path exists.
9. Archiving a pack by deleting files first and discovering orphaned catalog
   references later.
10. Using docs, specs, or trust shims as the authority layer when they disagree
    with `packs/core/*/pack.manifest.yaml`.
