# Retrieval Add-on Usage (Prototype Slice)

Status: prototype, advanced optional lane, outside core install path
Public release label: experimental
Runtime support expectation: design-only
Prerequisite: explicit opt-in only
Risk boundary: retrieved evidence stays non-authoritative

## What This Slice Does

- supports explicit retrieval invocation only
- supports read-only local lookup from `repo_local` and `artifact_local`
- labels every hit as non-authoritative retrieved evidence
- keeps Global Project Memory as authoritative winner on conflicts

## What This Slice Does Not Do

- no writes to `.pairslash/project-memory`
- no auto-indexing daemon
- no external connector enabled by default
- no auto-enable in core workflows
- no change to `/skills` core front door

## Programmatic Invocation

```js
import { runRetrievalQuery } from "../packages/advanced/retrieval-engine/src/index.js";

const result = runRetrievalQuery({
  repoRoot: process.cwd(),
  invocation: "explicit",
  query: "pairslash",
  capabilities: {
    retrieval_enabled: true,
    retrieval_repo_local: true,
    retrieval_artifact_index: true,
  },
  sources: [
    { id: "repo", kind: "repo_local", path: "docs" },
    { id: "artifacts", kind: "artifact_local", path: "trust" },
  ],
});
```

## Conflict Resolution Example

```js
import { resolveRetrievedFactAgainstGlobalMemory } from "../packages/advanced/retrieval-engine/src/index.js";

const resolution = resolveRetrievedFactAgainstGlobalMemory({
  factKey: "build.test_command",
  retrievedValue: "npm run test:all",
  globalMemoryRecords: [{ key: "build.test_command", value: "npm run test" }],
});
```

Expected behavior:

- `resolution.winner` is `global_memory`
- `resolution.conflict` is `true`
- `resolution.effective_value` is the Global memory value
