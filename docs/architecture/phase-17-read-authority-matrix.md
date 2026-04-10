# Phase 17 Read Authority Matrix

This matrix is the checked-in coverage map for Phase 17 closure work.
Use it to answer one narrow question only:

Which required read workflows are wired to the shared loader, what artifact
proves that wiring, and which tests currently cover the proof?

Source of truth priority:

1. repo code and emitted artifacts
2. deterministic tests and acceptance outputs
3. docs that summarize those artifacts

## Required workflows

| Workflow | Shared-loader entrypoint | Authoritative artifact | Required precedence/conflict proof | Current deterministic proof |
| --- | --- | --- | --- | --- |
| `explain-context` | `pairslash explain-context <pack-id> --format json` | `context-explanation.memory_resolution` | `uses_shared_loader`, `precedence_rule`, `conflicts[]`, `gap_fills[]`, split `memory_reads` | `packages/tools/cli/tests/cli.test.js` |
| `pairslash-plan` | `pairslash explain-context pairslash-plan --format json` | `context-explanation` consumed before plan generation | plan skill must treat `memory_resolution` as source of truth and surface missing/conflict state | `packages/tools/cli/tests/cli.test.js`, `tests/truth-governance.test.js` |
| `pairslash-memory-candidate` | `pairslash memory candidate --format json` | `memory-candidate-report` | `precedence_rule`, duplicate/conflict reconciliation, read-only guarantee | `packages/tools/cli/tests/cli.test.js` |
| `pairslash-memory-audit` | `pairslash memory audit --audit-scope <...> --format json` | `memory-audit-report` | `uses_shared_loader`, `precedence_rule`, `conflicts[]`, `gap_fills[]`, read-only guarantee | `packages/tools/cli/tests/cli.test.js`, `packages/core/spec-core/tests/project-memory.test.js` |

## Supporting evidence

| Evidence class | Artifact | Purpose |
| --- | --- | --- |
| implementation | `packages/core/spec-core/src/read-authority.js` | owns layer order and workflow profiles |
| implementation | `packages/core/memory-engine/src/candidate.js` | candidate workflow resolves through shared loader |
| implementation | `packages/core/memory-engine/src/audit.js` | audit workflow resolves through shared loader |
| implementation | `packages/tools/cli/src/bin/pairslash.js` | operational surfaces for `explain-context`, `memory candidate`, `memory audit` |
| deterministic test | `packages/core/spec-core/tests/project-memory.test.js` | precedence, gap-fill, memory-audit profile coverage |
| deterministic test | `packages/tools/cli/tests/cli.test.js` | schema-valid JSON outputs, read-only guarantees, conflict surfacing |
| policy/truth guardrail | `tests/truth-governance.test.js` | public-claim and skill wording stay inside Phase 17 charter |
| acceptance | `packages/tools/compat-lab/src/acceptance.js` | deterministic acceptance layer for canonical install/use flows plus read-authority proof slice |

## Workflow notes

- `Global Project Memory` remains the only authoritative project-memory layer on read.
- `task-memory`, `session`, `staging`, and `audit-log` stay supporting only.
- `pairslash-plan` does not own a separate loader; it must consume the shared
  `explain-context` artifact rather than manually inventing precedence.
- `pairslash-memory-audit` is read-only. Any durable truth change still routes
  through `pairslash-memory-write-global`.
