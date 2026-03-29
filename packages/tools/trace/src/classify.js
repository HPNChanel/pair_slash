const POLICY_PATTERNS = [
  /\bpolicy\b/i,
  /\bpreview-required\b/i,
  /\bapproval-required\b/i,
  /\bPOLICY-/i,
];
const SPEC_PATTERNS = [
  /\bmanifest\b/i,
  /\bschema\b/i,
  /\bcontract\b/i,
  /\bvalidation\b/i,
  /\blint-report\b/i,
  /\bspec\b/i,
];
const COMPILER_PATTERNS = [/\bcompiler\b/i, /\bcompiled-pack\b/i, /\bnormalized-ir\b/i];
const RUNTIME_ADAPTER_PATTERNS = [/\bPRA-CODEX\b/i, /\bPRA-COPILOT\b/i, /\bsurface\b/i, /\badapter\b/i];
const RUNTIME_HOST_PATTERNS = [
  /\bruntime-selection\b/i,
  /\bcodex not found\b/i,
  /\bgh copilot not found\b/i,
  /\bno runtime resolved\b/i,
  /\bruntime\b.*\bversion\b/i,
  /\bruntime\b.*\bexecutable\b/i,
  /\bhost\b/i,
];
const MEMORY_PATTERNS = [/\bmemory write\b/i, /\bmemory-write\b/i, /\baudit-log\b/i, /\bduplicate\b/i, /\bconflict\b/i];
const FILESYSTEM_PATTERNS = [/\bpermission denied\b/i, /\bENOENT\b/i, /\bfilesystem\b/i, /\bpath\b/i, /\bfile\b/i];
const CONFIG_PATTERNS = [/\bconfig\b/i, /\bshell profile\b/i, /\binstall root\b/i, /\bconfig home\b/i];

function matchesAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

export function inferFailureDomain({
  error = null,
  message = "",
  commandName = "",
  eventType = "",
  sourcePackage = "",
} = {}) {
  const haystack = [error?.code, error?.message, message, commandName, eventType, sourcePackage]
    .filter(Boolean)
    .join(" :: ");
  if (!haystack) {
    return "none";
  }
  if (matchesAny(haystack, POLICY_PATTERNS)) {
    return "policy";
  }
  if (matchesAny(haystack, COMPILER_PATTERNS)) {
    return "compiler";
  }
  if (matchesAny(haystack, RUNTIME_ADAPTER_PATTERNS)) {
    return "runtime_adapter";
  }
  if (matchesAny(haystack, RUNTIME_HOST_PATTERNS)) {
    return "runtime_host";
  }
  if (matchesAny(haystack, MEMORY_PATTERNS)) {
    return "memory";
  }
  if (matchesAny(haystack, FILESYSTEM_PATTERNS)) {
    return "filesystem";
  }
  if (matchesAny(haystack, CONFIG_PATTERNS)) {
    return "config";
  }
  if (matchesAny(haystack, SPEC_PATTERNS)) {
    return "spec";
  }
  return "unknown";
}

export function inferSeverity(outcome = "info") {
  if (["failed", "denied"].includes(outcome)) {
    return "error";
  }
  if (outcome === "blocked") {
    return "warn";
  }
  if (outcome === "degraded" || outcome === "warn") {
    return "warn";
  }
  return "info";
}
