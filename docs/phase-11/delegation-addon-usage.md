# Delegation Add-on Usage

Status: scaffold-only
Public release label: experimental
Runtime support expectation: design-only
Prerequisite: explicit caller-controlled opt-in only
Risk boundary: no worker may exceed caller authority

This add-on is not part of the core install path.
It is not discovered by `pairslash install --pack-set core`.

## Intended Use

Use this slice only to validate delegation policy and result-envelope shape for
an explicit caller-controlled handoff.

Do not use it as a runtime worker launcher.

## Example

```js
import {
  DELEGATION_WORKER_CLASSES,
  runDelegationScaffold,
} from "../../packages/advanced/delegation-engine/src/index.js";

const result = runDelegationScaffold({
  invocation: "explicit",
  workflowId: "pairslash-review",
  workflowClass: "read-oriented",
  requestedWorkerClass: DELEGATION_WORKER_CLASSES.ANALYSIS,
  capabilities: {
    delegation_lane_enabled: true,
  },
  callerCapabilities: ["memory_read", "repo_read", "review_analysis"],
  delegatedCapabilities: ["repo_read", "review_analysis"],
  callerAllowedPaths: ["docs", "packages/core"],
  workerAllowedPaths: ["docs"],
});
```

Expected behavior:

- policy validates the request against the safe-MVP allowlist
- worker authority cannot exceed caller authority
- fan-out stays bounded (`max_fan_out = 1`)
- result is labeled non-authoritative
- output requires caller approval before any follow-up action

## Non-Goals

- no runtime-native worker spawning
- no repo or memory mutation
- no support for `dual-mode` or `write-authority` workflows
