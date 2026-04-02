# Retrieval Lane

Status: prototype-slice (advanced optional, non-core)
Phase: 11
Public release label: experimental
Runtime support expectation: design-only
Core install impact: none
Risk boundary: retrieved output is supplemental only and never authoritative

## Problem Framing

Retrieval exists to lower context lookup cost on large repos, docs snapshots,
and non-authoritative artifact sets without weakening PairSlash core trust
semantics.

Retrieval is allowed to help a workflow read faster.
Retrieval is not allowed to decide what the project should remember.

Current repo anchors that shape this design:

- core pack discovery is hardcoded to `packs/core/`
- root workspaces do not include `packages/advanced/*`
- current core capabilities are closed around core workflows
- candidate extraction is read-only and must reconcile against authoritative
  memory before any promotion path
- installer policy already treats `mcp` as a risky mutation surface, so
  Retrieval must not piggyback on core install flow by default

Any retrieval direction that blurs Global Project Memory is rejected.

## Non-Negotiable Invariants

- Global Project Memory remains the only authoritative project-truth layer.
- `/skills` remains the canonical front door.
- Retrieval is always explicit and opt-in.
- Retrieval never performs hidden write.
- Retrieval never performs implicit promote.
- Retrieval never becomes a required dependency of a core workflow.
- Retrieved evidence is always labeled as retrieved evidence.
- Global memory wins over retrieved output on every conflict.

## Retrieval Lane Architecture

### Sources

Allowed first-slice sources:

- `repo local`
  explicit repo paths and file globs inside the active repository
- `artifact local`
  explicit non-authoritative indexes such as validation outputs, compatibility
  goldens, release artifacts, or trace indexes

Deferred for next slice:

- `docs snapshot`
  explicit local documentation snapshots or checked-in docs directories

Rejected first-slice sources:

- live external search
- background sync or crawling
- implicit MCP fetch
- network-dependent default behavior

### Workflow Insertion

Retrieval output enters a workflow only after normal authoritative context load.

Required order:

1. load authoritative project memory and standard task/session context
2. execute explicit retrieval query against declared sources
3. return labeled retrieved evidence as supplemental context
4. if the user wants durable truth, pass through candidate extraction and the
   existing write-global flow

Retrieval must not change memory load order or outrank project memory.

### Result Shape

Every retrieval result must expose:

- `source_kind`
- `source_path`
- `anchor`
- `snapshot_or_commit_ref`
- `indexed_at`
- `confidence`
- `staleness`
- `label: retrieved`
- `summary_or_excerpt`

Minimum output rule:

- no unlabeled synthesis
- no silent merge into memory-oriented sections
- no claim that a retrieved fact is project truth

### Default Rights

Default rights in core: none.

When Retrieval Lane is explicitly enabled:

- filesystem read only
- only over declared local roots
- no repo write
- no memory write
- no runtime-root write
- no hidden shell side effects
- no network by default

Secret-like or policy-sensitive paths are not part of the default allow set.

### Index and Cache

Index is optional, not required.

Default mode:

- direct scan of declared local sources

Optional mode:

- explicit index build or refresh for repo-local, docs-snapshot, or
  artifact-index sources

Index/cache placement:

- lane-owned cache only
- preferred path: `~/.pairslash/cache/retrieval/<repo-fingerprint>/`

Rejected placements:

- `.pairslash/project-memory/`
- runtime install roots under `.agents/skills/` or `.github/skills/`
- `packs/core/`
- any location that makes Retrieval part of core install state

Retrieval cache is not part of core install and may be deleted without affecting
core PairSlash behavior.

### Memory vs Retrieval Boundary

`retrieved hint`:

- source-linked supplemental evidence
- may be useful for current reasoning
- may be stale, partial, or irrelevant
- is never authoritative project truth

`project truth`:

- active records under `.pairslash/project-memory/`
- durable records written only through explicit write-authority flow

Only allowed promotion path:

1. retrieval returns a hint
2. user or workflow requests candidate extraction
3. `pairslash-memory-candidate` reconciles against authoritative memory
4. `pairslash-memory-write-global` previews the write
5. explicit approval commits the record

There is no direct `retrieval -> authoritative memory` path.

## Capability Model

These flags are Retrieval Lane policy flags in the first slice.
They are not added to the current core capability enum yet.

- `retrieval_enabled`
  default `false`; blocks all retrieval behavior unless explicitly enabled
- `retrieval_repo_local`
  allows read-only retrieval over declared repo-local sources
- `retrieval_artifact_index`
  allows read-only retrieval over explicit artifact indexes
- `retrieval_external_disabled_by_default`
  default `true`; external retrieval remains off
- `retrieval_no_authoritative_write`
  hard `true`; Retrieval Lane cannot write or proxy authoritative memory writes

## Policy Behavior

| Action | Default policy | Notes |
| --- | --- | --- |
| `retrieval.query.repo_local` | `allow` | Only inside declared local roots |
| `retrieval.query.artifact_local` | `allow` | Result must stay labeled non-authoritative |
| `retrieval.query.stale_source` | `ask` | User must see staleness before trusting output |
| `retrieval.query.secret_like_path` | `ask` | No silent expansion into sensitive paths |
| `retrieval.query.external` | `deny` | External retrieval is disabled by default |
| `retrieval.index.build` | `require-preview` | Preview must show roots, cache path, and size |
| `retrieval.index.refresh` | `require-preview` | Same preview requirements as build |
| `retrieval.memory.promote` | `deny` | Promotion must use candidate plus write-global |
| `retrieval.hidden_write` | `deny` | No hidden write anywhere in retrieval lane |

## Failure Modes

### Retrieval stale

- mark result `stale: true`
- lower confidence
- keep output as hint-only
- do not recommend memory promotion without stronger evidence

### Retrieval irrelevant

- return low-confidence or empty result
- do not inflate weak matches into workflow guidance

### Retrieval conflicts with Global Memory

- label conflict explicitly
- authoritative memory wins
- if user wants to challenge memory, route through candidate extraction and
  supersede review, not direct overwrite

### Retrieval returns low-confidence evidence

- label evidence as low-confidence
- keep it out of authoritative recommendations
- require stronger evidence before any candidate suggestion

## Risk Register

- `memory-boundary drift`
  Retrieval starts acting like memory and confuses users about truth.
  Mitigation: keep retrieval output structurally separate and always labeled.
- `core-scope bloat`
  Retrieval enters core schema, install, or discovery too early.
  Mitigation: keep lane-local flags and advanced-only directories.
- `secret leakage`
  Broad repo scans read sensitive files by default.
  Mitigation: explicit source roots plus `ask` for sensitive paths.
- `stale confidence`
  Users over-trust old indexes.
  Mitigation: expose `indexed_at`, staleness, and source ref on every hit.
- `install-path leakage`
  Retrieval becomes part of runtime install burden.
  Mitigation: no core manifests, no workspace addition, no core installer
  integration in this slice.

## Migration And Rollout Recommendation

Current recommendation: `isolated local-only prototype`.

Scaffold now:

- `packages/advanced/retrieval-engine/`
- `packages/advanced/retrieval-index/`
- `packages/advanced/retrieval-skill/`
- `packs/advanced/retrieval/`

Do not do yet:

- do not add root workspaces
- do not add retrieval manifests under `packs/core/`
- do not add retrieval capabilities to core schema
- do not add retrieval checks to core doctor/lint/install
- do not claim broad runtime support

Next approval ladder:

1. design-only documents and ADR
2. isolated local-only prototype (current slice)
3. alpha package only after provenance, staleness, and boundary tests pass

## ADR Summary

- Retrieval is supplemental context only.
- Retrieval is not authoritative.
- Retrieval has no write authority.
- Retrieval never auto-promotes into Global Project Memory.
- Retrieval remains outside core install and discovery paths in the first slice.
- Any design that makes Retrieval compete with Global Project Memory is out of
  scope and should be rejected.
