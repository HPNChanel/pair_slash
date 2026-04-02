import { CI_CAPABILITY_DEFAULTS, resolveCiCapabilities } from "./capabilities.js";

const VERDICT_PRECEDENCE = Object.freeze({
  allow: 0,
  ask: 1,
  "require-preview": 2,
  deny: 3,
});

export const CI_POLICY_ACTIONS = Object.freeze({
  READ_REPO: "ci.read_repo",
  RUN_CHECKS: "ci.run_checks",
  GENERATE_DIFF: "ci.generate_diff",
  ATTACH_ARTIFACT: "ci.attach_artifact",
  OPEN_PR_COMMENT: "ci.open_pr_comment",
  COMMIT: "ci.commit",
  MERGE: "ci.merge",
  WRITE_TASK_MEMORY_CANDIDATE: "ci.write_task_memory_candidate",
  WRITE_GLOBAL_MEMORY: "ci.write_global_memory",
});

export const CI_POLICY_CONTRACT = Object.freeze({
  kind: "ci-policy-contract",
  schema_version: "0.1.0",
  capability_defaults: CI_CAPABILITY_DEFAULTS,
  decisions: {
    [CI_POLICY_ACTIONS.READ_REPO]: "allow",
    [CI_POLICY_ACTIONS.RUN_CHECKS]: "allow",
    [CI_POLICY_ACTIONS.GENERATE_DIFF]: "allow",
    [CI_POLICY_ACTIONS.ATTACH_ARTIFACT]: "allow",
    [CI_POLICY_ACTIONS.OPEN_PR_COMMENT]: "ask",
    [CI_POLICY_ACTIONS.COMMIT]: "deny",
    [CI_POLICY_ACTIONS.MERGE]: "deny",
    [CI_POLICY_ACTIONS.WRITE_TASK_MEMORY_CANDIDATE]: "require-preview",
    [CI_POLICY_ACTIONS.WRITE_GLOBAL_MEMORY]: "deny",
  },
  invariants: {
    explicit_opt_in_required: true,
    explicit_invocation_only: true,
    report_first: true,
    artifact_first: true,
    no_direct_repo_commit_default: true,
    no_direct_global_memory_write: true,
    fake_vs_live_distinction_required: true,
  },
});

function pickOverallVerdict(reasons = []) {
  if (reasons.length === 0) {
    return "allow";
  }
  return reasons.reduce((current, reason) => {
    if (VERDICT_PRECEDENCE[reason.verdict] > VERDICT_PRECEDENCE[current]) {
      return reason.verdict;
    }
    return current;
  }, "allow");
}

function buildReason(code, verdict, message) {
  return { code, verdict, message };
}

export function evaluateCiPolicy({
  action,
  capabilities = {},
  explicitInvocation = false,
  repoPolicyExplicit = false,
} = {}) {
  const resolvedCapabilities = resolveCiCapabilities(capabilities);
  const reasons = [];
  const resolvedAction = typeof action === "string" ? action : "ci.unknown";

  if (!explicitInvocation) {
    reasons.push(
      buildReason(
        "CI-EXPLICIT-INVOCATION-REQUIRED",
        "deny",
        "CI lane may run only through explicit invocation",
      ),
    );
  }

  if (!resolvedCapabilities.ci_lane_enabled) {
    reasons.push(
      buildReason(
        "CI-LANE-DISABLED",
        "deny",
        "CI lane is disabled by default until explicitly enabled",
      ),
    );
  }

  if (resolvedCapabilities.ci_requires_explicit_repo_policy && !repoPolicyExplicit) {
    reasons.push(
      buildReason(
        "CI-REPO-POLICY-REQUIRED",
        "deny",
        "CI lane requires an explicit repo policy grant",
      ),
    );
  }

  if (resolvedAction === CI_POLICY_ACTIONS.RUN_CHECKS && resolvedCapabilities.ci_plan_only) {
    reasons.push(
      buildReason(
        "CI-PLAN-ONLY",
        "deny",
        "validation execution is blocked while ci_plan_only is enabled",
      ),
    );
  }

  if (resolvedAction === CI_POLICY_ACTIONS.GENERATE_DIFF && !resolvedCapabilities.ci_generate_patch_artifact) {
    reasons.push(
      buildReason(
        "CI-PATCH-ARTIFACT-DISABLED",
        "deny",
        "patch artifact generation is disabled by default",
      ),
    );
  }

  if (resolvedAction === CI_POLICY_ACTIONS.OPEN_PR_COMMENT && !repoPolicyExplicit) {
    reasons.push(
      buildReason(
        "CI-PR-COMMENT-ASK",
        "ask",
        "opening PR comments requires explicit policy confirmation",
      ),
    );
  }

  if (resolvedAction === CI_POLICY_ACTIONS.COMMIT && resolvedCapabilities.ci_no_direct_repo_commit_default) {
    reasons.push(
      buildReason(
        "CI-COMMIT-DISABLED",
        "deny",
        "direct repository commit is disabled by default for CI lane",
      ),
    );
  }

  if (resolvedAction === CI_POLICY_ACTIONS.MERGE) {
    reasons.push(
      buildReason(
        "CI-MERGE-DISABLED",
        "deny",
        "merge authority is not available in CI lane",
      ),
    );
  }

  if (
    resolvedAction === CI_POLICY_ACTIONS.WRITE_TASK_MEMORY_CANDIDATE &&
    resolvedCapabilities.ci_no_direct_memory_write
  ) {
    reasons.push(
      buildReason(
        "CI-TASK-MEMORY-CANDIDATE-REQUIRES-PREVIEW",
        "require-preview",
        "task-memory candidates require explicit preview and cannot be written directly",
      ),
    );
  }

  if (resolvedAction === CI_POLICY_ACTIONS.WRITE_GLOBAL_MEMORY) {
    reasons.push(
      buildReason(
        "CI-GLOBAL-MEMORY-WRITE-DENIED",
        "deny",
        "CI lane cannot write Global Project Memory directly",
      ),
    );
  }

  const baseVerdict = CI_POLICY_CONTRACT.decisions[resolvedAction] ?? "deny";
  reasons.push(
    buildReason(
      "CI-POLICY-BASELINE",
      baseVerdict,
      `action baseline verdict is ${baseVerdict}`,
    ),
  );

  return {
    kind: "ci-policy-verdict",
    schema_version: "0.1.0",
    action: resolvedAction,
    overall_verdict: pickOverallVerdict(reasons),
    reasons,
    capability_flags: resolvedCapabilities,
    explicit_invocation_required: true,
    explicit_repo_policy_required: resolvedCapabilities.ci_requires_explicit_repo_policy,
    no_direct_memory_write: resolvedCapabilities.ci_no_direct_memory_write,
    no_direct_repo_commit: resolvedCapabilities.ci_no_direct_repo_commit_default,
  };
}
