---
id: T2-04
track: T2
title: Manifest-v2 schema — spec_era on required_mcp_servers
status: done
depends_on: [T2-01]
est_size: M
claimed_by: devin
claimed_at: 2026-09-28
completed_at: 2026-09-28
evidence:
  summary: >
    PHASE4_SCHEMA_VERSION bumped 2.1.0 -> 2.2.0. required_mcp_servers entries
    gained optional spec_era (legacy|modern|dual); required explicitly at
    schema 2.2.0 (PSM033), normalized to "dual" with a normalization warning
    for 2.1.0/legacy manifests. All 11 core manifests bumped; 2.1.0 fixtures
    retained as back-compat coverage. JSON schema doc, contract-engine
    schema_refs, doctor/lint remediation text, and architecture docs updated.
  schema_diff: "manifest-v2.schema.ts picklist [2.1.0, 2.2.0]; spec_era optional picklist; MCP_SPEC_ERAS const"
  back_compat: "2.1.0 fixture manifests validate clean; spec_era defaults to dual with recorded warning"
  tests: "4 new spec_era tests (positive, required-at-2.2.0, normalize-default, invalid era) — spec-core 54/54"
  gates: "lint OK; typecheck OK; test OK; test:compat OK; sync:compat-lab --check OK"
  commit: pending
---

## Objective

Extend the pack-manifest-v2 schema so `required_mcp_servers` entries can declare which MCP spec era they target (`legacy` 2025-11-25 / `modern` 2026-07-28 / `dual`), making MCP compatibility explicit instead of assumed.

## Context & sources

- MCP 2026-07-28 is a breaking revision (FEATURE-INVENTORY MP-01..MP-11): stateless core, per-request `_meta`, `server/discover`, header routing, deprecation policy.
- Current manifest field: `required_mcp_servers: []` (empty in all core packs today — check each manifest for declared entries; advanced packs may have entries).
- Schema files: `packages/core/spec-core/src/manifest-v2.schema.ts`, `manifest-v2.normalize.ts`, `manifest-v2.types.d.ts`; valibot-based.
- Schema versioning discipline: check `schema_version` handling — adding a field may need `2.1.0 → 2.2.0` bump + normalize defaults for older manifests (backward-compat).

## Files to touch

- `packages/core/spec-core/src/manifest-v2.schema.ts`, `manifest-v2.normalize.ts`, `manifest-v2.types.d.ts`
- `packages/core/spec-core/src/validate*.ts` — validation for the new field
- `packs/*/pack.manifest.yaml` — populate `spec_era` where MCP deps are declared (if none exist, schema-only change is still valid)
- `tests/` — schema validation tests (positive/negative)
- Do NOT touch: emitters (T2-05 consumes the field), doctor

## Work steps

1. Inspect `required_mcp_servers` shape in schema + all pack manifests — are entries strings or objects? If strings, the change is a shape extension (backward-compat: accept string → normalize to `{name, spec_era: "unverified"}`? NO — fail closed: require explicit era when declared, or default `"dual"` with warning — decide per charter fail-closed principle; prefer explicit).
2. Add `spec_era` enum field (`legacy | modern | dual`) to manifest schema + normalize + types; bump `schema_version` minor.
3. Validator: reject unknown eras; warn when `required_mcp_servers` non-empty without era on old schema_version.
4. Update affected manifests (any pack declaring MCP deps).
5. Tests: valid eras pass, invalid era fails closed, old-schema manifests normalize correctly.
6. Gates: lint (manifest validation), test, typecheck, test:compat.

## Constraints (STRICT)

- MUST be backward-compatible: manifests at older schema_version must still validate (normalize supplies defaults) OR lint must produce a clear migration error — never silent misparse (C.5).
- MUST NOT default silently to `modern` — era claims must be explicit or `dual`-with-warning; era uncertainty is honest data.
- MUST bump `schema_version` and update every reference to the old version (deterministic find-all, no stragglers).
- MUST keep schema validation errors machine-readable (reason codes per existing convention).

## Acceptance gates

- [ ] New field validates correctly (positive/negative tests)
- [ ] All existing manifests still validate (back-compat)
- [ ] `npm run lint`, `npm run test`, `npm run typecheck`, `npm run test:compat` green
- [ ] schema_version bump consistent across schema + docs references

## Evidence to record

- Schema diff; back-compat test results; version-bump sweep list.

## Rollback

`git revert` — schema change self-contained; manifests revert together.
