import { statSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  TRACE_FAILURE_DOMAINS,
  TRACE_EXPORT_SCHEMA_VERSION,
  ensureDir,
  stableJson,
  validateTraceExport,
  validateSupportBundle,
  writeTextFile,
} from "@pairslash/spec-core";

import { redactTraceEvents } from "./redact.js";
import { createBundleId } from "./ids.js";
import { listTraceIndexes, loadTraceEvents, loadTraceIndex, resolveTracePaths } from "./store.js";

const TERMINAL_OUTCOMES = new Set(["blocked", "denied", "failed"]);
const TRACE_EXPORT_FILE_ORDER = ["events", "sessions", "redaction-report", "manifest"];
const SUPPORT_BUNDLE_FILE_ORDER = [
  "doctor-report",
  "context-explanation",
  "policy-explanation",
  "readme",
  "bundle-manifest",
];

export function selectLatestSession(repoRoot, selector = {}) {
  const matches = listTraceIndexes(repoRoot)
    .filter((index) => (selector.exclude_session_id ? index.session_id !== selector.exclude_session_id : true))
    .filter((index) => (selector.runtime ? index.runtime === selector.runtime : true))
    .filter((index) => (selector.target ? index.target === selector.target : true))
    .sort((left, right) => (right.started_at ?? "").localeCompare(left.started_at ?? ""));
  return matches[0] ?? null;
}

function sortFilesByKnownOrder(files, knownOrder) {
  return files
    .slice()
    .sort((left, right) => {
      const leftIndex = knownOrder.indexOf(left.id);
      const rightIndex = knownOrder.indexOf(right.id);
      const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
      if (normalizedLeft !== normalizedRight) {
        return normalizedLeft - normalizedRight;
      }
      return left.id.localeCompare(right.id);
    });
}

function summarizeEvents(events) {
  const failureCounts = Object.fromEntries(TRACE_FAILURE_DOMAINS.map((domain) => [domain, 0]));
  for (const event of events) {
    if (!TERMINAL_OUTCOMES.has(event.outcome)) {
      continue;
    }
    failureCounts[event.failure_domain] = (failureCounts[event.failure_domain] ?? 0) + 1;
  }
  return {
    failure_counts: failureCounts,
  };
}

function assessSupportShareSafety(report) {
  const reasons = [];
  if (!report || typeof report !== "object") {
    reasons.push("redaction-report-missing");
  } else {
    if (report.unknown_sensitive_hits > 0) {
      reasons.push("unknown-sensitive-hits");
    }
  }
  return {
    safe_to_share: reasons.length === 0,
    reasons,
  };
}

export function buildDebugReport({ repoRoot, sessionId, selector = {} }) {
  const latest = sessionId ? loadTraceIndex({ repoRoot, sessionId }) : selectLatestSession(repoRoot, selector);
  if (!latest) {
    throw new Error("trace-not-found: no matching trace session");
  }
  const events = loadTraceEvents({ repoRoot, sessionId: latest.session_id });
  const decisive = events.find((event) => ["blocked", "denied", "failed"].includes(event.outcome)) ?? events.at(-1);
  return {
    kind: "debug-report",
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    selector: {
      ...selector,
      session_id: latest.session_id,
    },
    session_id: latest.session_id,
    workflow_id: decisive?.workflow_id ?? null,
    correlation_id: decisive?.correlation_id ?? null,
    runtime: latest.runtime,
    target: latest.target,
    command_name: latest.command_name,
    outcome: latest.last_outcome ?? "finished",
    decisive_failure_domain: decisive?.failure_domain ?? "none",
    decisive_reason: decisive?.summary ?? "No decisive failure recorded.",
    timeline: events.map((event) => ({
      timestamp: event.timestamp,
      event_type: event.event_type,
      severity: event.severity,
      failure_domain: event.failure_domain,
      outcome: event.outcome,
      summary: event.summary ?? `${event.event_type} ${event.outcome}`,
    })),
    related_artifacts: latest.related_artifacts ?? [],
    repro_steps: [
      `pairslash debug --session ${latest.session_id}`,
      `pairslash trace export --session ${latest.session_id}`,
    ],
  };
}

export function exportTrace({
  repoRoot,
  selector = {},
  sessionId = null,
  outDir = null,
} = {}) {
  const latest = sessionId ? loadTraceIndex({ repoRoot, sessionId }) : selectLatestSession(repoRoot, selector);
  if (!latest) {
    throw new Error("trace-not-found: no matching trace session");
  }
  const events = loadTraceEvents({ repoRoot, sessionId: latest.session_id });
  const { events: redactedEvents, report } = redactTraceEvents(events);
  const { exportsRoot } = resolveTracePaths(repoRoot);
  const exportRoot = outDir ? resolve(repoRoot, outDir) : join(exportsRoot, `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}-${latest.session_id}`);
  ensureDir(exportRoot);
  const eventsPath = join(exportRoot, "events.jsonl");
  const sessionsPath = join(exportRoot, "sessions.json");
  const redactionPath = join(exportRoot, "redaction-report.json");
  writeTextFile(eventsPath, `${redactedEvents.map((event) => JSON.stringify(event)).join("\n")}\n`);
  writeTextFile(sessionsPath, stableJson([latest]));
  writeTextFile(redactionPath, stableJson(report));
  const manifest = {
    kind: "trace-export",
    schema_version: TRACE_EXPORT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    selector: {
      ...selector,
      session_id: latest.session_id,
    },
    output_dir: exportRoot,
    session_count: 1,
    event_count: redactedEvents.length,
    redaction_report: report,
    summary: summarizeEvents(redactedEvents),
    files: [
      { id: "events", path: eventsPath, size_bytes: statSync(eventsPath).size },
      { id: "sessions", path: sessionsPath, size_bytes: statSync(sessionsPath).size },
      { id: "redaction-report", path: redactionPath, size_bytes: statSync(redactionPath).size },
    ],
  };
  const validationErrors = validateTraceExport(manifest);
  if (validationErrors.length > 0) {
    throw new Error(`invalid trace export :: ${validationErrors.join("; ")}`);
  }
  const manifestPath = join(exportRoot, "manifest.json");
  writeTextFile(manifestPath, stableJson(manifest));
  manifest.files.push({
    id: "manifest",
    path: manifestPath,
    size_bytes: statSync(manifestPath).size,
  });
  manifest.files = sortFilesByKnownOrder(manifest.files, TRACE_EXPORT_FILE_ORDER);
  writeTextFile(manifestPath, stableJson(manifest));
  return manifest;
}

export function createSupportBundle({
  repoRoot,
  traceExport,
  doctorReport = null,
  contextExplanation = null,
  policyExplanation = null,
  outDir = null,
} = {}) {
  const { bundlesRoot } = resolveTracePaths(repoRoot);
  const bundleId = createBundleId();
  const outputDir = outDir ? resolve(repoRoot, outDir) : join(bundlesRoot, `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}-${bundleId}`);
  ensureDir(outputDir);
  const files = [];
  function writeArtifact(id, fileName, payload) {
    const path = join(outputDir, fileName);
    writeTextFile(path, stableJson(payload));
    files.push({
      id,
      path,
      size_bytes: statSync(path).size,
    });
    return path;
  }
  const doctorPath = doctorReport ? writeArtifact("doctor-report", "doctor-report.json", doctorReport) : null;
  const contextPath = contextExplanation ? writeArtifact("context-explanation", "context-explanation.json", contextExplanation) : null;
  const policyPath = policyExplanation ? writeArtifact("policy-explanation", "policy-explanation.json", policyExplanation) : null;
  const readmePath = join(outputDir, "README.txt");
  writeTextFile(
    readmePath,
    [
      "PairSlash support bundle",
      "",
      "This bundle is redacted by design.",
      "Review the redaction-report and manifest before sharing outside the repo.",
    ].join("\n"),
  );
  files.push({
    id: "readme",
    path: readmePath,
    size_bytes: statSync(readmePath).size,
  });
  const shareSafety = assessSupportShareSafety(traceExport.redaction_report);
  const bundle = {
    kind: "support-bundle",
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    bundle_id: bundleId,
    output_dir: outputDir,
    safe_to_share: shareSafety.safe_to_share,
    share_safety_reasons: shareSafety.reasons,
    trace_export: {
      path: join(traceExport.output_dir, "manifest.json"),
      session_count: traceExport.session_count,
      event_count: traceExport.event_count,
    },
    doctor_report_path: doctorPath,
    context_explanation_path: contextPath,
    policy_explanation_path: policyPath,
    readme_path: readmePath,
    redaction_report: traceExport.redaction_report,
    files: sortFilesByKnownOrder(files, SUPPORT_BUNDLE_FILE_ORDER),
  };
  const validationErrors = validateSupportBundle(bundle);
  if (validationErrors.length > 0) {
    throw new Error(`invalid support bundle :: ${validationErrors.join("; ")}`);
  }
  const manifestPath = join(outputDir, "bundle-manifest.json");
  writeTextFile(manifestPath, stableJson(bundle));
  bundle.files.push({
    id: "bundle-manifest",
    path: manifestPath,
    size_bytes: statSync(manifestPath).size,
  });
  bundle.files = sortFilesByKnownOrder(bundle.files, SUPPORT_BUNDLE_FILE_ORDER);
  writeTextFile(manifestPath, stableJson(bundle));
  return bundle;
}
