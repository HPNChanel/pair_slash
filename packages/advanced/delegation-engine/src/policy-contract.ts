import {
  DELEGATION_CAPABILITY_DEFAULTS,
  resolveDelegationCapabilities,
} from "./capabilities.ts";
import type { DelegationCapabilities } from "./capabilities.ts";
import {
  evaluateAuthoritySubset,
  loadDelegationPackAuthority,
} from "./authority.ts";
import type { PackAuthoritySnapshot } from "./authority.ts";

const VERDICT_PRECEDENCE: Record<string, number> = Object.freeze({
  allow: 0,
  ask: 1,
  "require-preview": 2,
  deny: 3,
});

export const DELEGATION_WORKER_CLASSES = Object.freeze({
  CALLER: "caller",
  READ_ONLY: "delegated_read_only_worker",
  ANALYSIS: "delegated_analysis_worker",
  PATCH_PROPOSAL: "delegated_patch_proposal_worker",
  WRITE_CANDIDATE: "delegated_write_candidate_worker",
});

export const FORBIDDEN_WORKER_CLASSES = Object.freeze([
  "autonomous_chain_spawner",
  "repo_commit_worker",
  "repo_merge_worker",
  "global_memory_writer",
  "front_door_bootstrap_worker",
]);

export const SAFE_MVP_ALLOWED_WORKFLOWS = Object.freeze([
  "pairslash-plan",
  "pairslash-onboard-repo",
  "pairslash-review",
  "pairslash-memory-audit",
  "pairslash-memory-candidate",
]);

export const SAFE_MVP_BLOCKED_WORKFLOWS = Object.freeze([
  "pairslash-backend",
  "pairslash-frontend",
  "pairslash-devops",
  "pairslash-release",
  "pairslash-memory-write-global",
]);

export const DELEGATION_POLICY_ACTIONS = Object.freeze({
  CREATE_TASK: "delegation.create_task",
  READ_SCOPE: "delegation.read_scope",
  ANALYZE_SCOPE: "delegation.analyze_scope",
  PROPOSE_PATCH: "delegation.propose_patch",
  WRITE_CANDIDATE: "delegation.write_candidate",
  CHAIN_SPAWN: "delegation.chain_spawn",
  WRITE_TASK_MEMORY: "delegation.write_task_memory",
  WRITE_GLOBAL_MEMORY: "delegation.write_global_memory",
  OPEN_FRONT_DOOR: "delegation.open_front_door",
});

export const DELEGATION_POLICY_CONTRACT = Object.freeze({
  kind: "delegation-policy-contract",
  schema_version: "0.1.0",
  capability_defaults: DELEGATION_CAPABILITY_DEFAULTS,
  decisions: {
    [DELEGATION_POLICY_ACTIONS.CREATE_TASK]: "allow",
    [DELEGATION_POLICY_ACTIONS.READ_SCOPE]: "allow",
    [DELEGATION_POLICY_ACTIONS.ANALYZE_SCOPE]: "allow",
    [DELEGATION_POLICY_ACTIONS.PROPOSE_PATCH]: "ask",
    [DELEGATION_POLICY_ACTIONS.WRITE_CANDIDATE]: "deny",
    [DELEGATION_POLICY_ACTIONS.CHAIN_SPAWN]: "deny",
    [DELEGATION_POLICY_ACTIONS.WRITE_TASK_MEMORY]: "deny",
    [DELEGATION_POLICY_ACTIONS.WRITE_GLOBAL_MEMORY]: "deny",
    [DELEGATION_POLICY_ACTIONS.OPEN_FRONT_DOOR]: "deny",
  },
  invariants: {
    explicit_opt_in_required: true,
    explicit_invocation_only: true,
    no_silent_delegation: true,
    no_hidden_chain_spawning: true,
    no_unbounded_fan_out: true,
    no_global_memory_write: true,
    no_new_front_door: true,
    max_depth: 1,
    max_fan_out: 1,
    safe_mvp_report_only: true,
  },
});

const SUPPORTED_WORKER_CLASSES = Object.freeze([
  DELEGATION_WORKER_CLASSES.READ_ONLY,
  DELEGATION_WORKER_CLASSES.ANALYSIS,
  DELEGATION_WORKER_CLASSES.PATCH_PROPOSAL,
  DELEGATION_WORKER_CLASSES.WRITE_CANDIDATE,
]);

export type DelegationVerdict = "allow" | "ask" | "require-preview" | "deny";

export interface DelegationPolicyReason {
  code: string;
  verdict: DelegationVerdict;
  message: string;
}

export interface DelegationPolicyVerdict {
  kind: "delegation-policy-verdict";
  schema_version: "0.1.0";
  action: string;
  overall_verdict: DelegationVerdict;
  reasons: DelegationPolicyReason[];
  capability_flags: DelegationCapabilities;
  workflow_id: string | null;
  workflow_class: string | null;
  requested_worker_class: string | null;
  caller_pack_id: string | null;
  authority_checked: boolean;
  max_depth: 1;
  max_fan_out: 1;
  no_chain_spawning: boolean;
  no_unbounded_fan_out: true;
  no_global_memory_write: boolean;
  no_new_front_door: boolean;
}

export interface DelegationPolicyInput {
  action?: string;
  capabilities?: Partial<Record<string, unknown>>;
  explicitInvocation?: boolean;
  workflowId?: string | null;
  workflowClass?: string | null;
  requestedWorkerClass?: string | null;
  requestedDepth?: number;
  requestedFanOut?: number;
  callerPackId?: string | null;
  callerCapabilities?: unknown;
  delegatedCapabilities?: unknown;
  callerAllowedPaths?: unknown;
  workerAllowedPaths?: unknown;
  packAuthority?: PackAuthoritySnapshot | null;
  repoRoot?: string | null;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+$/, "");
}

function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return [...new Set(
    values
      .filter((value): value is string => typeof value === "string" && value.trim() !== "")
      .map((value) => value.trim()),
  )].sort((left, right) => left.localeCompare(right));
}

function workerClassToAction(workerClass: string | null): string {
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

function pickOverallVerdict(reasons: DelegationPolicyReason[]): DelegationVerdict {
  if (reasons.length === 0) {
    return "allow";
  }
  return reasons.reduce<DelegationVerdict>((current, reason) => {
    if (VERDICT_PRECEDENCE[reason.verdict] > VERDICT_PRECEDENCE[current]) {
      return reason.verdict;
    }
    return current;
  }, "allow");
}

function buildReason(code: string, verdict: DelegationVerdict, message: string): DelegationPolicyReason {
  return { code, verdict, message };
}

function isSubpath(pathValue: string, rootValue: string): boolean {
  const normalizedPath = normalizePath(pathValue).toLowerCase();
  const normalizedRoot = normalizePath(rootValue).toLowerCase();
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

function exceedsCallerPaths(callerAllowedPaths: string[], workerAllowedPaths: string[]): boolean {
  if (workerAllowedPaths.length === 0) {
    return false;
  }
  if (callerAllowedPaths.length === 0) {
    return true;
  }
  return workerAllowedPaths.some((candidate) =>
    !callerAllowedPaths.some((root) => isSubpath(candidate, root)));
}

export function evaluateDelegationPolicy({
  action,
  capabilities = {},
  explicitInvocation = false,
  workflowId = null,
  workflowClass = null,
  requestedWorkerClass = null,
  requestedDepth = 1,
  requestedFanOut = 1,
  callerPackId = null,
  callerCapabilities = [],
  delegatedCapabilities = [],
  callerAllowedPaths = [],
  workerAllowedPaths = [],
  packAuthority = null,
  repoRoot = null,
}: DelegationPolicyInput = {}): DelegationPolicyVerdict {
  const resolvedCapabilities = resolveDelegationCapabilities(capabilities);
  const reasons: DelegationPolicyReason[] = [];
  const resolvedAction = typeof action === "string" && action.trim() !== ""
    ? action
    : workerClassToAction(requestedWorkerClass);
  const normalizedCallerPaths = normalizeStringList(callerAllowedPaths);
  const normalizedWorkerPaths = normalizeStringList(workerAllowedPaths);

  if (!explicitInvocation) {
    reasons.push(
      buildReason(
        "DELEGATION-EXPLICIT-INVOCATION-REQUIRED",
        "deny",
        "delegation lane may run only through explicit invocation",
      ),
    );
  }

  if (!resolvedCapabilities.delegation_lane_enabled) {
    reasons.push(
      buildReason(
        "DELEGATION-LANE-DISABLED",
        "deny",
        "delegation lane is disabled by default until explicitly enabled",
      ),
    );
  }

  if (typeof workflowId !== "string" || workflowId.trim() === "") {
    reasons.push(
      buildReason(
        "DELEGATION-WORKFLOW-ID-REQUIRED",
        "deny",
        "delegation request must declare the caller workflow id",
      ),
    );
  }

  if (typeof workflowClass !== "string" || workflowClass.trim() === "") {
    reasons.push(
      buildReason(
        "DELEGATION-WORKFLOW-CLASS-REQUIRED",
        "deny",
        "delegation request must declare the caller workflow class",
      ),
    );
  }

  if (SAFE_MVP_BLOCKED_WORKFLOWS.includes(workflowId ?? "")) {
    reasons.push(
      buildReason(
        "DELEGATION-WORKFLOW-BLOCKED",
        "deny",
        `workflow is blocked in safe MVP: ${workflowId}`,
      ),
    );
  } else if (workflowId && !SAFE_MVP_ALLOWED_WORKFLOWS.includes(workflowId)) {
    reasons.push(
      buildReason(
        "DELEGATION-WORKFLOW-NOT-ALLOWLISTED",
        "deny",
        `workflow is outside the safe MVP allowlist: ${workflowId}`,
      ),
    );
  }

  if (workflowClass === "write-authority") {
    reasons.push(
      buildReason(
        "DELEGATION-WRITE-AUTHORITY-BLOCKED",
        "deny",
        "delegation is forbidden for write-authority workflows",
      ),
    );
  }

  if (workflowClass === "dual-mode") {
    reasons.push(
      buildReason(
        "DELEGATION-DUAL-MODE-BLOCKED",
        "deny",
        "delegation is blocked for dual-mode workflows in the safe MVP",
      ),
    );
  }

  if (requestedDepth > 1) {
    reasons.push(
      buildReason(
        "DELEGATION-MAX-DEPTH-EXCEEDED",
        "deny",
        "delegation safe MVP allows maximum depth 1",
      ),
    );
  }

  if (requestedFanOut > 1) {
    reasons.push(
      buildReason(
        "DELEGATION-MAX-FAN-OUT-EXCEEDED",
        "deny",
        "delegation safe MVP allows maximum fan-out 1",
      ),
    );
  }

  if (FORBIDDEN_WORKER_CLASSES.includes(requestedWorkerClass ?? "")) {
    reasons.push(
      buildReason(
        "DELEGATION-FORBIDDEN-WORKER-CLASS",
        "deny",
        `forbidden worker class requested: ${requestedWorkerClass}`,
      ),
    );
  }

  if (
    requestedWorkerClass &&
    !(SUPPORTED_WORKER_CLASSES as readonly string[]).includes(requestedWorkerClass) &&
    !FORBIDDEN_WORKER_CLASSES.includes(requestedWorkerClass)
  ) {
    reasons.push(
      buildReason(
        "DELEGATION-WORKER-CLASS-UNKNOWN",
        "deny",
        `unknown worker class requested: ${requestedWorkerClass}`,
      ),
    );
  }

  let authoritySnapshot = packAuthority;
  let authorityChecked = packAuthority !== null;
  if (authoritySnapshot === null && typeof repoRoot === "string" && repoRoot.trim() !== "") {
    try {
      authoritySnapshot = loadDelegationPackAuthority(repoRoot);
      authorityChecked = true;
    } catch (error) {
      reasons.push(
        buildReason(
          "DELEGATION-AUTHORITY-LOAD-FAILED",
          "deny",
          `pack-authority snapshot could not be loaded: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }
  const authorityReasons = evaluateAuthoritySubset({
    callerPackId,
    callerCapabilities,
    delegatedCapabilities,
    packAuthority: authoritySnapshot,
  });
  if (authorityReasons.length > 0) {
    authorityChecked = true;
  }
  reasons.push(...authorityReasons);

  if (exceedsCallerPaths(normalizedCallerPaths, normalizedWorkerPaths)) {
    reasons.push(
      buildReason(
        "DELEGATION-PATH-ESCALATION-DENIED",
        "deny",
        "delegated path scope exceeds caller allowed paths",
      ),
    );
  }

  if (
    resolvedAction === DELEGATION_POLICY_ACTIONS.READ_SCOPE &&
    !resolvedCapabilities.delegation_read_only_workers
  ) {
    reasons.push(
      buildReason(
        "DELEGATION-READ-ONLY-DISABLED",
        "deny",
        "read-only workers are disabled by policy",
      ),
    );
  }

  if (
    resolvedAction === DELEGATION_POLICY_ACTIONS.ANALYZE_SCOPE &&
    !resolvedCapabilities.delegation_analysis_workers
  ) {
    reasons.push(
      buildReason(
        "DELEGATION-ANALYSIS-DISABLED",
        "deny",
        "analysis workers are disabled by policy",
      ),
    );
  }

  if (
    resolvedAction === DELEGATION_POLICY_ACTIONS.PROPOSE_PATCH &&
    !resolvedCapabilities.delegation_patch_proposal_workers
  ) {
    reasons.push(
      buildReason(
        "DELEGATION-PATCH-PROPOSAL-DISABLED",
        "deny",
        "patch-proposal workers are disabled in the scaffold-only slice",
      ),
    );
  }

  if (
    resolvedAction === DELEGATION_POLICY_ACTIONS.WRITE_CANDIDATE &&
    !resolvedCapabilities.delegation_write_candidate_workers
  ) {
    reasons.push(
      buildReason(
        "DELEGATION-WRITE-CANDIDATE-DISABLED",
        "deny",
        "write-candidate workers are deferred beyond the scaffold-only slice",
      ),
    );
  }

  if (
    resolvedAction === DELEGATION_POLICY_ACTIONS.CHAIN_SPAWN &&
    resolvedCapabilities.delegation_no_chain_spawning
  ) {
    reasons.push(
      buildReason(
        "DELEGATION-CHAIN-SPAWNING-DENIED",
        "deny",
        "hidden or chained worker spawning is forbidden",
      ),
    );
  }

  if (resolvedAction === DELEGATION_POLICY_ACTIONS.WRITE_TASK_MEMORY) {
    reasons.push(
      buildReason(
        "DELEGATION-TASK-MEMORY-WRITE-DENIED",
        "deny",
        "delegated workers cannot write task memory in the safe MVP",
      ),
    );
  }

  if (
    resolvedAction === DELEGATION_POLICY_ACTIONS.WRITE_GLOBAL_MEMORY &&
    resolvedCapabilities.delegation_no_global_memory_write
  ) {
    reasons.push(
      buildReason(
        "DELEGATION-GLOBAL-MEMORY-WRITE-DENIED",
        "deny",
        "delegated workers cannot write Global Project Memory",
      ),
    );
  }

  if (
    resolvedAction === DELEGATION_POLICY_ACTIONS.OPEN_FRONT_DOOR &&
    resolvedCapabilities.delegation_no_new_front_door
  ) {
    reasons.push(
      buildReason(
        "DELEGATION-NEW-FRONT-DOOR-DENIED",
        "deny",
        "delegation lane cannot create a new front door or competing entrypoint",
      ),
    );
  }

  const baseVerdict = (DELEGATION_POLICY_CONTRACT.decisions as Record<string, DelegationVerdict>)[resolvedAction] ?? "deny";
  reasons.push(
    buildReason(
      "DELEGATION-POLICY-BASELINE",
      baseVerdict,
      `action baseline verdict is ${baseVerdict}`,
    ),
  );

  return {
    kind: "delegation-policy-verdict",
    schema_version: "0.1.0",
    action: resolvedAction,
    overall_verdict: pickOverallVerdict(reasons),
    reasons,
    capability_flags: resolvedCapabilities,
    workflow_id: workflowId,
    workflow_class: workflowClass,
    requested_worker_class: requestedWorkerClass,
    caller_pack_id: callerPackId,
    authority_checked: authorityChecked,
    max_depth: 1,
    max_fan_out: 1,
    no_chain_spawning: resolvedCapabilities.delegation_no_chain_spawning,
    no_unbounded_fan_out: true,
    no_global_memory_write: resolvedCapabilities.delegation_no_global_memory_write,
    no_new_front_door: resolvedCapabilities.delegation_no_new_front_door,
  };
}
