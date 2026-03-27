import {
  POLICY_DECISIONS,
  POLICY_VERDICT_SCHEMA_VERSION,
  SUPPORTED_RUNTIMES,
  SUPPORTED_TARGETS,
  normalizeRuntime,
  normalizeTarget,
  validateContractEnvelope,
  validatePolicyVerdict,
} from "@pairslash/spec-core";

import { buildPolicyExplanation, explainPolicyVerdict } from "./explain.js";
import { POLICY_ENGINE_ERROR_CODES } from "./error-codes.js";
import { deriveRiskProfile, hasRisk } from "./risk-profile.js";
import { buildRuntimeEnforcementContext } from "./runtime-context.js";

const PRECEDENCE = {
  allow: 0,
  ask: 1,
  "require-preview": 2,
  deny: 3,
};

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function addReason(
  reasons,
  {
    code,
    verdict,
    policyArea,
    relatedRisks = [],
    message,
    contractFields = [],
    runtimeFactors = [],
  },
) {
  reasons.push({
    code,
    verdict,
    policy_area: policyArea,
    related_risks: uniqueSorted(relatedRisks),
    message,
    contract_fields: uniqueSorted(contractFields),
    runtime_factors: uniqueSorted(runtimeFactors),
  });
}

function pickOverallVerdict(reasons) {
  if (reasons.length === 0) {
    return "allow";
  }
  return reasons.reduce(
    (current, entry) => (PRECEDENCE[entry.verdict] > PRECEDENCE[current] ? entry.verdict : current),
    "allow",
  );
}

function hasGrantedCapability(contract, capability) {
  return contract.capability_scope?.granted?.includes(capability) || false;
}

function getCapabilityNegotiation(contract, capability) {
  return contract.capability_scope?.negotiation?.find((entry) => entry.capability === capability) ?? null;
}

function getCapabilityStatus(contract, capability) {
  if (hasGrantedCapability(contract, capability)) {
    return "granted";
  }
  return getCapabilityNegotiation(contract, capability)?.status ?? "denied";
}

function getRequiredTools(contract) {
  if (Array.isArray(contract.tool_contract?.tools_required)) {
    return contract.tool_contract.tools_required;
  }
  return contract.tool_contract?.required_tools ?? [];
}

function getRiskCategories(evaluatedRisks) {
  return uniqueSorted(evaluatedRisks.map((entry) => entry.category));
}

function resolveRuntime(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  try {
    const normalized = normalizeRuntime(value);
    return SUPPORTED_RUNTIMES.includes(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

function resolveTarget(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  try {
    const normalized = normalizeTarget(value);
    return SUPPORTED_TARGETS.includes(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

function resolveVerdictContext(contract, request) {
  return {
    runtime: resolveRuntime(contract?.runtime) ?? resolveRuntime(request?.requested_runtime),
    target: resolveTarget(contract?.target) ?? resolveTarget(request?.requested_target),
    contractId: typeof contract?.contract_id === "string" ? contract.contract_id : null,
  };
}

function buildCapabilityNegotiation(contract, capabilityRequest) {
  const negotiation = [...(contract.capability_scope?.negotiation ?? [])].map((entry) => ({
    capability: entry.capability,
    status: entry.status,
    reason: entry.reason ?? null,
  }));
  for (const capability of capabilityRequest ?? []) {
    if (negotiation.some((entry) => entry.capability === capability)) {
      continue;
    }
    negotiation.push({
      capability,
      status: "denied",
      reason: "outside contract scope",
    });
  }
  return negotiation.sort((left, right) => left.capability.localeCompare(right.capability));
}

function evaluateTools(contract, request, reasons, evaluatedRisks) {
  const availability = new Map((request.available_tools ?? []).map((tool) => [tool.id, Boolean(tool.available)]));
  for (const tool of getRequiredTools(contract)) {
    if (availability.get(tool.id) !== false) {
      continue;
    }
    addReason(reasons, {
      code: "POLICY-TOOL-MISSING",
      verdict: request.apply ? "deny" : "ask",
      policyArea: "tool",
      relatedRisks: getRiskCategories(evaluatedRisks),
      message: `required tool ${tool.id} is unavailable for ${request.action ?? "policy-eval"}`,
      contractFields: ["tool_contract.tools_required"],
      runtimeFactors: [`tool:${tool.id}:unavailable`],
    });
  }
}

function buildFailClosedVerdict({ contract, request = {}, errors }) {
  const context = resolveVerdictContext(contract, request);
  if (!context.runtime) {
    throw new Error(POLICY_ENGINE_ERROR_CODES.RUNTIME_CONTEXT_UNRESOLVED);
  }
  if (!context.target) {
    throw new Error(POLICY_ENGINE_ERROR_CODES.TARGET_CONTEXT_UNRESOLVED);
  }
  const runtimeBoundary =
    contract?.runtime_boundary ??
    {
      adapter: context.runtime,
      enforcement_mode: "runtime-aware",
      differences: [],
    };
  const enforcementContext =
    context.runtime === "codex_cli"
      ? {
          runtime: context.runtime,
          primary_enforcement: "pairslash-wrapper",
          hook_support: "none",
          supported_surfaces: ["canonical_skill", "direct_invocation"],
          surface_notes: ["PairSlash wrapper/runtime adapter is the primary enforcement boundary."],
          no_silent_fallback: true,
        }
      : {
          runtime: context.runtime,
          primary_enforcement: "pairslash-wrapper-plus-hook-assist",
          hook_support: "advisory",
          supported_surfaces: ["canonical_skill", "direct_invocation", "hook"],
          surface_notes: ["PairSlash wrapper/runtime adapter remains authoritative; hooks are assistive only."],
          no_silent_fallback: true,
        };
  const reasons = [];
  addReason(reasons, {
    code: "POLICY-CONTRACT-INCOMPLETE",
    verdict: "deny",
    policyArea: "contract",
    relatedRisks: [],
    message: `contract information is incomplete; fail closed :: ${errors.join("; ")}`,
    contractFields: [],
    runtimeFactors: [`runtime:${context.runtime}`, `target:${context.target}`],
  });
  const verdict = {
    kind: "policy-verdict",
    schema_version: POLICY_VERDICT_SCHEMA_VERSION,
    contract_id: context.contractId,
    runtime: context.runtime,
    target: context.target,
    action: request.action ?? "policy-eval",
    overall_verdict: "deny",
    machine_readable: true,
    preview_required: false,
    approval_required: false,
    allowed_operations: ["preview"],
    blocked_operations: ["apply"],
    evaluated_risks: [],
    reasons,
    capability_negotiation: [],
    enforcement_context: enforcementContext,
    runtime_boundary: runtimeBoundary,
  };
  verdict.explanation = buildPolicyExplanation(verdict);
  const validationErrors = validatePolicyVerdict(verdict);
  if (validationErrors.length > 0) {
    throw new Error(`invalid policy verdict :: ${validationErrors.join("; ")}`);
  }
  return verdict;
}

export function evaluatePolicy({ contract, request = {} } = {}) {
  if (!contract || typeof contract !== "object") {
    return buildFailClosedVerdict({
      contract,
      request,
      errors: [POLICY_ENGINE_ERROR_CODES.CONTRACT_REQUIRED],
    });
  }

  const contractErrors = validateContractEnvelope(contract);
  if (contractErrors.length > 0) {
    return buildFailClosedVerdict({
      contract,
      request,
      errors: contractErrors,
    });
  }

  const evaluatedRisks = deriveRiskProfile(contract, request);
  const riskCategories = getRiskCategories(evaluatedRisks);
  const reasons = [];
  const capabilityRequest = Array.isArray(request.capability_request) ? request.capability_request : [];
  const capabilityNegotiation = buildCapabilityNegotiation(contract, capabilityRequest);
  const enforcementContext = buildRuntimeEnforcementContext(contract);
  const requestedRuntime = resolveRuntime(request.requested_runtime ?? contract.runtime);
  const requestedTarget = resolveTarget(request.requested_target ?? contract.target);
  const requestedSurface = request.required_surface ?? request.trigger_surface ?? null;

  if (requestedRuntime !== contract.runtime || requestedTarget !== contract.target) {
    addReason(reasons, {
      code: "POLICY-RUNTIME-BOUNDARY",
      verdict: "deny",
      policyArea: "runtime-boundary",
      relatedRisks: riskCategories,
      message: `requested ${requestedRuntime ?? "unknown"}/${requestedTarget ?? "unknown"} exceeds contract boundary ${contract.runtime}/${contract.target}`,
      contractFields: ["runtime", "target"],
      runtimeFactors: [
        `requested_runtime:${requestedRuntime ?? "unknown"}`,
        `requested_target:${requestedTarget ?? "unknown"}`,
      ],
    });
  }

  if (
    requestedSurface &&
    !enforcementContext.supported_surfaces.includes(requestedSurface)
  ) {
    addReason(reasons, {
      code: "POLICY-UNSUPPORTED-SURFACE",
      verdict: "deny",
      policyArea: "runtime-boundary",
      relatedRisks: riskCategories,
      message: `surface ${requestedSurface} is not supported by ${contract.runtime}; no silent fallback is allowed`,
      contractFields: ["failure_contract.no_silent_fallback", "runtime_boundary.differences"],
      runtimeFactors: [
        `required_surface:${requestedSurface}`,
        `supported_surfaces:${enforcementContext.supported_surfaces.join(",")}`,
      ],
    });
  }

  if (contract.memory_contract?.no_hidden_write && request.hidden_write_attempted) {
    addReason(reasons, {
      code: "POLICY-HIDDEN-WRITE-BLOCKED",
      verdict: "deny",
      policyArea: "memory-authority",
      relatedRisks: riskCategories,
      message: "hidden or implicit authoritative memory write is blocked",
      contractFields: ["memory_contract.no_hidden_write", "memory_contract.authoritative_write_allowed"],
      runtimeFactors: [`runtime:${contract.runtime}`],
    });
  }

  if (
    contract.memory_contract?.authoritative_write_allowed &&
    (request.read_only_workflow === true ||
      request.workflow_class === "read-oriented" ||
      request.authority_mode === "read-only")
  ) {
    addReason(reasons, {
      code: "POLICY-WORKFLOW-AUTHORITY-BLOCKED",
      verdict: "deny",
      policyArea: "memory-authority",
      relatedRisks: riskCategories,
      message: "read-only workflow context cannot perform authoritative memory write",
      contractFields: [
        "memory_contract.authoritative_write_allowed",
        "memory_contract.authority_mode",
      ],
      runtimeFactors: [
        `workflow_class:${request.workflow_class ?? "unknown"}`,
        `authority_mode:${request.authority_mode ?? "unknown"}`,
      ],
    });
  }

  if (contract.memory_contract?.authoritative_write_allowed && request.implicit_promote_attempted) {
    addReason(reasons, {
      code: "POLICY-IMPLICIT-PROMOTE-BLOCKED",
      verdict: "deny",
      policyArea: "memory-authority",
      relatedRisks: riskCategories,
      message: "task/session memory cannot be promoted into global memory implicitly",
      contractFields: [
        "memory_contract.authoritative_write_allowed",
        "memory_contract.explicit_write_only",
      ],
      runtimeFactors: [`runtime:${contract.runtime}`],
    });
  }

  if (contract.failure_contract?.no_silent_fallback && request.fallback_attempted && request.allow_fallback !== true) {
    addReason(reasons, {
      code: "POLICY-NO-SILENT-FALLBACK",
      verdict: "deny",
      policyArea: "fallback",
      relatedRisks: riskCategories,
      message: "silent fallback was attempted across a guarded capability or runtime boundary",
      contractFields: ["failure_contract.no_silent_fallback", "capability_scope.negotiation"],
      runtimeFactors: [`runtime:${contract.runtime}`],
    });
  }

  for (const capability of capabilityRequest) {
    const status = getCapabilityStatus(contract, capability);
    if (status === "granted") {
      continue;
    }
    addReason(reasons, {
      code: "POLICY-CAPABILITY-UNSUPPORTED",
      verdict: "deny",
      policyArea: "capability",
      relatedRisks: riskCategories,
      message: `capability ${capability} is not supported on the current contract/runtime surface`,
      contractFields: [
        "capability_scope.requested",
        "capability_scope.granted",
        "capability_scope.negotiation",
      ],
      runtimeFactors: [`capability:${capability}`, `status:${status}`],
    });
  }

  if (Array.isArray(request.conflicts) && request.conflicts.length > 0) {
    addReason(reasons, {
      code: "POLICY-CONFLICT-BLOCK",
      verdict: "deny",
      policyArea: "conflict",
      relatedRisks: riskCategories,
      message: `${request.conflicts.length} conflict(s) block the requested operation`,
      contractFields: ["memory_contract.authoritative_write_allowed"],
      runtimeFactors: [`conflicts:${request.conflicts.length}`],
    });
  }

  const riskyWrite = hasRisk(evaluatedRisks, "repo-write") || hasRisk(evaluatedRisks, "destructive");
  const authoritativeWrite = contract.memory_contract?.authoritative_write_allowed === true;

  if (request.apply && (riskyWrite || authoritativeWrite) && request.preview_requested !== true) {
    addReason(reasons, {
      code: "POLICY-PREVIEW-REQUIRED",
      verdict: "require-preview",
      policyArea: "preview",
      relatedRisks: riskCategories,
      message: authoritativeWrite
        ? "preview is required before authoritative memory commit"
        : "preview is required before risky write apply",
      contractFields: [
        "memory_contract.preview_required",
        "output_contract.allowed_side_effects_summary.preview_required",
      ],
      runtimeFactors: [`apply:${Boolean(request.apply)}`],
    });
  }

  if (authoritativeWrite && request.apply && request.approval !== "explicit") {
    addReason(reasons, {
      code: "POLICY-APPROVAL-REQUIRED",
      verdict: "ask",
      policyArea: "approval",
      relatedRisks: riskCategories,
      message: "explicit approval is required before authoritative memory commit",
      contractFields: [
        "memory_contract.authoritative_write_allowed",
        "output_contract.allowed_side_effects_summary.explicit_approval_required",
      ],
      runtimeFactors: [`approval:${request.approval ?? "none"}`],
    });
  }

  if (
    hasRisk(evaluatedRisks, "destructive") &&
    hasRisk(evaluatedRisks, "secret-touching") &&
    request.approval !== "explicit"
  ) {
    addReason(reasons, {
      code: "POLICY-DESTRUCTIVE-SECRET-BLOCK",
      verdict: "deny",
      policyArea: "approval",
      relatedRisks: ["destructive", "secret-touching"],
      message: "destructive secret-touching operations require explicit approval and cannot proceed implicitly",
      contractFields: [
        "tool_contract.secret_touching_allowance",
        "output_contract.allowed_side_effects_summary.destructive_allowed",
      ],
      runtimeFactors: [`approval:${request.approval ?? "none"}`],
    });
  }

  if (
    authoritativeWrite &&
    request.apply &&
    !hasGrantedCapability(contract, "preview_emit")
  ) {
    addReason(reasons, {
      code: "POLICY-PREVIEW-CAPABILITY",
      verdict: "deny",
      policyArea: "capability",
      relatedRisks: riskCategories,
      message: "authoritative memory write requires preview_emit capability",
      contractFields: ["capability_scope.granted", "memory_contract.authoritative_write_allowed"],
      runtimeFactors: [`runtime:${contract.runtime}`],
    });
  }

  evaluateTools(contract, request, reasons, evaluatedRisks);

  if (reasons.length === 0) {
    addReason(reasons, {
      code: "POLICY-ALLOW",
      verdict: "allow",
      policyArea: "risk",
      relatedRisks: riskCategories,
      message: "requested operation remains within the declared contract and runtime boundary",
      contractFields: uniqueSorted(evaluatedRisks.flatMap((entry) => entry.sources)),
      runtimeFactors: [
        `primary_enforcement:${enforcementContext.primary_enforcement}`,
        `hook_support:${enforcementContext.hook_support}`,
      ],
    });
  }

  const overallVerdict = pickOverallVerdict(reasons);
  const verdict = {
    kind: "policy-verdict",
    schema_version: POLICY_VERDICT_SCHEMA_VERSION,
    contract_id: contract.contract_id ?? null,
    runtime: contract.runtime,
    target: contract.target,
    action: request.action ?? "policy-eval",
    overall_verdict: overallVerdict,
    machine_readable: true,
    preview_required: reasons.some((reason) => reason.code === "POLICY-PREVIEW-REQUIRED"),
    approval_required: reasons.some(
      (reason) =>
        reason.code === "POLICY-APPROVAL-REQUIRED" ||
        reason.code === "POLICY-DESTRUCTIVE-SECRET-BLOCK",
    ),
    allowed_operations:
      overallVerdict === "deny" || overallVerdict === "require-preview"
        ? ["preview"]
        : ["preview", "apply"],
    blocked_operations:
      overallVerdict === "allow"
        ? []
        : overallVerdict === "ask"
          ? ["apply-unconfirmed"]
          : ["apply"],
    evaluated_risks: evaluatedRisks,
    reasons,
    capability_negotiation: capabilityNegotiation,
    enforcement_context: enforcementContext,
    runtime_boundary: contract.runtime_boundary,
  };
  verdict.explanation = buildPolicyExplanation(verdict);

  const validationErrors = validatePolicyVerdict(verdict);
  if (validationErrors.length > 0) {
    throw new Error(`invalid policy verdict :: ${validationErrors.join("; ")}`);
  }
  return verdict;
}

export { POLICY_DECISIONS, POLICY_ENGINE_ERROR_CODES, deriveRiskProfile, explainPolicyVerdict };
