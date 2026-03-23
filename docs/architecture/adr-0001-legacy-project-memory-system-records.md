# ADR 0001: Govern Legacy Project Memory System Records

Status: Accepted
Date: 2026-03-22

## Context

PairSlash currently has two active authoritative records in
`.pairslash/project-memory/` that do not conform to the current
`memory-record.schema.yaml` model:

- `00-project-charter.yaml`
- `10-stack-profile.yaml`

These files are indexed as active records, but they use a legacy shape with
domain-specific sections such as `identity`, `runtimes`, and `provenance`
instead of the current write-authority schema fields (`statement`, `evidence`,
`scope`, `confidence`, `action`, `tags`, `source_refs`, `updated_by`,
`timestamp`).

The current write-authority workflow and schema do not allow `kind: charter`
or `kind: stack-profile`. As a result, the memory layer has two coexisting
record models:

- mutable schema-governed records written by `pairslash-memory-write-global`
- legacy singleton system records created before the current schema contract

## Decision

Treat `charter` and `stack-profile` as dedicated **system records** with a
separate schema contract from mutable memory records:

1. They remain authoritative and index-visible.
2. They are excluded from `memory-record.schema.yaml`.
3. They are validated by `packages/spec-core/schemas/system-record.schema.yaml`.
4. `90-memory-index.yaml` marks them with `record_family: system`.
5. They must not be modified through `pairslash-memory-write-global` in the
   current phase.
6. Auditors and memory-reading workflows must tolerate
   `schema_version: pre-0.1.0` for these two files only.

## Consequences

- Memory audits can distinguish intentional legacy records from real schema
  drift in mutable records.
- Tooling cannot yet supersede or rewrite these records through the normal
  write-authority path.
- Dual-schema handling removes false-positive schema-drift findings for these
  two files.
- Mutable write-authority contract remains stable and focused.

## Follow-up

1. Keep dual-schema policy documented in onboarding and audit workflows.
2. Revisit migration only when write-authority explicitly supports system
   records without weakening safety gates.
