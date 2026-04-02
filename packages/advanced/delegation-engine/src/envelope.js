import { randomUUID } from "node:crypto";

import { resolveDelegationCapabilities } from "./capabilities.js";
import {
  DELEGATION_POLICY_ACTIONS,
  DELEGATION_WORKER_CLASSES,
  evaluateDelegationPolicy,
} from "./policy-contract.js";

const VERDICT_PRECEDENCE = Object.freeze({
  allow: 0,
  ask: 1,
  "require-preview": 2,
  deny: 3,
});

function uniqueSorted(values = []) {
  return [...new Set(
    values.filter((value) => typeof value === "string" && value.trim() !== ""),
  )].sort((left, right) => left.localeCompare(right));
}

function normalizeScope({
  workflowId = null,
  workflowClass = null,
  callerCapabilities = [],
  delegatedCapabilities = [],
  callerAllowedPaths = [],
  workerAllowedPaths = [],
  deniedPaths = [],
} = {}) {
  return {
    workflow_id: workflowId,
    workflow_class: workflowClass,
    caller_capabilities: uniqueSorted(callerCapabilities),
    delegated_capabilities: uniqueSorted(delegatedCapabilities),
    caller_allowed_paths: uniqueSorted(callerAllowedPaths),
    worker_allowed_paths: uniqueSorted(workerAllowedPaths),
    denied_paths: uniqueSorted(deniedPaths),
    max_depth: 1,
    max_fan_out: 1,
  };
}

function normalizeChanges(changesProposed = []) {
  return changesProposed
    .filter((entry) => entry && typeof entry === "object")
    .map((entry, index) => ({
      id: typeof entry.id === "string" && entry.id.trim() !== ""
        ? entry.id
        : `change-${index + 1}`,
      kind: typeof entry.kind === "string" && entry.kind.trim() !== ""
        ? entry.kind
        : "proposal",
      path: typeof entry.path === "string" && entry.path.trim() !== ""
        ? entry.path.replace(/\\/g, "/")
        : null,
      summary: typeof entry.summary === "string" && entry.summary.trim() !== ""
        ? entry.summary
        : "proposal-only change",
      apply_mode: "manual-only",
      authoritative: false,
    }));
}

function normalizeEvidence(evidence = []) {
  return evidence
    .filter((entry) => entry && typeof entry === "object")
    .map((entry, index) => ({
      id: typeof entry.id === "string" && entry.id.trim() !== ""
        ? entry.id
        : `evidence-${index + 1}`,
      source: typeof entry.source === "string" && entry.source.trim() !== ""
        ? entry.source
        : "unknown",
      anchor: typeof entry.anchor === "string" && entry.anchor.trim() !== ""
        ? entry.anchor
        : null,
      summary: typeof entry.summary === "string" && entry.summary.trim() !== ""
        ? entry.summary
        : "",
    }));
}

function resolvePrimaryAction(workerClass) {
  if (workerClass === DELEGATION_WORKER_CLASSES.READ_ONLY) {
    return DELEGATION_POLICY_ACTIONS.READ_SCOPE;
  }
  if (workerClass === DELEGATION_WORKER_CLASSES.ANALYSIS) {
    return DELEGATION_POLICY_ACTIONS.ANALYZE_SCOPE;
  }
  if (workerClass === DELEGATION_WORKER_CLASSES.PATCH_PROPOSAL) {
    return DELEGATION_POLICY_ACTIONS.PROPOSE_PATCH;
  }
  if (workerClass === DELEGATION_WORKER_CLASSES.WRITE_CANDIDATE) {
    return DELEGATION_POLICY_ACTIONS.WRITE_CANDIDATE;
  }
  return DELEGATION_POLICY_ACTIONS.CREATE_TASK;
}

function pickOverallVerdict(verdicts = []) {
  if (verdicts.length === 0) {
    return "allow";
  }
  return verdicts.reduce((current, verdict) => {
    if ((VERDICT_PRECEDENCE[verdict] ?? VERDICT_PRECEDENCE.deny) > VERDICT_PRECEDENCE[current]) {
      return verdict;
    }
    return current;
  }, "allow");
}

export function createDelegationPlan({
  workflowId = null,
  workflowClass = null,
  requestedWorkerClass = DELEGATION_WORKER_CLASSES.READ_ONLY,
} = {}) {
  return {
    kind: "delegation-lane-plan",
    schema_version: "0.1.0",
    lane: "phase11-delegation",
    workflow_id: workflowId,
    workflow_class: workflowClass,
    worker_class: requestedWorkerClass,
    explicit_opt_in_required: true,
    explicit_caller_approval_required: true,
    no_silent_delegation: true,
    no_hidden_chain_spawning: true,
    no_unbounded_fan_out: true,
    max_depth: 1,
    max_fan_out: 1,
    safe_mvp_mode: "scaffold-only",
    report_only: true,
  };
}

export function createDelegatedResultEnvelope({
  taskId = null,
  parentTaskId = null,
  workerClass = DELEGATION_WORKER_CLASSES.READ_ONLY,
  workflowId = null,
  workflowClass = null,
  scope = {},
  filesInspected = [],
  changesProposed = [],
  confidence = "low",
  evidence = [],
  policyVerdict = "deny",
  escalationFlags = [],
  aborted = false,
  summary = null,
} = {}) {
  return {
    kind: "delegated-result-envelope",
    schema_version: "0.1.0",
    task_id: taskId ?? randomUUID(),
    parent_task_id: parentTaskId ?? null,
    worker_class: workerClass,
    workflow_id: workflowId,
    workflow_class: workflowClass,
    scope,
    files_inspected: uniqueSorted(
      filesInspected
        .filter((entry) => typeof entry === "string" && entry.trim() !== "")
        .map((entry) => entry.replace(/\\/g, "/")),
    ),
    changes_proposed: normalizeChanges(changesProposed),
    confidence: ["low", "medium", "high"].includes(confidence) ? confidence : "low",
    evidence: normalizeEvidence(evidence),
    policy_verdict: policyVerdict,
    escalation_flags: uniqueSorted(escalationFlags),
    requires_caller_approval: true,
    aborted,
    authoritative: false,
    truth_tier: "supplemental",
    label: "delegated_result",
    summary,
  };
}

export function runDelegationScaffold({
  invocation = "explicit",
  capabilities = {},
  workflowId = null,
  workflowClass = null,
  requestedWorkerClass = DELEGATION_WORKER_CLASSES.READ_ONLY,
  requestedDepth = 1,
  requestedFanOut = 1,
  callerCapabilities = [],
  delegatedCapabilities = [],
  callerAllowedPaths = [],
  workerAllowedPaths = [],
  deniedPaths = [],
  filesInspected = [],
  evidence = [],
  changesProposed = [],
} = {}) {
  const resolvedCapabilities = resolveDelegationCapabilities(capabilities);
  const explicitInvocation = invocation === "explicit";
  const policyInput = {
    capabilities: resolvedCapabilities,
    explicitInvocation,
    workflowId,
    workflowClass,
    requestedWorkerClass,
    requestedDepth,
    requestedFanOut,
    callerCapabilities,
    delegatedCapabilities,
    callerAllowedPaths,
    workerAllowedPaths,
  };

  const createTaskVerdict = evaluateDelegationPolicy({
    action: DELEGATION_POLICY_ACTIONS.CREATE_TASK,
    ...policyInput,
  });
  const primaryAction = resolvePrimaryAction(requestedWorkerClass);
  const primaryVerdict = evaluateDelegationPolicy({
    action: primaryAction,
    ...policyInput,
  });

  const activeVerdicts = [createTaskVerdict, primaryVerdict];
  const overallPolicyVerdict = pickOverallVerdict(
    activeVerdicts.map((verdict) => verdict.overall_verdict),
  );
  const blocked = overallPolicyVerdict !== "allow";
  const scope = normalizeScope({
    workflowId,
    workflowClass,
    callerCapabilities,
    delegatedCapabilities,
    callerAllowedPaths,
    workerAllowedPaths,
    deniedPaths,
  });
  const decisiveReasonCodes = activeVerdicts
    .flatMap((verdict) => verdict.reasons ?? [])
    .filter((reason) => reason.verdict !== "allow")
    .map((reason) => reason.code);

  const resultEnvelope = createDelegatedResultEnvelope({
    workerClass: requestedWorkerClass,
    workflowId,
    workflowClass,
    scope,
    filesInspected: blocked ? [] : filesInspected,
    changesProposed: blocked ? [] : changesProposed,
    confidence: blocked ? "low" : "medium",
    evidence: blocked ? [] : evidence,
    policyVerdict: overallPolicyVerdict,
    escalationFlags: decisiveReasonCodes,
    aborted: blocked,
    summary: blocked
      ? "delegation request blocked by safe-MVP policy"
      : "delegation scaffold accepted; caller must still review and approve the result envelope",
  });

  const report = {
    kind: "delegation-lane-report",
    schema_version: "0.1.0",
    lane: "phase11-delegation",
    status: blocked ? "blocked" : "planned",
    authoritative: false,
    label: "report",
    truth_tier: "supplemental",
    explicit_invocation: explicitInvocation,
    workflow_id: workflowId,
    workflow_class: workflowClass,
    worker_class: requestedWorkerClass,
    safe_mvp_mode: "scaffold-only",
    no_silent_delegation: true,
    no_hidden_chain_spawning: true,
    no_unbounded_fan_out: true,
  };

  return {
    kind: "delegation-lane-run-result",
    schema_version: "0.1.0",
    lane: "phase11-delegation",
    invocation,
    capability_flags: resolvedCapabilities,
    plan: createDelegationPlan({
      workflowId,
      workflowClass,
      requestedWorkerClass,
    }),
    policy_verdicts: {
      overall: overallPolicyVerdict,
      active: activeVerdicts,
    },
    report,
    result_envelope: resultEnvelope,
  };
}
