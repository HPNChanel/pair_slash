# retrieval-index

Deterministic on-disk index builder for the optional Retrieval Lane (advanced,
opt-in, non-authoritative).

Responsibilities:

- walks declared read-only memory sources (`project-memory/`, `task-memory/`,
  `sessions/`, `staging/`) and records path + sha256 + size + YAML-derived
  record metadata (id, kind, title, scope, tags, updated_at)
- writes a single `retrieval-index.json` under
  `.pairslash/observability/indexes/retrieval/` — a namespace disjoint from the
  trace session indexes (`indexes/sess-*.json`) that already occupy
  `.pairslash/observability/indexes/`
- writes atomically (tmp + rename); a partial index is never readable
- reports honest staleness via `assessIndexStaleness` (fresh | stale | missing)
  by comparing live source hashes against the index

Hard boundaries:

- writes only inside its own index dir; any path escaping the repo root throws
- never writes into `project-memory/`, `task-memory/`, `sessions/`, or trace
  store internals
- output is deterministic: sorted sources/files, `stableJson` serialization,
  no wall-clock timestamps in the payload
- the index is a lookup aid, not truth — retrieved facts stay
  `truth_tier: supplemental`, `authoritative: false`

Exports: `buildRetrievalIndex`, `writeRetrievalIndex`, `loadRetrievalIndex`,
`assessIndexStaleness`, `resolveIndexDir`, `resolveIndexPath`,
`serializeRetrievalIndex`, `DEFAULT_MEMORY_SOURCES`, `DEFAULT_INDEX_DIR`,
`RETRIEVAL_INDEX_KIND`, `RETRIEVAL_INDEX_FILENAME`.
