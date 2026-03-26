# Phase 5: Contract Engine & Policy Hardening

Phase 5 adds machine-readable enforcement on top of the Phase 4 installability surface.

## Shipped packages

- `@pairslash/contract-engine`
  - Builds runtime-aware contract envelopes from canonical manifest v2 data.
  - Normalizes input, output, failure, memory, tool, and capability-scope contracts.
- `@pairslash/policy-engine`
  - Evaluates allow/ask/deny/require-preview decisions.
  - Enforces no-silent-fallback, preview-before-write, approval gate, and capability scope.
- `@pairslash/memory-engine`
  - Implements the authoritative memory write pipeline:
    schema validation, duplicate/conflict detection, preview patch, approval gate, commit, audit log, and memory index update.

## Schemas

Shipped under `packages/spec-core/schemas/`:

- `contract-envelope.schema.yaml`
- `policy-verdict.schema.yaml`
- `memory-write-request.schema.yaml`
- `memory-write-preview.schema.yaml`
- `memory-write-result.schema.yaml`

## CLI surface

- `pairslash lint`
  - Emits Phase 5 contract/policy-aware lint reports.
- `pairslash preview memory-write-global ...`
  - Generates a no-write preview patch and machine-readable policy verdict.
- `pairslash memory write-global ... --apply`
  - Commits only after preview generation and explicit confirmation.

## Enforcement boundary

- Shared policy semantics live in `@pairslash/policy-engine`.
- Runtime-specific differences stay in:
  - `@pairslash/runtime-codex-adapter`
  - `@pairslash/runtime-copilot-adapter`
- Adapters describe boundary differences; they do not own policy decisions.
