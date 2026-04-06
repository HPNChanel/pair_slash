# PairSlash Public Claim Policy

Last updated: 2026-04-05

This file governs public wording only.
The official phase statement, authority hierarchy, claim ladder, and support
boundary ladder live in `docs/phase-12/authoritative-program-charter.md`.

## Truth layers

1. Implementation truth
   Code, manifests, generated artifacts, and deterministic tests define what is
   actually implemented.
2. Product-validation truth
   The Phase 3.5 benchmark system defines whether PairSlash has validated a
   must-win workflow strongly enough to claim business pull.
3. Public-claim truth
   Public wording is allowed only when it stays inside the scoped release
   verdict, runtime support evidence, shipped-scope boundary, and this policy.

## Public narrative principles

- Open on the trust problem PairSlash solves, not a generic agent-platform
  story.
- Keep scope inside exactly two runtimes: Codex CLI and GitHub Copilot CLI.
- Keep `/skills` as the canonical front door in onboarding, support, and
  release wording.
- Separate `implemented`, `deterministic-tested`, `live-evidence-backed`, and
  `publicly supported` claims instead of flattening them into one maturity
  story.
- Describe Global Project Memory as the authoritative project memory layer with
  explicit write authority. Do not imply that every read path is authoritative
  or that memory updates happen automatically.
- Keep workflow language explicit. Do not imply auto-triggered flows, hidden
  writes, implicit memory promotion, or generic agent-platform breadth.
- If evidence is weaker than the sentence, downgrade the sentence.

## Authoritative sources

- Program phase truth:
  - `docs/phase-12/authoritative-program-charter.md`
- Implementation truth:
  - `packs/core/*/pack.manifest.yaml`
  - `packages/core/spec-core/src/pack-catalog.js`
  - `packages/core/spec-core/registry/packs.yaml` (derived index only)
  - `packages/tools/installer/`
  - `packages/tools/doctor/`
  - `packages/tools/compat-lab/`
  - `packages/core/memory-engine/`
- Product-validation truth:
  - `docs/validation/phase-3-5/verdict.md`
- Public-claim truth:
  - `docs/releases/scoped-release-verdict.md`
  - `docs/releases/phase-5-shipped-scope.md`
  - `docs/releases/legal-packaging-status.md`
  - `docs/compatibility/compatibility-matrix.md`
  - `docs/compatibility/runtime-verification.md`
  - `docs/evidence/live-runtime/README.md`

## Safe public claims

- PairSlash is the trust layer for terminal-native AI workflows.
- PairSlash supports exactly two runtimes: Codex CLI and GitHub Copilot CLI.
- `/skills` is the canonical front door on both supported runtimes.
- The PairSlash source repository is licensed under Apache-2.0.
- Global Project Memory is the authoritative project memory layer, and
  authoritative writes stay explicit, previewable, and auditable.
- PairSlash ships a scoped managed installability substrate for the two core
  runtimes.
- The current supported install path is repo-local from this checkout; package-manager
  publication is not claimed today.
- Runtime support claims must use only `stable-tested`, `preview`,
  `degraded`, `prep`, or `blocked`, exactly as recorded in compatibility docs.
- One-off live runs do not justify `stable-tested`.
- Phase wording must reuse the official sentence in
  `docs/phase-12/authoritative-program-charter.md`.

## Release notes opening template

Use an opening paragraph like this:

> This release hardens or expands the technically shipped PairSlash
> installability and trust-boundary substrate for Codex CLI and GitHub Copilot
> CLI. The changes here are backed by repo code, deterministic release gates,
> and the lane-specific compatibility docs linked below. They do not by
> themselves prove product-validation exit, broad runtime parity, or support
> beyond the documented lanes.

## Allowed verbs

- `implements`
- `ships`
- `documents`
- `supports on the documented lane`
- `records`
- `verifies on the current branch`
- `requires`
- `preserves`
- `blocks`
- `treats as canonical`

## Forbidden verbs

- `validates`
- `proves`
- `guarantees`
- `works everywhere`
- `supports any terminal AI runtime`
- `self-manages`
- `auto-heals`
- `learns in the background`
- `auto-promotes`
- `runs autonomously`
- `replaces review`

## Allowed confidence language

- `narrow`
- `scoped`
- `lane-specific`
- `documented`
- `currently`
- `technically shipped`
- `deterministically covered`
- `live-evidence-backed for the documented lane`
- `publicly supported today only for the documented lanes`
- `prep-only until canonical live verification exists`

## Forbidden maturity inflation

- `enterprise-ready`
- `production-proven`
- `market-validated`
- `battle-tested across environments`
- `broad runtime parity`
- `universal`
- `seamless cross-runtime`
- `works across environments`
- `fully mature OSS platform`
- `drop-in everywhere`

## Claims that remain disallowed

- Any statement that product validation is complete or benchmark-proven.
- Any statement that deterministic tests or acceptance slices equal market
  validation.
- Any statement that Windows live install parity or broad runtime parity is
  already proven.
- Any statement that introduces a third runtime or weakens `/skills` as the
  canonical front door.
- Any statement that implies hidden writes, implicit memory promotion, or
  autonomous fix application.
- Any package-manager publication or package-surface claim not supported by
  current legal/package metadata.
- Any statement that treats Apache-2.0 repo source licensing as proof that a
  package-manager artifact is already public.
- Any OSS or open-source-packaging claim stronger than current legal/package
  metadata supports.

## Do not say

- "PairSlash is a general agent framework."
- "PairSlash works anywhere terminal AI runs."
- "PairSlash has broad runtime parity."
- "Windows is fully supported."
- "Codex and Copilot have the same support level everywhere."
- "A doctor pass proves the runtime is publicly supported."
- "Preview install proves live runtime support."
- "Acceptance tests prove product validation."
- "This release proves market pull."
- "PairSlash updates project memory automatically in the background."
- "Read workflows can promote authoritative project memory on their own."
- "Prompt-mode direct invocation is equivalent to `/skills`."
- "PairSlash supports a third runtime."
- "PairSlash is enterprise-ready."
- "PairSlash is production-proven across environments."
- "PairSlash is already a published npm package."
- "The Apache-2.0 repo license means every `@pairslash/*` package is public."
