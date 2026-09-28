---
id: T3-03
track: T3
title: Codex plugin bundle format + marketplace manifest emission
status: done
depends_on: [T3-01]
est_size: M
claimed_by: devin
claimed_at: 2026-09-28
completed_at: 2026-09-28
evidence: >
  compileCodexPack({emitMode:"plugin"}) emits .codex-plugin/plugin.json
  (interface block incl. displayName/developerName) + pairslash-plugin.json
  sidecar + skills/<pack-id>/ payload; deterministic, fails closed on unknown
  emitMode. buildCodexMarketplaceManifest emits the verified
  {name, interface.displayName, plugins[]} shape with local-source entries
  (policy.installation=AVAILABLE, authentication=ON_INSTALL) — emission only,
  no publishing. Verified vs inferred: plugin manifest + marketplace shapes
  from openai/codex plugin-json-spec sample + Codex plugin docs (2026-09-28);
  category "developer-tools" is a PairSlash choice, marked in code comment.
  New golden: compiler-codex-plugin.repo-node-service.json.
---

## Objective

Implement the Codex-side plugin emit: the bundle layout Codex's plugin system consumes, plus the marketplace-manifest emission that would let a PairSlash marketplace distribute packs via `codex plugin marketplace add` / `codex plugin add`.

## Context & sources

- Codex plugin surface (verified T1-01/CX-01/CX-02): `codex plugin add`, `codex plugin marketplace add` (GitHub shorthand, git URLs, local dirs, sparse), marketplaces distribute plugins that carry skills (+ connectors/apps — out of PairSlash scope).
- Exact Codex plugin directory contract must be verified during implementation (docs: developers.openai.com/codex/plugins + skills docs) — the format details are younger than Copilot's; pin what's verified, mark uncertain fields explicitly.
- Existing `codex-package-bundle` emit is the file-install shape; plugin emit is the marketplace/distribution shape.

## Files to touch

- `packages/runtimes/codex/compiler/src/` — plugin emit mode
- `packages/core/spec-core/src/` — marketplace manifest IR if contract defines one
- `tests/golden/` — codex plugin goldens
- Do NOT touch: copilot compiler (done T3-02), installer default path

## Work steps

1. Verify the actual Codex plugin layout from current docs (skill-dir-only plugin vs richer manifest; marketplace manifest format — `marketplace.json` or equivalent). Record findings inline in code comments/doc — cite what was verified vs inferred.
2. Implement plugin emit mode in codex compiler mirroring T3-02 pattern.
3. Implement marketplace manifest emission (a generated marketplace descriptor for a PairSlash-owned marketplace repo — produced but not published; T3-05 decides whether PairSlash ships one).
4. Goldens + determinism tests.
5. Gates.

## Constraints (STRICT)

- MUST distinguish verified format facts from inference — any inferred field gets a code-comment marker + a note in evidence (honest failure principle).
- MUST NOT publish/register anything — emission only; distribution activation is T3-05/T7 territory.
- MUST fail closed on unverified required fields — don't emit a guess-shaped marketplace manifest.
- MUST keep `/skills` semantics untouched — plugin install lands files that `/skills` discovers; no new entrypoint semantics (C.2).
- Deterministic output (G8).

## Acceptance gates

- [ ] Codex plugin emit produces verified-shape bundle for all core packs
- [ ] Marketplace manifest emitted for the pack catalog (dry artifact)
- [ ] Verified-vs-inferred fields documented
- [ ] Gates green

## Evidence to record

- Codex plugin layout verification notes (source citations); emitted example tree.

## Rollback

`git revert`.
