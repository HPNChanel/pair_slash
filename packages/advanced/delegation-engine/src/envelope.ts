import { randomUUID } from "node:crypto";

import { resolveDelegationCapabilities } from "./capabilities.ts";
import type { DelegationCapabilities } from "./capabilities.ts";
import { WRITE_AUTHORITY_ROUTE } from "./authority.ts";
import type { PackAuthoritySnapshot } from "./authority.ts";
import {
  DELEGATION_POLICY_ACTIONS,
  DELEGATION_WORKER_CLASSES,
  evaluateDelegationPolicy,
} from "./policy-contract.ts";
import type {
  DelegationPolicyInput,
  DelegationPolicyVerdict,
  DelegationVerdict,
} from "./policy-contract.ts";

const VERDICT_PRECEDENCE: Record<string, number> = Object.freeze({
  allow: 0,
  ask: 1,
  "require-preview": 2,
  deny: 3,
});

function uniqueSorted(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return [...new Set(
    values.filter((value): value is string => typeof value === "string" && value.trim() !== ""),
  )].sort((left, right) => left.localeCompare(right));
}

export interface DelegationScope {
  workflow_id: string | null;
  workflow_class: string | null;
  caller_capabilities: string[];
  delegated_capabilities: string[];
  caller_allowed_paths: string[];
  worker_allowed_paths: string[];
  denied_paths: string[];
  max_depth: 1;
  max_fan_out: 1;
}

export interface DelegationChange {
  id: string;
  kind: string;
  path: string | null;
  summary: string;
  apply_mode: "manual-only";
  authoritative: false;
  requires_write_authority: string | null;
}

export interface DelegationEvidence {
  id: string;
  source: string;
  anchor: string | null;
  summary: string;
}

export interface DelegatedResultEnvelope {
  kind: "delegated-result-envelope";
  schema_version: "0.1.0";
  task_id: string;
  parent_task_id: string | null;
  worker_class: string;
  workflow_id: string | null;
  workflow_class: string | null;
  scope: unknown;
  files_inspected: string[];
  changes_proposed: DelegationChange[];
  confidence: "low" | "medium" | "high";
  evidence: DelegationEvidence[];
  policy_verdict: string;
  escalation_flags: string[];
  requires_caller_approval: true;
  write_authority_route: typeof WRITE_AUTHORITY_ROUTE;
  aborted: boolean;
  authoritative: false;
  truth_tier: "supplemental";
  label: "delegated_result";
  summary: string | null;
}

function normalizeScope({
  workflowId = null,
  workflowClass = null,
  callerCapabilities = [],
  delegatedCapabilities = [],
  callerAllowedPaths = [],
  workerAllowedPaths = [],
  deniedPaths = [],
}: {
  workflowId?: string | null;
  workflowClass?: string | null;
  callerCapabilities?: unknown;
  delegatedCapabilities?: unknown;
  callerAllowedPaths?: unknown;
  workerAllowedPaths?: unknown;
  deniedPaths?: unknown;
} = {}): DelegationScope {
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

function isMemoryWriteShaped(kind: string, path: string | null): boolean {
  if (kind.includes("memory")) {
    return true;
  }
  if (path === null) {
    return false;
  }
  const normalized = path.replace(/\\/g, "/");
  return normalized.startsWith(".pairslash/project-memory")
    || normalized.startsWith(".pairslash/task-memory");
}

function normalizeChanges(changesProposed: unknown): DelegationChange[] {
  if (!Array.isArray(changesProposed)) {
    return [];
  }
  return changesProposed
    .filter((entry): entry is Record<string, unknown> =>
      Boolean(entry) && typeof entry === "object")
    .map((entry, index) => {
      const kind = typeof entry.kind === "string" && entry.kind.trim() !== ""
        ? entry.kind
        : "proposal";
      const path = typeof entry.path === "string" && entry.path.trim() !== ""
        ? entry.path.replace(/\\/g, "/")
        : null;
      return {
        id: typeof entry.id === "string" && entry.id.trim() !== ""
          ? entry.id
          : `change-${index + 1}`,
        kind,
        path,
        summary: typeof entry.summary === "string" && entry.summary.trim() !== ""
          ? entry.summary
          : "proposal-only change",
        apply_mode: "manual-only" as const,
        authoritative: false as const,
        requires_write_authority: isMemoryWriteShaped(kind, path)
          ? WRITE_AUTHORITY_ROUTE
          : null,
      };
    });
}

function normalizeEvidence(evidence: unknown): DelegationEvidence[] {
  if (!Array.isArray(evidence)) {
    return [];
  }
  return evidence
    .filter((entry): entry is Record<string, unknown> =>
      Boolean(entry) && typeof entry === "object")
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

function resolvePrimaryAction(workerClass: string | null): string {
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

function pickOverallVerdict(verdicts: DelegationVerdict[]): DelegationVerdict {
  if (verdicts.length === 0) {
    return "allow";
  }
  return verdicts.reduce<DelegationVerdict>((current, verdict) => {
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
}: {
  workflowId?: string | null;
  workflowClass?: string | null;
  requestedWorkerClass?: string;
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
}: {
  taskId?: string | null;
  parentTaskId?: string | null;
  workerClass?: string;
  workflowId?: string | null;
  workflowClass?: string | null;
  scope?: unknown;
  filesInspected?: unknown;
  changesProposed?: unknown;
  confidence?: string;
  evidence?: unknown;
  policyVerdict?: string;
  escalationFlags?: unknown;
  aborted?: boolean;
  summary?: string | null;
} = {}): DelegatedResultEnvelope {
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
      Array.isArray(filesInspected)
        ? filesInspected
          .filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "")
          .map((entry) => entry.replace(/\\/g, "/"))
        : [],
    ),
    changes_proposed: normalizeChanges(changesProposed),
    confidence: (["low", "medium", "high"] as const).includes(confidence as "low" | "medium" | "high")
      ? confidence as "low" | "medium" | "high"
      : "low",
    evidence: normalizeEvidence(evidence),
    policy_verdict: policyVerdict,
    escalation_flags: uniqueSorted(escalationFlags),
    requires_caller_approval: true,
    write_authority_route: WRITE_AUTHORITY_ROUTE,
    aborted,
    authoritative: false,
    truth_tier: "supplemental",
    label: "delegated_result",
    summary,
  };
}

export interface DelegationLaneRunResult {
  kind: "delegation-lane-run-result";
  schema_version: "0.1.0";
  lane: "phase11-delegation";
  invocation: string;
  capability_flags: DelegationCapabilities;
  plan: ReturnType<typeof createDelegationPlan>;
  policy_verdicts: {
    overall: DelegationVerdict;
    active: DelegationPolicyVerdict[];
  };
  report: {
    kind: "delegation-lane-report";
    schema_version: "0.1.0";
    lane: "phase11-delegation";
    status: "blocked" | "planned";
    authoritative: false;
    label: "report";
    truth_tier: "supplemental";
    explicit_invocation: boolean;
    workflow_id: string | null;
    workflow_class: string | null;
    worker_class: string;
    safe_mvp_mode: "scaffold-only";
    no_silent_delegation: true;
    no_hidden_chain_spawning: true;
    no_unbounded_fan_out: true;
  };
  result_envelope: DelegatedResultEnvelope;
}

export function runDelegationScaffold({
  invocation = "explicit",
  capabilities = {},
  workflowId = null,
  workflowClass = null,
  requestedWorkerClass = DELEGATION_WORKER_CLASSES.READ_ONLY,
  requestedDepth = 1,
  requestedFanOut = 1,
  callerPackId = null,
  callerCapabilities = [],
  delegatedCapabilities = [],
  callerAllowedPaths = [],
  workerAllowedPaths = [],
  deniedPaths = [],
  filesInspected = [],
  evidence = [],
  changesProposed = [],
  packAuthority = null,
  repoRoot = null,
}: {
  invocation?: string;
  capabilities?: Partial<Record<string, unknown>>;
  workflowId?: string | null;
  workflowClass?: string | null;
  requestedWorkerClass?: string;
  requestedDepth?: number;
  requestedFanOut?: number;
  callerPackId?: string | null;
  callerCapabilities?: unknown;
  delegatedCapabilities?: unknown;
  callerAllowedPaths?: unknown;
  workerAllowedPaths?: unknown;
  deniedPaths?: unknown;
  filesInspected?: unknown;
  evidence?: unknown;
  changesProposed?: unknown;
  packAuthority?: PackAuthoritySnapshot | null;
  repoRoot?: string | null;
} = {}): DelegationLaneRunResult {
  const resolvedCapabilities = resolveDelegationCapabilities(capabilities);
  const explicitInvocation = invocation === "explicit";
  const policyInput: DelegationPolicyInput = {
    capabilities: resolvedCapabilities,
    explicitInvocation,
    workflowId,
    workflowClass,
    requestedWorkerClass,
    requestedDepth,
    requestedFanOut,
    callerPackId,
    callerCapabilities,
    delegatedCapabilities,
    callerAllowedPaths,
    workerAllowedPaths,
    packAuthority,
    repoRoot,
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

  const report: DelegationLaneRunResult["report"] = {
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
