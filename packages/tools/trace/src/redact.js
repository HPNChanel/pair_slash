import { createHash } from "node:crypto";
import { resolve } from "node:path";

const REDACTED = "[REDACTED]";
const ALWAYS_REMOVE_KEY_PATTERN = /(secret|token|password|authorization|api[-_]?key|private[-_]?key|cookie|set-cookie|client[-_]?secret|key[-_]?material)/i;
const HASH_ONLY_KEY_PATTERN = /(prompt|statement|evidence|content|transcript|session[-_]?content|body|credential_blob|notes?|message_text)/i;
const CONFIG_KEY_PATTERN = /(config|settings|profile|mcp|environment|env|servers?)/i;
const PATH_KEY_PATTERN = /(path|root|dir|home|cwd)/i;
const UNKNOWN_SENSITIVE_KEY_PATTERN = /(credential|bearer|oauth|authz)/i;
const SECRET_VALUE_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._-]{10,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
];
const HOME_PATH_PATTERNS = [
  /[A-Za-z]:\\Users\\[^\\]+/g,
  /\/Users\/[^/]+/g,
  /\/home\/[^/]+/g,
];

function fingerprint(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableValue(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${key}:${stableValue(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function addRule(report, rule) {
  report.rules_triggered.add(rule);
}

function markField(report) {
  report.redacted_fields += 1;
}

function removeSecret(report, rule) {
  report.secrets_removed += 1;
  markField(report);
  addRule(report, rule);
}

function hashValue(report, rule) {
  report.hashed_values += 1;
  markField(report);
  addRule(report, rule);
}

function fingerprintConfig(report, rule) {
  report.config_fingerprints += 1;
  markField(report);
  addRule(report, rule);
}

function normalizePathValue(value, { repoRoot } = {}) {
  let normalized = String(value);
  if (repoRoot) {
    const resolvedRoot = resolve(repoRoot);
    normalized = normalized.replaceAll(resolvedRoot, "<repo>");
    normalized = normalized.replaceAll(resolvedRoot.replaceAll("\\", "/"), "<repo>");
    normalized = normalized.replaceAll(resolvedRoot.replaceAll("/", "\\"), "<repo>");
  }
  for (const pattern of HOME_PATH_PATTERNS) {
    normalized = normalized.replace(pattern, "<home>");
  }
  return normalized;
}

function maybeNormalizePath(key, value, report, options) {
  if (typeof value !== "string") {
    return value;
  }
  if (!PATH_KEY_PATTERN.test(key) && !/[A-Za-z]:\\|\/Users\/|\/home\//.test(value)) {
    return value;
  }
  const normalized = normalizePathValue(value, options);
  if (normalized !== value) {
    report.normalized_paths += 1;
    markField(report);
    addRule(report, "path-normalized");
    return normalized;
  }
  return value;
}

function redactScalar(key, value, report, options) {
  if (typeof value !== "string") {
    return value;
  }
  if (ALWAYS_REMOVE_KEY_PATTERN.test(key)) {
    removeSecret(report, "secret-key-removed");
    return REDACTED;
  }
  if (UNKNOWN_SENSITIVE_KEY_PATTERN.test(key)) {
    report.unknown_sensitive_hits += 1;
    removeSecret(report, "unknown-sensitive-key-removed");
    return REDACTED;
  }
  if (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    report.unknown_sensitive_hits += 1;
    removeSecret(report, "secret-value-removed");
    return REDACTED;
  }
  if (CONFIG_KEY_PATTERN.test(key)) {
    fingerprintConfig(report, "config-fingerprinted");
    return `[CONFIG:${fingerprint(value)}]`;
  }
  const normalizedPath = maybeNormalizePath(key, value, report, options);
  if (normalizedPath !== value) {
    return normalizedPath;
  }
  if (HASH_ONLY_KEY_PATTERN.test(key) || value.length > 240) {
    hashValue(report, HASH_ONLY_KEY_PATTERN.test(key) ? "sensitive-text-hashed" : "long-string-hashed");
    return `[HASH:${fingerprint(value)}]`;
  }
  return value;
}

function redactValue(key, value, report, options) {
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(key, entry, report, options));
  }
  if (value && typeof value === "object") {
    if (CONFIG_KEY_PATTERN.test(key)) {
      fingerprintConfig(report, "config-object-fingerprinted");
      return {
        redacted: "config-fingerprint",
        fingerprint: fingerprint(stableValue(value)),
      };
    }
    return Object.keys(value)
      .sort()
      .reduce((acc, childKey) => {
        acc[childKey] = redactValue(childKey, value[childKey], report, options);
        return acc;
      }, {});
  }
  return redactScalar(key, value, report, options);
}

export function redactTraceEvents(events, options = {}) {
  const report = {
    redacted_fields: 0,
    redacted_events: 0,
    unknown_sensitive_hits: 0,
    rules_triggered: new Set(),
    secrets_removed: 0,
    hashed_values: 0,
    config_fingerprints: 0,
    normalized_paths: 0,
  };
  const redacted = events.map((event) => {
    const nextEvent = redactValue("event", event, report, options);
    if (JSON.stringify(nextEvent) !== JSON.stringify(event)) {
      report.redacted_events += 1;
    }
    return nextEvent;
  });
  const redactionState = report.unknown_sensitive_hits > 0 ? "review-required" : "shareable";
  return {
    events: redacted,
    report: {
      redacted_fields: report.redacted_fields,
      redacted_events: report.redacted_events,
      unknown_sensitive_hits: report.unknown_sensitive_hits,
      rules_triggered: [...report.rules_triggered].sort((left, right) => left.localeCompare(right)),
      redaction_state: redactionState,
      secrets_removed: report.secrets_removed,
      hashed_values: report.hashed_values,
      config_fingerprints: report.config_fingerprints,
      normalized_paths: report.normalized_paths,
    },
  };
}
