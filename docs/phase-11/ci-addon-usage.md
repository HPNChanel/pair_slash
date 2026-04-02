# CI Add-on Usage (Prototype Slice)

Status: prototype, advanced optional lane, outside core install path
Public release label: experimental
Runtime support expectation: design-only
Prerequisite: explicit opt-in plus explicit repo policy
Risk boundary: outputs are reports or proposal artifacts only

## What This Slice Does

- explicit invocation only
- read repo metadata and files for validation
- run deterministic checks when `ci_plan_only` is disabled explicitly
- generate report output with policy verdicts
- optionally generate patch proposal artifacts
- emit provenance and trace/support metadata hints

## What This Slice Does Not Do

- no default commit or merge
- no direct write to `.pairslash/project-memory`
- no direct Global Project Memory write
- no implicit trigger from core workflows
- no CI vendor lock-in behavior

## Programmatic Invocation

```js
import { runCiLane } from "../packages/advanced/ci-engine/src/index.js";

const result = runCiLane({
  repoRoot: process.cwd(),
  invocation: "explicit",
  repoPolicyExplicit: true,
  capabilities: {
    ci_lane_enabled: true,
    ci_plan_only: false,
    ci_generate_patch_artifact: true,
  },
  checks: [
    { id: "repo.has-package-json", type: "path_exists", path: "package.json", required: true },
  ],
  patchCandidates: [
    {
      id: "docs-ci-note",
      path: "docs/ci-note.txt",
      after: "proposal text from CI lane\n",
      description: "proposal only; manual apply required",
    },
  ],
  provenance: {
    runtime: "codex_cli",
    execution_context: "disposable-runner",
    trigger_type: "manual",
    shim_status: "shim",
    live_evidence: false,
  },
});
```

Expected shape:

- `result.report` contains checks and summary status
- `result.artifacts` contains patch proposals only (no auto-apply)
- `result.provenance` contains run metadata and evidence tier
- `result.policy_verdicts.guardrails` shows `commit/merge/global-memory-write`
  denied by default
