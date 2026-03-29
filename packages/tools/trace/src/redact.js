import { createHash } from "node:crypto";

const REDACTED = "[REDACTED]";
const REDACT_KEY_PATTERN = /(secret|token|password|authorization|api[-_]?key|private[-_]?key|session[-_]?content|prompt|statement|evidence|content)/i;
const UNKNOWN_SENSITIVE_KEY_PATTERN = /(credential|cookie|bearer|oauth|authz|client[-_]?secret|key[-_]?material)/i;
const SECRET_VALUE_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._-]{10,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
];

function fingerprint(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function addRule(report, rule) {
  report.rules_triggered.add(rule);
}

function markRedaction(report, rule) {
  report.redacted_fields += 1;
  addRule(report, rule);
}

function redactScalar(key, value, report) {
  if (typeof value !== "string") {
    return value;
  }
  if (REDACT_KEY_PATTERN.test(key)) {
    markRedaction(report, "key-sensitive");
    return `${REDACTED}:${fingerprint(value)}`;
  }
  if (UNKNOWN_SENSITIVE_KEY_PATTERN.test(key)) {
    report.unknown_sensitive_hits += 1;
    markRedaction(report, "key-unknown-sensitive");
    return `${REDACTED}:${fingerprint(value)}`;
  }
  if (value.length > 240) {
    markRedaction(report, "long-string");
    return `${REDACTED}:${fingerprint(value)}`;
  }
  if (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    report.unknown_sensitive_hits += 1;
    markRedaction(report, "value-sensitive-pattern");
    return `${REDACTED}:${fingerprint(value)}`;
  }
  return value;
}

function redactValue(key, value, report) {
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(key, entry, report));
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, childKey) => {
        acc[childKey] = redactValue(childKey, value[childKey], report);
        return acc;
      }, {});
  }
  return redactScalar(key, value, report);
}

export function redactTraceEvents(events) {
  const report = {
    redacted_fields: 0,
    redacted_events: 0,
    unknown_sensitive_hits: 0,
    rules_triggered: new Set(),
  };
  const redacted = events.map((event) => {
    const nextEvent = redactValue("event", event, report);
    if (JSON.stringify(nextEvent) !== JSON.stringify(event)) {
      report.redacted_events += 1;
    }
    return nextEvent;
  });
  return {
    events: redacted,
    report: {
      redacted_fields: report.redacted_fields,
      redacted_events: report.redacted_events,
      unknown_sensitive_hits: report.unknown_sensitive_hits,
      rules_triggered: [...report.rules_triggered].sort((left, right) => left.localeCompare(right)),
    },
  };
}
