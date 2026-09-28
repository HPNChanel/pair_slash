import {
  LIFECYCLE_REASON_CODES,
  REMEDIATION_ACTION_KINDS,
  WORKFLOW_MATURITY_LEVELS,
  WORKFLOW_MATURITY_STRENGTH_ORDER,
} from "../constants.ts";

export function push(errors, code, message) {
  errors.push(`${code} ${message}`);
}

export function sortStable(values) {
  return values
    .slice()
    .sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
}

export function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function toPosixPath(value) {
  return value.replace(/\\/g, "/");
}

export const SHARED_RUNTIME_SURFACE_MATRIX = "docs/compatibility/runtime-surface-matrix.yaml";

export function isLikelyRemoteRef(value) {
  return typeof value === "string" && /^[a-z]+:\/\//i.test(value);
}

export function isSharedRuntimeMatrixRef(value) {
  if (typeof value !== "string" || value.trim() === "" || isLikelyRemoteRef(value)) {
    return false;
  }
  const [pathPart] = value.split("#", 2);
  return toPosixPath(pathPart) === SHARED_RUNTIME_SURFACE_MATRIX;
}

export function isAuthoritativeLiveRuntimeRecordRef(value) {
  if (typeof value !== "string" || value.trim() === "" || isLikelyRemoteRef(value)) {
    return false;
  }
  const [pathPart, fragment] = value.split("#", 2);
  if (fragment) {
    return false;
  }
  const normalizedPath = toPosixPath(pathPart);
  return normalizedPath.startsWith("docs/evidence/live-runtime/") && normalizedPath.endsWith(".yaml");
}

export function validateEvidenceRefPolicy(values, field, errors, code, { requireAuthoritativeLiveRuntimeRecord = false } = {}) {
  for (const value of values) {
    if (isLikelyRemoteRef(value)) {
      push(errors, code, `${field} must use repo-local evidence references`);
      continue;
    }
    if (requireAuthoritativeLiveRuntimeRecord && !isAuthoritativeLiveRuntimeRecordRef(value)) {
      push(errors, code, `${field} must point to docs/evidence/live-runtime/*.yaml authoritative lane records`);
    }
  }
}

export const WORKFLOW_TRANSITION_MAP = Object.freeze({
  canary: new Set(["canary", "preview", "deprecated"]),
  preview: new Set(["preview", "canary", "beta", "deprecated"]),
  beta: new Set(["beta", "preview", "stable", "deprecated"]),
  stable: new Set(["stable", "beta", "deprecated"]),
  deprecated: new Set(["deprecated"]),
});

export function workflowMaturityRank(level) {
  if (!WORKFLOW_MATURITY_LEVELS.includes(level)) {
    return -1;
  }
  return WORKFLOW_MATURITY_STRENGTH_ORDER[level] ?? -1;
}

export function isLegalWorkflowTransition(from, to) {
  if (!WORKFLOW_MATURITY_LEVELS.includes(from) || !WORKFLOW_MATURITY_LEVELS.includes(to)) {
    return false;
  }
  return WORKFLOW_TRANSITION_MAP[from]?.has(to) ?? false;
}

export function validateObject(value, field, errors, code) {
  if (!isObject(value)) {
    push(errors, code, `${field} must be an object`);
    return false;
  }
  return true;
}

export function validateNonEmptyString(value, field, errors, code) {
  if (typeof value !== "string" || value.trim() === "") {
    push(errors, code, `${field} must be a non-empty string`);
    return false;
  }
  return true;
}

export function validateBoolean(value, field, errors, code) {
  if (typeof value !== "boolean") {
    push(errors, code, `${field} must be boolean`);
    return false;
  }
  return true;
}

export function validateStringArray(value, field, errors, code, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    push(errors, code, `${field} must be ${allowEmpty ? "a list" : "a non-empty list"}`);
    return [];
  }
  const seen = new Set();
  const out = [];
  for (const item of value) {
    if (typeof item !== "string" || item.trim() === "") {
      push(errors, code, `${field} entries must be non-empty strings`);
      continue;
    }
    if (seen.has(item)) {
      push(errors, code, `${field} contains duplicate value ${item}`);
      continue;
    }
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function validateLifecycleReasonCodes(value, field, errors, code) {
  if (!Array.isArray(value)) {
    push(errors, code, `${field} must be a list`);
    return;
  }
  for (const reasonCode of value) {
    if (!LIFECYCLE_REASON_CODES.includes(reasonCode)) {
      push(errors, code, `${field} contains unsupported reason code ${reasonCode}`);
    }
  }
}

export function validateRemediationActions(value, field, errors, code) {
  if (!Array.isArray(value)) {
    push(errors, code, `${field} must be a list`);
    return;
  }
  for (const action of value) {
    if (!isObject(action)) {
      push(errors, code, `${field} entries must be objects`);
      continue;
    }
    validateNonEmptyString(action?.action_id, `${field}[].action_id`, errors, code);
    if (!REMEDIATION_ACTION_KINDS.includes(action?.action_kind)) {
      push(errors, code, `${field}[].action_kind must be one of ${REMEDIATION_ACTION_KINDS.join(", ")}`);
    }
    validateNonEmptyString(action?.summary, `${field}[].summary`, errors, code);
    if ("command" in action && action?.command !== null && typeof action?.command !== "string") {
      push(errors, code, `${field}[].command must be string or null`);
    }
    if ("path" in action && action?.path !== null && typeof action?.path !== "string") {
      push(errors, code, `${field}[].path must be string or null`);
    }
    if (typeof action?.safe_without_write !== "boolean") {
      push(errors, code, `${field}[].safe_without_write must be boolean`);
    }
    if (typeof action?.requires_preview !== "boolean") {
      push(errors, code, `${field}[].requires_preview must be boolean`);
    }
    if (typeof action?.preferred !== "boolean") {
      push(errors, code, `${field}[].preferred must be boolean`);
    }
    if (!Array.isArray(action?.applies_to_actions)) {
      push(errors, code, `${field}[].applies_to_actions must be a list`);
    } else {
      for (const appliesToAction of action.applies_to_actions) {
        validateNonEmptyString(appliesToAction, `${field}[].applies_to_actions[]`, errors, code);
      }
    }
    validateLifecycleReasonCodes(action?.reason_codes, `${field}[].reason_codes`, errors, code);
  }
}

export function cloneRecord(value) {
  return JSON.parse(JSON.stringify(value));
}

export function formatIssuePath(issue) {
  if (!Array.isArray(issue?.path) || issue.path.length === 0) {
    return "manifest";
  }
  return issue.path
    .map((segment) => {
      if (typeof segment?.key === "number") {
        return `[${segment.key}]`;
      }
      return `${segment?.key ?? "?"}`;
    })
    .join(".")
    .replace(/\.\[/g, "[");
}
