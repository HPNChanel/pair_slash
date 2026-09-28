---
id: T2-01
track: T2
title: Agent Skills spec validator in spec-core + lint-bridge wiring
status: done
depends_on: []
est_size: M
claimed_by: devin-session
claimed_at: 2026-09-28
completed_at: 2026-09-28
evidence:
  - packages/core/spec-core/src/skill-spec.ts — full spec validator (name charset/length/edge-hyphens/dir-match, description cap, license/compatibility/metadata/allowed-tools types, control chars, wrong-casing, duplicate keys via uniqueKeys, unknown fields as warnings)
  - lint rule LINT-SKILLSPEC-001/002/003 wired in lint-bridge; all 11 core packs pass, 33 informational warnings (missing optional fields — T2-02 populates)
  - packages/core/spec-core/tests/skill-spec.test.js — 14 tests incl. all-packs conformance sweep; registered in run-compat-lab-tests.mjs
  - gates: lint, typecheck, npm run test, sync:compat-lab --check green; no as any/ts-ignore added
---

## Objective

Implement a validator for the Agent Skills open specification (agentskills.io) in `spec-core`, then wire it into `lint-bridge` so every pack's emitted SKILL.md is spec-checked at lint time.

## Context & sources

- Spec fields (agentskills.io/specification): `name` required ≤64 chars, `[a-z0-9-]` only, no edge/consecutive hyphens, **must match parent dir name**; `description` required ≤1024 non-empty; optional `license`, `compatibility` ≤500, `metadata` map<string,string>, `allowed-tools` experimental space-separated.
- Structure: `SKILL.md` at dir root; optional `scripts/`, `references/`, `assets/` subdirs; unknown top-level frontmatter fields ignored for forward-compat; invalid YAML/duplicate recognized fields/wrong casing = load failure in strict readers.
- Security: Copilot sanitizes control chars in skill listings (CP-18) — validator should reject terminal control characters in `name`/`description`.
- Existing surface: `spec-core/src/validate*.ts`, `manifest-v2.schema.ts`; lint rules live in `packages/tools/lint-bridge/src/`.

## Files to touch

- New: `packages/core/spec-core/src/skill-spec.ts` (validator module — or `validate/skill-spec.ts` if T5-01 decomposition already landed; check layout first)
- `packages/tools/lint-bridge/src/` — new lint rule wiring
- `packages/core/spec-core/tests/` or `tests/` — validator test cases (valid/invalid frontmatter, dir-name match, control chars, unknown fields)
- Do NOT touch: pack SKILL.md sources (that's T2-02/T2-03 if fixes are needed), manifest schema

## Work steps

1. Write validator: parse SKILL.md frontmatter (use existing `yaml` dep), check name rules, description rules, optional-field types, dir-name match (take dir path param), control-char rejection, unknown-field warning (not error).
2. Machine-readable verdict: `{ ok, errors[], warnings[] }` consistent with existing validate modules' return shape — read an existing validator first for the pattern.
3. Wire into lint-bridge: add rule that runs the validator against each pack's `SKILL.md` source and (if cheap) the compiled output path convention.
4. Tests: positive (all core packs pass), negative per rule (bad name case, >64 chars, missing dir match, control char, bad metadata type, dup fields).
5. If existing core packs fail → fix the pack source minimally in this commit (name/dir/description fixes only) — do not weaken the validator to pass.
6. Gates: lint, test, typecheck.

## Constraints (STRICT)

- MUST implement the full spec field rules, not a subset — partial validation creates false confidence (C.5 honest failure).
- MUST distinguish errors (spec violation) from warnings (unknown fields, missing optional fields) — never error on forward-compat fields.
- MUST NOT change pack semantics while fixing spec violations (name/dir fixes only).
- MUST NOT validate against runtime-specific extensions as errors — runtime extras are warnings or separate rules.
- Validator MUST be deterministic + side-effect-free (pure function over file content + dir name).

## Acceptance gates

- [ ] Validator covers all spec rules listed in Context
- [ ] Lint runs it on all core packs; packs pass (or are minimally corrected)
- [ ] Negative tests for each rule green
- [ ] `npm run lint`, `npm run test`, `npm run typecheck` green
- [ ] No `as any`/ts-ignore added

## Evidence to record

- List of rules implemented; count of packs validated; any pack fixes needed (signals spec drift in sources).

## Rollback

`git revert` — new module + lint rule are additive; remove cleanly.
