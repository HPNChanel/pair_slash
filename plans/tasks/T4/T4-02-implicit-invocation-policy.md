---
id: T4-02
track: T4
title: implicit_invocation manifest field + opt-in policy + description-safety lint
status: todo
depends_on: []
est_size: M
claimed_by:
claimed_at:
completed_at:
evidence:
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

- [ ] Schema field + normalization + lint rules live with tests
- [ ] All core manifests carry explicit field values
- [ ] Write-authority+implicit combo test fails closed
- [ ] Gates green

## Evidence to record

- Per-pack field decisions in commit body; rule list.

## Rollback

`git revert` — additive field with safe default.
