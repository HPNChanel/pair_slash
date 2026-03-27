# PairSlash Compatibility Matrix

Use this page to answer "what support can we truthfully claim?" It is not the
install guide and it is not the live verification checklist.

## How to use this page

- Need install steps: use `docs/workflows/install-guide.md`
- Need live CLI verification steps: use `docs/compatibility/runtime-verification.md`
- Need current operational safety rules: use `docs/workflows/phase-2-operations.md`
- Need historical context only: use the archived Phase 0 docs, not this page
## Runtime boundary

PairSlash core supports exactly:

- Codex CLI
- GitHub Copilot CLI

Canonical entrypoint on both: `/skills`.

## Skill format compatibility

| Property | Codex CLI | Copilot CLI | Compatible |
|---|---|---|---|
| `SKILL.md` + YAML frontmatter | Yes | Yes | Yes |
| Repo skill path | `.agents/skills/` | `.github/skills/` | Path differs only |
| User skill path | `~/.agents/skills/` | `~/.copilot/skills/` | Path differs only |
| Direct invocation | `$skill-name` | `/skill-name` | Syntax differs only |
| Canonical invocation | `/skills` | `/skills` | Yes |

## Core workflow compatibility targets

| Workflow | Codex CLI target | Copilot CLI target |
|---|---|---|
| pairslash-plan | `/skills` -> select | `/skills` -> select |
| pairslash-review | `/skills` -> select | `/skills` -> select |
| pairslash-onboard-repo | `/skills` -> select | `/skills` -> select |
| pairslash-command-suggest | `/skills` -> select | `/skills` -> select |
| pairslash-memory-candidate | `/skills` -> select | `/skills` -> select |
| pairslash-memory-write-global | `/skills` -> select | `/skills` -> select |
| pairslash-memory-audit | `/skills` -> select | `/skills` -> select |

Direct invocation is secondary and runtime-dependent. Do not treat direct path
as canonical compatibility proof.

## Formalized pack surfaces

Formalized pack support is defined only by `packages/core/spec-core/registry/packs.yaml`.
The current registry-backed set is:

- `pairslash-plan`
- `pairslash-backend`
- `pairslash-frontend`
- `pairslash-devops`
- `pairslash-release`

The broader core workflow table above is a compatibility target list, not a
formalized-pack inventory.

## Phase 3 pack compatibility summary

Pack-level support for Phase 3 team packs is derived from
`docs/compatibility/runtime-surface-matrix.yaml`. Use these labels exactly:

- `supported`: live runtime evidence exists for the relevant surface set
- `supported with caveat`: at least one relevant surface is supported, with a
  documented runtime limitation on another relevant surface
- `not yet validated`: no relevant runtime surface has live validation evidence

Relevant feature surfaces for the Phase 3 packs are:

- Codex CLI: `/skills` -> select pack, `$pack-name`
- Copilot CLI: `/skills` -> select pack, `/pack-name`

| Pack name | Version | Codex support | Copilot support | Required capabilities | Known limitations | Migration notes | Validation status | Open risks |
|---|---|---|---|---|---|---|---|---|
| pairslash-backend | `0.2.0` | not yet validated | not yet validated | `/skills`; installed skill files; read access to `.pairslash/project-memory/`; workspace file access for bounded backend edits | Direct invocation is unverified on both runtimes; pack is read-only for Global Project Memory | No install-path change; tooling should discover formalized packs through `packages/core/spec-core/registry/packs.yaml` | Metadata, registry, and docs validate locally; no live runtime verification recorded | Support claims can outrun evidence if docs are promoted before manual runtime verification |
| pairslash-frontend | `0.2.0` | not yet validated | not yet validated | `/skills`; installed skill files; read access to `.pairslash/project-memory/`; workspace file access for UI/component edits | Direct invocation is unverified on both runtimes; depends on defined UI/backend contracts; pack is read-only for Global Project Memory | No install-path change; registry-backed discovery is the migration boundary for tooling | Metadata, registry, and docs validate locally; no live runtime verification recorded | Undefined product or backend contracts can be mistaken for runtime support if the matrix is not kept evidence-bound |
| pairslash-devops | `0.2.0` | not yet validated | not yet validated | `/skills`; installed skill files; read access to `.pairslash/project-memory/`; repo workflow/script access; operator environment access when validation depends on external systems | Direct invocation is unverified on both runtimes; environment-dependent behavior cannot be claimed without operator verification; pack is read-only for Global Project Memory | No install-path change; formalized-pack discovery should start from the registry manifest | Metadata, registry, and docs validate locally; environment-sensitive runtime behavior remains manually unverified | Operational support could be overstated if environment-specific checks are inferred from local schema/test success |
| pairslash-release | `0.2.0` | not yet validated | not yet validated | `/skills`; installed skill files; read access to registry, metadata, compatibility docs, and validated diffs | Direct invocation is unverified on both runtimes; release claims must remain evidence-bound; pack is read-only for Global Project Memory | No install-path change; tooling should use registry membership to identify formalized release packs | Metadata, registry, and docs validate locally; no live runtime verification recorded | Release messaging may imply broader runtime support than has actually been verified if this summary drifts from the surface matrix |

| Pack | Runtime | Surface | Status | Evidence |
|---|---|---|---|---|
| pairslash-plan | Codex CLI | `/skills` -> select | supported | compatibility docs + runtime matrix |
| pairslash-plan | Codex CLI | `$pairslash-plan` | supported | archived acceptance + runtime matrix |
| pairslash-plan | Copilot CLI | `/skills` -> select | supported | compatibility docs + install guide |
| pairslash-plan | Copilot CLI | `/pairslash-plan` interactive | unverified | contract note + archived acceptance |
| pairslash-plan | Copilot CLI | `/pairslash-plan` with `-p/--prompt` | blocked | known runtime limitation in contract |
| pairslash-backend | Codex CLI | `/skills` -> select | unverified | compatibility docs + runtime matrix |
| pairslash-backend | Codex CLI | `$pairslash-backend` | unverified | compatibility docs + runtime matrix |
| pairslash-backend | Copilot CLI | `/skills` -> select | unverified | compatibility docs + runtime matrix |
| pairslash-backend | Copilot CLI | `/pairslash-backend` | unverified | compatibility docs + runtime matrix |
| pairslash-frontend | Codex CLI | `/skills` -> select | unverified | compatibility docs + runtime matrix |
| pairslash-frontend | Codex CLI | `$pairslash-frontend` | unverified | compatibility docs + runtime matrix |
| pairslash-frontend | Copilot CLI | `/skills` -> select | unverified | compatibility docs + runtime matrix |
| pairslash-frontend | Copilot CLI | `/pairslash-frontend` | unverified | compatibility docs + runtime matrix |
| pairslash-devops | Codex CLI | `/skills` -> select | unverified | compatibility docs + runtime matrix |
| pairslash-devops | Codex CLI | `$pairslash-devops` | unverified | compatibility docs + runtime matrix |
| pairslash-devops | Copilot CLI | `/skills` -> select | unverified | compatibility docs + runtime matrix |
| pairslash-devops | Copilot CLI | `/pairslash-devops` | unverified | compatibility docs + runtime matrix |
| pairslash-release | Codex CLI | `/skills` -> select | unverified | compatibility docs + runtime matrix |
| pairslash-release | Codex CLI | `$pairslash-release` | unverified | compatibility docs + runtime matrix |
| pairslash-release | Copilot CLI | `/skills` -> select | unverified | compatibility docs + runtime matrix |
| pairslash-release | Copilot CLI | `/pairslash-release` | unverified | compatibility docs + runtime matrix |

For formalized packs, human-facing docs must not claim stronger support than the
status recorded in `docs/compatibility/runtime-surface-matrix.yaml`.

## Memory authority parity requirements

Both runtimes must preserve identical semantics:

- Global Project Memory is authoritative.
- Read workflows cannot write Global Memory.
- Write-authority path is only `pairslash-memory-write-global`.
- Write path must enforce preview patch, explicit acceptance, conflict checks,
  audit log append, and index update.

## Validation references

- Acceptance gates: `docs/compatibility/acceptance-gates.yaml`
- Local gates: `npm run lint`
- Regression tests: `npm run test`
- Live verification steps: `docs/compatibility/runtime-verification.md`
- Release checklist: `docs/releases/release-checklist-0.2.0.md`
