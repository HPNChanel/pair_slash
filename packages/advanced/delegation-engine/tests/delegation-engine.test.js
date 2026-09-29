import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as engine from "../src/index.ts";
import {
  DELEGATION_POLICY_ACTIONS,
  DELEGATION_WORKER_CLASSES,
  WRITE_AUTHORITY_ROUTE,
  evaluateAuthoritySubset,
  evaluateDelegationPolicy,
  loadDelegationPackAuthority,
  runDelegationScaffold,
} from "../src/index.ts";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..", "..", "..");
const srcDir = join(testDir, "..", "src");

const basePolicyInput = {
  capabilities: { delegation_lane_enabled: true },
  explicitInvocation: true,
  workflowId: "pairslash-review",
  workflowClass: "read-oriented",
  requestedWorkerClass: DELEGATION_WORKER_CLASSES.ANALYSIS,
};

test("module exposes no authoritative-write path", () => {
  const exportedNames = Object.keys(engine);
  for (const name of exportedNames) {
    assert.ok(
      !/apply|commit|merge|writeGlobal|writeMemory|promote/i.test(name),
      `export must not expose authoritative write: ${name}`,
    );
  }
  for (const file of readdirSync(srcDir)) {
    const source = readFileSync(join(srcDir, file), "utf8");
    assert.ok(!source.includes("writeFileSync"), `${file} must not write files`);
    assert.ok(!source.includes("mkdirSync"), `${file} must not create directories`);
    assert.ok(!source.includes("renameSync"), `${file} must not move files`);
  }
});

test("authority subset denies delegated capability outside caller authority", () => {
  const reasons = evaluateAuthoritySubset({
    callerCapabilities: ["repo_read"],
    delegatedCapabilities: ["repo_read", "memory_read"],
  });
  assert.ok(reasons.some((r) => r.code === "DELEGATION-CAPABILITY-ESCALATION-DENIED"));
});

test("authority subset denies capability atoms outside the canonical taxonomy", () => {
  const reasons = evaluateAuthoritySubset({
    callerCapabilities: ["repo_read", "made_up_capability"],
    delegatedCapabilities: ["made_up_capability"],
  });
  assert.ok(reasons.some((r) => r.code === "DELEGATION-CAPABILITY-UNKNOWN"));
});

test("authority subset denies high-risk capability without an authority snapshot", () => {
  const reasons = evaluateAuthoritySubset({
    callerPackId: "pairslash-backend",
    callerCapabilities: ["repo_write"],
    delegatedCapabilities: ["repo_write"],
    packAuthority: null,
  });
  assert.ok(reasons.some((r) => r.code === "DELEGATION-AUTHORITY-SOURCE-REQUIRED"));
});

test("authority subset denies memory_write_global delegation unconditionally", () => {
  const authority = loadDelegationPackAuthority(repoRoot);
  const reasons = evaluateAuthoritySubset({
    callerPackId: "pairslash-memory-write-global",
    callerCapabilities: ["memory_write_global"],
    delegatedCapabilities: ["memory_write_global"],
    packAuthority: authority,
  });
  assert.ok(reasons.some((r) => r.code === "DELEGATION-GLOBAL-MEMORY-CAPABILITY-DENIED"));
});

test("pack-authority allowlist gates high-risk delegation through policy", () => {
  // pairslash-plan is not in the repo_write allowlist
  const denied = evaluateDelegationPolicy({
    ...basePolicyInput,
    repoRoot,
    callerPackId: "pairslash-plan",
    callerCapabilities: ["repo_read", "repo_write"],
    delegatedCapabilities: ["repo_read", "repo_write"],
  });
  assert.equal(denied.overall_verdict, "deny");
  assert.ok(denied.reasons.some((r) => r.code === "DELEGATION-HIGH-RISK-CAPABILITY-DENIED"));
  assert.equal(denied.authority_checked, true);

  // pairslash-backend is allowlisted for repo_write
  const allowed = evaluateDelegationPolicy({
    ...basePolicyInput,
    repoRoot,
    callerPackId: "pairslash-backend",
    callerCapabilities: ["repo_read", "repo_write"],
    delegatedCapabilities: ["repo_read", "repo_write"],
  });
  assert.ok(!allowed.reasons.some((r) => r.code === "DELEGATION-HIGH-RISK-CAPABILITY-DENIED"));
});

test("write-authority-shaped actions are denied outright", () => {
  for (const action of [
    DELEGATION_POLICY_ACTIONS.WRITE_GLOBAL_MEMORY,
    DELEGATION_POLICY_ACTIONS.WRITE_TASK_MEMORY,
    DELEGATION_POLICY_ACTIONS.CHAIN_SPAWN,
    DELEGATION_POLICY_ACTIONS.OPEN_FRONT_DOOR,
  ]) {
    const verdict = evaluateDelegationPolicy({ ...basePolicyInput, action });
    assert.equal(verdict.overall_verdict, "deny", action);
  }
});

test("result envelope is non-authoritative and carries the write-authority route", () => {
  const result = runDelegationScaffold({
    invocation: "explicit",
    capabilities: { delegation_lane_enabled: true },
    workflowId: "pairslash-review",
    workflowClass: "read-oriented",
    requestedWorkerClass: DELEGATION_WORKER_CLASSES.ANALYSIS,
    callerCapabilities: ["repo_read", "review_analysis"],
    delegatedCapabilities: ["repo_read", "review_analysis"],
    callerAllowedPaths: ["docs"],
    workerAllowedPaths: ["docs"],
    changesProposed: [
      { id: "c-1", kind: "proposal", path: "docs/note.md", summary: "update note" },
      {
        id: "c-2",
        kind: "memory-write",
        path: ".pairslash/project-memory/30-glossary.yaml",
        summary: "candidate glossary entry",
      },
    ],
  });

  const envelope = result.result_envelope;
  assert.equal(result.report.status, "planned");
  assert.equal(envelope.authoritative, false);
  assert.equal(envelope.truth_tier, "supplemental");
  assert.equal(envelope.requires_caller_approval, true);
  assert.equal(envelope.write_authority_route, "pairslash-memory-write-global");
  assert.equal(envelope.write_authority_route, WRITE_AUTHORITY_ROUTE);
  const memoryChange = envelope.changes_proposed.find((c) => c.id === "c-2");
  assert.equal(memoryChange.requires_write_authority, "pairslash-memory-write-global");
  assert.equal(memoryChange.authoritative, false);
  assert.equal(memoryChange.apply_mode, "manual-only");
  const plainChange = envelope.changes_proposed.find((c) => c.id === "c-1");
  assert.equal(plainChange.requires_write_authority, null);
});

test("run verdict is deterministic given identical inputs", () => {
  const input = {
    invocation: "explicit",
    capabilities: { delegation_lane_enabled: true },
    workflowId: "pairslash-review",
    workflowClass: "read-oriented",
    requestedWorkerClass: DELEGATION_WORKER_CLASSES.ANALYSIS,
    callerCapabilities: ["repo_read"],
    delegatedCapabilities: ["repo_read"],
    callerAllowedPaths: ["docs"],
    workerAllowedPaths: ["docs"],
  };
  const first = runDelegationScaffold(input);
  const second = runDelegationScaffold(input);
  assert.equal(
    JSON.stringify({ ...first, result_envelope: { ...first.result_envelope, task_id: null } }),
    JSON.stringify({ ...second, result_envelope: { ...second.result_envelope, task_id: null } }),
  );
});

test("blocked delegation produces an aborted empty envelope", () => {
  const result = runDelegationScaffold({
    invocation: "explicit",
    workflowId: "pairslash-memory-write-global",
    workflowClass: "write-authority",
    filesInspected: ["docs/x.md"],
    evidence: [{ source: "docs/x.md", summary: "should be dropped" }],
  });
  assert.equal(result.report.status, "blocked");
  assert.equal(result.result_envelope.aborted, true);
  assert.equal(result.result_envelope.files_inspected.length, 0);
  assert.equal(result.result_envelope.evidence.length, 0);
  assert.equal(result.result_envelope.authoritative, false);
});
