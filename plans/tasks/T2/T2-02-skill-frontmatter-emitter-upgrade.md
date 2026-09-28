---
id: T2-02
track: T2
title: SKILL.md frontmatter emitter upgrade (license, compatibility, metadata)
status: todo
depends_on: [T2-01]
est_size: M
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Upgrade both runtime compilers' SKILL.md emission to populate the spec's optional fields — `license`, `compatibility`, `metadata` — from pack manifest data, so emitted skills are richer than the minimal `name`+`description`.

## Context & sources

- Spec optional fields: `license` (emit `Apache-2.0` for first-party packs), `compatibility` ≤500 (runtime version floors from manifest `supported_runtime_ranges`), `metadata` map (carry `pack_id`, `pack_version`, `workflow_class`, checksum/provenance).
- `allowed-tools` is experimental and runtime-divergent — do NOT emit it (FEATURE-INVENTORY SK-06 defer).
- Progressive disclosure (SK-11): `description` must be self-sufficient for routing — verify emitted descriptions include trigger keywords.
- Emitters: `packages/runtimes/codex/compiler/src/`, `packages/runtimes/copilot/compiler/src/` — check goldens under `tests/golden`/`tests/contracts` for expected output shapes.

## Files to touch

- `packages/runtimes/codex/compiler/src/*.ts` — SKILL.md frontmatter assembly
- `packages/runtimes/copilot/compiler/src/*.ts` — same
- `tests/golden/*`, `tests/contracts/*` — golden updates (regenerate with review)
- `packs/core/*/pack.manifest.yaml` — only if a needed metadata field is absent from manifest schema (then T2-04-style schema work may be required — escalate if so)
- Do NOT touch: SKILL.md *source* content in packs (that's author domain — emitters wrap, not rewrite)

## Work steps

1. Locate the frontmatter emission code in both compilers (search for `description:` assembly / `---` frontmatter writers).
2. Add emitters for `license`, `compatibility` (rendered from `supported_runtime_ranges` into ≤500 chars), `metadata` (pack_id/version/class/provenance map).
3. Ensure emitted output passes the T2-01 validator — add a compiler test asserting spec compliance of emitted SKILL.md.
4. Regenerate goldens; review diffs — expected: frontmatter gains fields, body unchanged.
5. Deterministic ordering: fixed field order (`name`, `description`, `license`, `compatibility`, `metadata`) — G8.
6. Gates: compiler tests, lint, test, typecheck.

## Constraints (STRICT)

- MUST NOT emit `allowed-tools` (deferred — cross-runtime semantics differ).
- MUST NOT break spec validity — every emitted SKILL.md must pass T2-01 validator (add that as a test).
- MUST keep emitted frontmatter deterministic — stable key order, stable values.
- MUST NOT invent `compatibility` text per pack — derive mechanically from manifest fields so it's consistent + auditable.
- `metadata` values MUST be strings (spec: map<string,string>) — serialize scalars, don't emit nested objects.

## Acceptance gates

- [ ] Emitted SKILL.md for every core pack passes the spec validator (test asserts)
- [ ] Golden diffs show only frontmatter field additions
- [ ] `npm run test`, `npm run lint`, `npm run typecheck` green
- [ ] `compatibility` strings ≤500 chars (test asserts bound)

## Evidence to record

- Golden diff summary; validator pass count; commit hash.

## Rollback

`git revert` — emitter + goldens contained.
