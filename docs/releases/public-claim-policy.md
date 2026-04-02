# PairSlash Public Claim Policy

Last updated: 2026-04-02

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

## Authoritative sources

- Program phase truth:
  - `docs/phase-12/authoritative-program-charter.md`
- Implementation truth:
  - `packs/core/*/pack.manifest.yaml`
  - `packages/core/spec-core/registry/packs.yaml`
  - `packages/tools/installer/`
  - `packages/tools/doctor/`
  - `packages/tools/compat-lab/`
  - `packages/core/memory-engine/`
- Product-validation truth:
  - `docs/validation/phase-3-5/verdict.md`
  - `docs/validation/phase-3-5/evidence-log.md`
  - `docs/validation/phase-3-5/README.md`
- Public-claim truth:
  - `docs/releases/scoped-release-verdict.md`
  - `docs/releases/phase-5-shipped-scope.md`
  - `docs/compatibility/compatibility-matrix.md`
  - `docs/compatibility/runtime-verification.md`

## Safe public claims

- PairSlash is the OSS trust layer for terminal-native AI workflows.
- PairSlash supports exactly two runtimes: Codex CLI and GitHub Copilot CLI.
- `/skills` is the canonical front door on both supported runtimes.
- Global Project Memory is authoritative at project scope and important writes
  stay explicit, previewable, and auditable.
- PairSlash ships a scoped managed installability substrate for the two core
  runtimes.
- Runtime support claims must use only `stable-tested`, `degraded`, `prep`, or
  `known-broken`, exactly as recorded in compatibility docs.
- Phase wording must reuse the official sentence in
  `docs/phase-12/authoritative-program-charter.md`.

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
- Any package-manager publication or finalized license claim not supported by
  current legal/package metadata.
