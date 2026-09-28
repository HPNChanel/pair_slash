---
id: T4-02
track: T4
title: implicit_invocation manifest field + opt-in policy + description-safety lint
status: done
depends_on: []
est_size: M
claimed_by: devin
claimed_at: 2026-09-28
completed_at: 2026-09-28
evidence:
  - "spec-core: implicit_invocation enum (explicit-only | implicit-allowed) in manifest-v2.schema.ts, normalize default to explicit-only, types, yaml schema; ir.pack.implicit_invocation; constants IMPLICIT_INVOCATION_MODES/DEFAULT_IMPLICIT_INVOCATION/IMPLICIT_INVOCATION_MIN_DESCRIPTION_LENGTH=60"
  - "lint-bridge: LINT-INVOKE-001 (error: write-authority + implicit), LINT-INVOKE-002 (warning: implicit-allowed on non-read-oriented), LINT-INVOKE-003 (warning: implicit-allowed + missing/weak description <60 chars); parseSkillFrontmatterFields helper added to skill-spec.ts"
  - "emitters: implicit_invocation surfaced as metadata only — codex codex-metadata.yaml, copilot package.json, emitted SKILL.md metadata map"
  - "all 11 core manifests carry implicit_invocation: explicit-only (per-pack decisions recorded in commit body); no pack opts in today"
  - "no schema version bump — additive optional field with safe default, same discipline as T4-01 hooks"
  - "docs: docs/workflows/implicit-invocation-policy.md + pack-manifest-v2-practical-spec.md field/enum/validation entries"
  - "tests: spec-core 57/57, lint-bridge 28/28 (5 new), npm test all suites pass, npm run lint pass, typecheck pass, npm run test:release pass (gh skill publish --dry-run 11/11)"
---

## Objective

Model implicit invocation (runtime auto-selecting a skill by description match) as a first-class, opt-in manifest policy — default `explicit-only` — with lint rules guarding description hygiene for packs that opt in.

## Context & sources

- Codex: "Implicit invocation — Codex can choose a skill when your task matches the skill description" (CX-03); explicit via `/skills` or `$mention`.
- Copilot: skills selectable via dashboard + routed by description; agents auto-selected similarly.
- PairSlash risk model: a write-authority workflow auto-triggered by a fuzzy description match is a real hazard (e.g., "save this decision" phrasing could match memory-write-global). Charter automation boundary applies.
- Policy choice (recorded): default `explicit-only`; opt-in values like `implicit-allowed` only for low-risk read-oriented packs; write-authority packs are hard-forbidden from implicit opt-in.

## Files to touch

- `packages/core/spec-core/src/manifest-v2.schema.ts` + normalize + types — `implicit_invocation` field
- `packages/tools/lint-bridge/src/` — rules: write-authority + implicit → error; implicit + missing/weak description → warn
- `packs/core/*/pack.manifest.yaml` — set explicit `implicit_invocation` per pack (default explicit-only for most; decision per pack recorded)
- `docs/workflows/` or policy docs — document the model
- Tests for each rule + manifest updates
- Do NOT touch: emitted SKILL.md `description` content (T2-02 owns frontmatter emission; descriptions may need quality review but not rewrite here)

## Work steps

1. Add `implicit_invocation` enum field to manifest schema: `explicit-only` (default) | `implicit-allowed` (| `implicit-preferred` if justified — decide; prefer minimal enum).
2. Normalize: absent → `explicit-only`; older schema_version manifests normalize safely.
3. Lint rules: (a) write-authority class + `implicit-allowed` → hard error; (b) `implicit-allowed` + description lacking clear trigger keywords → warning; (c) candidate-producing + implicit → warning (policy: review).
4. Set the field in all core manifests explicitly (most `explicit-only`; document each choice).
5. Emitters: surface the policy in emitted metadata/`metadata` map (e.g., `pairslash.implicit_invocation`) — do NOT try to force runtime behavior; this is declared intent + lint discipline.
6. Tests + gates.

## Constraints (STRICT)

- MUST default to `explicit-only` — implicit activation is opt-in, never ambient (charter automation boundary).
- MUST hard-error on write-authority + implicit — no exceptions, no warning-level fallback (C.5).
- MUST NOT claim the field *controls* runtime behavior — it declares intent; runtimes make the call. Wording must be precise.
- Schema version bump discipline per T2-04 pattern.
- MUST NOT weaken description requirements — implicit opt-in packs get *stricter* description lint, not looser.

## Acceptance gates

- [x] Schema field + normalization + lint rules live with tests
- [x] All core manifests carry explicit field values
- [x] Write-authority+implicit combo test fails closed
- [x] Gates green

## Evidence to record

- Per-pack field decisions in commit body; rule list.

## Rollback

`git revert` — additive field with safe default.
