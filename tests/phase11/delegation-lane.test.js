import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

import { runCli } from "../../packages/tools/cli/src/bin/pairslash.js";
import {
  DELEGATION_CAPABILITY_DEFAULTS,
  DELEGATION_POLICY_ACTIONS,
  DELEGATION_POLICY_CONTRACT,
  DELEGATION_WORKER_CLASSES,
  evaluateDelegationPolicy,
  runDelegationScaffold,
} from "../../packages/advanced/delegation-engine/src/index.js";
import { createTempRepo, repoRoot } from "../phase4-helpers.js";

const serial = { concurrency: false };

function findVerdict(result, action) {
  return result.policy_verdicts.active.find((verdict) => verdict.action === action);
}

test("delegation lane is disabled by default", serial, () => {
  const result = runDelegationScaffold({
    invocation: "explicit",
    workflowId: "pairslash-review",
    workflowClass: "read-oriented",
    requestedWorkerClass: DELEGATION_WORKER_CLASSES.ANALYSIS,
  });

  assert.equal(result.capability_flags.delegation_lane_enabled, false);
  assert.equal(result.report.status, "blocked");
  const createTaskVerdict = findVerdict(result, DELEGATION_POLICY_ACTIONS.CREATE_TASK);
  assert.equal(createTaskVerdict.overall_verdict, "deny");
  assert.ok(createTaskVerdict.reasons.some((reason) => reason.code === "DELEGATION-LANE-DISABLED"));
});

test("delegation denies chain spawning", serial, () => {
  const verdict = evaluateDelegationPolicy({
    action: DELEGATION_POLICY_ACTIONS.CHAIN_SPAWN,
    capabilities: {
      delegation_lane_enabled: true,
    },
    explicitInvocation: true,
    workflowId: "pairslash-review",
    workflowClass: "read-oriented",
  });

  assert.equal(verdict.overall_verdict, "deny");
  assert.ok(verdict.reasons.some((reason) => reason.code === "DELEGATION-CHAIN-SPAWNING-DENIED"));
});

test("delegation denies unbounded fan-out", serial, () => {
  const verdict = evaluateDelegationPolicy({
    capabilities: {
      delegation_lane_enabled: true,
    },
    explicitInvocation: true,
    workflowId: "pairslash-review",
    workflowClass: "read-oriented",
    requestedWorkerClass: DELEGATION_WORKER_CLASSES.ANALYSIS,
    requestedFanOut: 2,
  });

  assert.equal(verdict.overall_verdict, "deny");
  assert.ok(verdict.reasons.some((reason) => reason.code === "DELEGATION-MAX-FAN-OUT-EXCEEDED"));
});

test("delegation denies Global Project Memory write", serial, () => {
  const verdict = evaluateDelegationPolicy({
    action: DELEGATION_POLICY_ACTIONS.WRITE_GLOBAL_MEMORY,
    capabilities: {
      delegation_lane_enabled: true,
    },
    explicitInvocation: true,
    workflowId: "pairslash-review",
    workflowClass: "read-oriented",
  });

  assert.equal(verdict.overall_verdict, "deny");
  assert.ok(verdict.reasons.some((reason) => reason.code === "DELEGATION-GLOBAL-MEMORY-WRITE-DENIED"));
});

test("delegation denies authority expansion over caller", serial, () => {
  const verdict = evaluateDelegationPolicy({
    capabilities: {
      delegation_lane_enabled: true,
    },
    explicitInvocation: true,
    workflowId: "pairslash-review",
    workflowClass: "read-oriented",
    requestedWorkerClass: DELEGATION_WORKER_CLASSES.ANALYSIS,
    callerCapabilities: ["repo_read"],
    delegatedCapabilities: ["repo_read", "memory_read"],
    callerAllowedPaths: ["docs"],
    workerAllowedPaths: ["docs"],
  });

  assert.equal(verdict.overall_verdict, "deny");
  assert.ok(verdict.reasons.some((reason) => reason.code === "DELEGATION-CAPABILITY-ESCALATION-DENIED"));
});

test("delegation blocks dual-mode workflows in safe MVP", serial, () => {
  const verdict = evaluateDelegationPolicy({
    capabilities: {
      delegation_lane_enabled: true,
    },
    explicitInvocation: true,
    workflowId: "pairslash-backend",
    workflowClass: "dual-mode",
    requestedWorkerClass: DELEGATION_WORKER_CLASSES.ANALYSIS,
  });

  assert.equal(verdict.overall_verdict, "deny");
  assert.ok(verdict.reasons.some((reason) => reason.code === "DELEGATION-DUAL-MODE-BLOCKED"));
});

test("delegation blocks write-authority workflows", serial, () => {
  const verdict = evaluateDelegationPolicy({
    capabilities: {
      delegation_lane_enabled: true,
    },
    explicitInvocation: true,
    workflowId: "pairslash-memory-write-global",
    workflowClass: "write-authority",
    requestedWorkerClass: DELEGATION_WORKER_CLASSES.ANALYSIS,
  });

  assert.equal(verdict.overall_verdict, "deny");
  assert.ok(verdict.reasons.some((reason) => reason.code === "DELEGATION-WRITE-AUTHORITY-BLOCKED"));
});

test("delegated result envelope stays non-authoritative and approval-gated", serial, () => {
  const result = runDelegationScaffold({
    invocation: "explicit",
    workflowId: "pairslash-review",
    workflowClass: "read-oriented",
    requestedWorkerClass: DELEGATION_WORKER_CLASSES.ANALYSIS,
    capabilities: {
      delegation_lane_enabled: true,
    },
    callerCapabilities: ["repo_read", "review_analysis"],
    delegatedCapabilities: ["repo_read", "review_analysis"],
    callerAllowedPaths: ["docs", "packages/core"],
    workerAllowedPaths: ["docs"],
    filesInspected: ["docs/phase-11/README.md"],
    evidence: [
      {
        source: "docs/phase-11/README.md",
        anchor: "Allowed Scope",
        summary: "delegation stays bounded and explicit",
      },
    ],
  });

  assert.equal(result.report.status, "planned");
  assert.equal(result.result_envelope.authoritative, false);
  assert.equal(result.result_envelope.truth_tier, "supplemental");
  assert.equal(result.result_envelope.requires_caller_approval, true);
  assert.equal(result.result_envelope.aborted, false);
  assert.equal(result.result_envelope.confidence, "medium");
  assert.ok(result.result_envelope.scope);
  assert.equal(result.result_envelope.scope.max_depth, 1);
  assert.equal(result.result_envelope.scope.max_fan_out, 1);
  assert.equal(result.result_envelope.evidence.length, 1);
  assert.equal(result.result_envelope.evidence[0].source, "docs/phase-11/README.md");
});

test("delegation package absent does not break core lint command", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  const delegationPackagePath = join(repoRoot, "packages", "advanced", "delegation-engine");
  const temporaryMissingPath = join(repoRoot, "packages", "advanced", "delegation-engine.__tmp_missing__");
  let output = "";

  if (existsSync(temporaryMissingPath)) {
    rmSync(temporaryMissingPath, { recursive: true, force: true });
  }

  try {
    assert.equal(existsSync(delegationPackagePath), true);
    renameSync(delegationPackagePath, temporaryMissingPath);

    const exitCode = await runCli({
      argv: ["lint", "pairslash-plan", "--runtime", "all", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });

    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.equal(payload.kind, "lint-report");
    assert.equal(payload.ok, true);
  } finally {
    if (existsSync(temporaryMissingPath)) {
      renameSync(temporaryMissingPath, delegationPackagePath);
    }
    fixture.cleanup();
  }
});

test("advanced delegation pack manifest stays aligned with lane defaults", serial, () => {
  const manifestPath = join(repoRoot, "packs", "advanced", "delegation", "pack.manifest.yaml");
  const manifest = YAML.parse(readFileSync(manifestPath, "utf8"));

  assert.equal(manifest.package.name, "@pairslash/delegation-engine-advanced");
  assert.deepEqual(manifest.capability_flags, DELEGATION_CAPABILITY_DEFAULTS);
  assert.deepEqual(manifest.policy_contract.decisions, DELEGATION_POLICY_CONTRACT.decisions);
  assert.equal(manifest.policy_contract.no_silent_delegation, true);
  assert.equal(manifest.policy_contract.no_unbounded_fan_out, true);
  assert.equal(manifest.policy_contract.max_fan_out, 1);
  assert.equal(manifest.policy_contract.no_direct_global_memory_write, true);
});
