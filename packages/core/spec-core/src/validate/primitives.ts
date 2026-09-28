import {
  isOneOf,
  LIFECYCLE_REASON_CODES,
  REMEDIATION_ACTION_KINDS,
  WORKFLOW_MATURITY_LEVELS,
  WORKFLOW_MATURITY_STRENGTH_ORDER,
} from "../constants.ts";

export function push(errors: string[], code: string, message: string): void {
  errors.push(`${code} ${message}`);
}

export function sortStable(values: string[]): string[] {
  return values
    .slice()
    .sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

export const SHARED_RUNTIME_SURFACE_MATRIX = "docs/compatibility/runtime-surface-matrix.yaml";

export function isLikelyRemoteRef(value: unknown): boolean {
  return typeof value === "string" && /^[a-z]+:\/\//i.test(value);
}

export function isSharedRuntimeMatrixRef(value: unknown): boolean {
  if (typeof value !== "string" || value.trim() === "" || isLikelyRemoteRef(value)) {
    return false;
  }
  const [pathPart] = value.split("#", 2);
  return toPosixPath(pathPart) === SHARED_RUNTIME_SURFACE_MATRIX;
}

export function isAuthoritativeLiveRuntimeRecordRef(value: unknown): boolean {
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

export function validateEvidenceRefPolicy(
  values: unknown[],
  field: string,
  errors: string[],
  code: string,
  { requireAuthoritativeLiveRuntimeRecord = false }: { requireAuthoritativeLiveRuntimeRecord?: boolean } = {},
): void {
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

export function workflowMaturityRank(level: unknown): number {
  if (!isOneOf(level, WORKFLOW_MATURITY_LEVELS)) {
    return -1;
  }
  return WORKFLOW_MATURITY_STRENGTH_ORDER[level] ?? -1;
}

export function isLegalWorkflowTransition(from: unknown, to: unknown): boolean {
  if (!isOneOf(from, WORKFLOW_MATURITY_LEVELS) || !isOneOf(to, WORKFLOW_MATURITY_LEVELS)) {
    return false;
  }
  return WORKFLOW_TRANSITION_MAP[from]?.has(to) ?? false;
}

export function validateObject(value: unknown, field: string, errors: string[], code: string): value is Record<string, any> {
  if (!isObject(value)) {
    push(errors, code, `${field} must be an object`);
    return false;
  }
  return true;
}

export function validateNonEmptyString(value: unknown, field: string, errors: string[], code: string): boolean {
  if (typeof value !== "string" || value.trim() === "") {
    push(errors, code, `${field} must be a non-empty string`);
    return false;
  }
  return true;
}

export function validateBoolean(value: unknown, field: string, errors: string[], code: string): boolean {
  if (typeof value !== "boolean") {
    push(errors, code, `${field} must be boolean`);
    return false;
  }
  return true;
}

export function validateStringArray(
  value: unknown,
  field: string,
  errors: string[],
  code: string,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
): string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    push(errors, code, `${field} must be ${allowEmpty ? "a list" : "a non-empty list"}`);
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
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

export function validateLifecycleReasonCodes(value: unknown, field: string, errors: string[], code: string): void {
  if (!Array.isArray(value)) {
    push(errors, code, `${field} must be a list`);
    return;
  }
  for (const reasonCode of value) {
    if (!isOneOf(reasonCode, LIFECYCLE_REASON_CODES)) {
      push(errors, code, `${field} contains unsupported reason code ${reasonCode}`);
    }
  }
}

export function validateRemediationActions(value: unknown, field: string, errors: string[], code: string): void {
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
    if (!isOneOf(action?.action_kind, REMEDIATION_ACTION_KINDS)) {
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

export function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function formatIssuePath(issue: { path?: unknown } | null | undefined): string {
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
