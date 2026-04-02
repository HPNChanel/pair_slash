import {
  RETRIEVAL_CAPABILITY_DEFAULTS,
  resolveRetrievalCapabilities,
} from "./capabilities.js";

const VERDICT_PRECEDENCE = Object.freeze({
  allow: 0,
  ask: 1,
  "require-preview": 2,
  deny: 3,
});

export const RETRIEVAL_POLICY_ACTIONS = Object.freeze({
  QUERY_REPO_LOCAL: "retrieval.query.repo_local",
  QUERY_ARTIFACT_LOCAL: "retrieval.query.artifact_local",
  QUERY_EXTERNAL: "retrieval.query.external",
  INDEX_BUILD: "retrieval.index.build",
  INDEX_REFRESH: "retrieval.index.refresh",
  MEMORY_PROMOTE: "retrieval.memory.promote",
  HIDDEN_WRITE: "retrieval.hidden_write",
});

export const RETRIEVAL_POLICY_CONTRACT = Object.freeze({
  kind: "retrieval-policy-contract",
  schema_version: "0.1.0",
  capability_defaults: RETRIEVAL_CAPABILITY_DEFAULTS,
  decisions: {
    [RETRIEVAL_POLICY_ACTIONS.QUERY_REPO_LOCAL]: "allow",
    [RETRIEVAL_POLICY_ACTIONS.QUERY_ARTIFACT_LOCAL]: "allow",
    [RETRIEVAL_POLICY_ACTIONS.QUERY_EXTERNAL]: "deny",
    [RETRIEVAL_POLICY_ACTIONS.INDEX_BUILD]: "require-preview",
    [RETRIEVAL_POLICY_ACTIONS.INDEX_REFRESH]: "require-preview",
    [RETRIEVAL_POLICY_ACTIONS.MEMORY_PROMOTE]: "deny",
    [RETRIEVAL_POLICY_ACTIONS.HIDDEN_WRITE]: "deny",
  },
  invariants: {
    explicit_invocation_only: true,
    no_hidden_write: true,
    no_implicit_promote: true,
    global_memory_precedence: "global-wins-on-conflict",
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

export function evaluateRetrievalPolicy({
  action,
  capabilities = {},
  explicitInvocation = false,
  sourcePath = null,
  stale = false,
  secretLikePath = false,
  outsideRepoBoundary = false,
} = {}) {
  const resolvedCapabilities = resolveRetrievalCapabilities(capabilities);
  const reasons = [];
  const resolvedAction = typeof action === "string" ? action : "retrieval.unknown";

  if (!explicitInvocation) {
    reasons.push(
      buildReason(
        "RETRIEVAL-EXPLICIT-REQUIRED",
        "deny",
        "retrieval may run only via explicit invocation",
      ),
    );
  }

  if (!resolvedCapabilities.retrieval_enabled) {
    reasons.push(
      buildReason(
        "RETRIEVAL-DISABLED",
        "deny",
        "retrieval is disabled by default until explicitly enabled",
      ),
    );
  }

  if (outsideRepoBoundary) {
    reasons.push(
      buildReason(
        "RETRIEVAL-OUTSIDE-REPO-BOUNDARY",
        "deny",
        "retrieval source is outside the declared local repository boundary",
      ),
    );
  }

  if (resolvedAction === RETRIEVAL_POLICY_ACTIONS.QUERY_REPO_LOCAL && !resolvedCapabilities.retrieval_repo_local) {
    reasons.push(
      buildReason(
        "RETRIEVAL-REPO-LOCAL-BLOCKED",
        "deny",
        "repo-local retrieval capability is not enabled",
      ),
    );
  }

  if (
    resolvedAction === RETRIEVAL_POLICY_ACTIONS.QUERY_ARTIFACT_LOCAL &&
    !resolvedCapabilities.retrieval_artifact_index
  ) {
    reasons.push(
      buildReason(
        "RETRIEVAL-ARTIFACT-LOCAL-BLOCKED",
        "deny",
        "artifact-local retrieval capability is not enabled",
      ),
    );
  }

  if (
    resolvedAction === RETRIEVAL_POLICY_ACTIONS.QUERY_EXTERNAL &&
    resolvedCapabilities.retrieval_external_disabled_by_default
  ) {
    reasons.push(
      buildReason(
        "RETRIEVAL-EXTERNAL-DISABLED",
        "deny",
        "external retrieval is disabled by default",
      ),
    );
  }

  if (
    resolvedAction === RETRIEVAL_POLICY_ACTIONS.MEMORY_PROMOTE ||
    resolvedAction === RETRIEVAL_POLICY_ACTIONS.HIDDEN_WRITE
  ) {
    reasons.push(
      buildReason(
        "RETRIEVAL-AUTHORITATIVE-WRITE-BLOCKED",
        "deny",
        "retrieval lane cannot write or promote authoritative memory",
      ),
    );
  }

  if (
    (resolvedAction === RETRIEVAL_POLICY_ACTIONS.QUERY_REPO_LOCAL ||
      resolvedAction === RETRIEVAL_POLICY_ACTIONS.QUERY_ARTIFACT_LOCAL) &&
    secretLikePath
  ) {
    reasons.push(
      buildReason(
        "RETRIEVAL-SENSITIVE-PATH-ASK",
        "ask",
        `retrieval source path requires confirmation: ${sourcePath ?? "(unknown)"}`,
      ),
    );
  }

  if (
    (resolvedAction === RETRIEVAL_POLICY_ACTIONS.QUERY_REPO_LOCAL ||
      resolvedAction === RETRIEVAL_POLICY_ACTIONS.QUERY_ARTIFACT_LOCAL) &&
    stale
  ) {
    reasons.push(
      buildReason(
        "RETRIEVAL-STALE-ASK",
        "ask",
        "retrieval source is stale and requires explicit acceptance",
      ),
    );
  }

  const baseVerdict = RETRIEVAL_POLICY_CONTRACT.decisions[resolvedAction] ?? "deny";
  reasons.push(
    buildReason(
      "RETRIEVAL-POLICY-BASELINE",
      baseVerdict,
      `action baseline verdict is ${baseVerdict}`,
    ),
  );

  return {
    kind: "retrieval-policy-verdict",
    schema_version: "0.1.0",
    action: resolvedAction,
    overall_verdict: pickOverallVerdict(reasons),
    reasons,
    capability_flags: resolvedCapabilities,
    explicit_invocation_required: true,
    no_authoritative_write: resolvedCapabilities.retrieval_no_authoritative_write,
  };
}
