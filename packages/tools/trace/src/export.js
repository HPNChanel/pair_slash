import { statSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  TRACE_FAILURE_DOMAINS,
  TRACE_EXPORT_SCHEMA_VERSION,
  ensureDir,
  stableJson,
  validateSupportBundle,
  validateTraceExport,
  writeTextFile,
} from "@pairslash/spec-core";

import { redactTraceEvents } from "./redact.js";
import { createBundleId } from "./ids.js";
import { listTraceIndexes, loadTraceEvents, loadTraceIndex, resolveTracePaths } from "./store.js";

const TERMINAL_OUTCOMES = new Set(["blocked", "denied", "failed"]);
const TRACE_EXPORT_FILE_ORDER = ["events", "sessions", "redaction-report", "manifest"];
const SUPPORT_BUNDLE_FILE_ORDER = [
  "debug-report",
  "doctor-report",
  "context-explanation",
  "policy-explanation",
  "privacy-note",
  "issue-template",
  "reproducibility-template",
  "triage-template",
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
    if (report.redaction_state !== "shareable") {
      reasons.push(`redaction-state:${report.redaction_state ?? "unknown"}`);
    }
    if (report.unknown_sensitive_hits > 0) {
      reasons.push("unknown-sensitive-hits");
    }
  }
  return {
    safe_to_share: reasons.length === 0,
    reasons,
  };
}

function buildRuntimeDescriptor({ contextExplanation, debugReport }) {
  return {
    runtime: contextExplanation?.runtime ?? debugReport?.runtime ?? null,
    target: contextExplanation?.target ?? debugReport?.target ?? null,
    os: contextExplanation?.os ?? "unknown",
    shell: contextExplanation?.shell ?? "unknown",
    runtime_version: contextExplanation?.runtime_version ?? null,
  };
}

function buildPrivacyDescriptor(traceExport, shareSafety) {
  return {
    redaction_state: traceExport.redaction_report?.redaction_state ?? "review-required",
    consent_required: true,
    local_only_by_default: true,
    remote_collection_default: "off",
    safe_to_share: shareSafety.safe_to_share,
  };
}

function buildIssueTemplateText({ supportBundle, debugReport, contextExplanation }) {
  const runtime = contextExplanation?.runtime ?? debugReport?.runtime ?? "unknown";
  const target = contextExplanation?.target ?? debugReport?.target ?? "unknown";
  const pack = contextExplanation?.pack_id ?? "unknown";
  const lines = [
    `Title: [support] ${debugReport.command_name} | ${runtime} | ${debugReport.decisive_failure_domain}`,
    "",
    "Summary",
    "- Expected:",
    "- Actual:",
    "- First visible symptom:",
    "",
    "Environment",
    `- Runtime: ${runtime}`,
    `- Runtime version: ${contextExplanation?.runtime_version ?? "unknown"}`,
    `- Target: ${target}`,
    `- OS / shell: ${contextExplanation?.os ?? "unknown"} / ${contextExplanation?.shell ?? "unknown"}`,
    "- PairSlash version: 0.4.0",
    `- Workflow / pack: ${pack}`,
    `- Command: ${debugReport.command_name}`,
    `- Session ID: ${debugReport.session_id}`,
    `- Bundle ID: ${supportBundle.bundle_id}`,
    "",
    "Bundle status",
    `- safe_to_share: ${supportBundle.safe_to_share ? "yes" : "no"}`,
    `- redaction_state: ${supportBundle.privacy_descriptor.redaction_state}`,
    `- share_safety_reasons: ${(supportBundle.share_safety_reasons ?? []).join(", ") || "none"}`,
    `- Attached files: ${supportBundle.files.length > 0 ? supportBundle.files.map((file) => file.id).join(", ") : "see bundle-manifest.json"}`,
    "",
    "Consent",
    "- I reviewed the privacy note before attaching any support artifact: yes / no",
    "",
    "Repro notes",
    "- Happens again on rerun: yes / no / unknown",
    "- Live runtime or compat-lab:",
    "- Extra steps needed:",
  ];
  return `${lines.join("\n")}\n`;
}

function buildPrivacyNoteText(bundle) {
  const lines = [
    "Privacy note",
    "",
    "This export stays local unless you choose to share it.",
    "PairSlash removes known secrets, hashes config fingerprints, and marks unsafe bundles.",
    "It may still contain runtime versions, pack ids, failure summaries, normalized paths, and redaction metadata.",
    `Current redaction state: ${bundle.privacy_descriptor.redaction_state}.`,
    `Safe to share: ${bundle.safe_to_share ? "yes" : "no"}.`,
  ];
  if ((bundle.share_safety_reasons ?? []).length > 0) {
    lines.push(`Share safety reasons: ${bundle.share_safety_reasons.join(", ")}.`);
  }
  lines.push(
    "If safe_to_share is false or unknown_sensitive_hits is greater than zero, do not attach this bundle outside your machine.",
    "Continue only if you understand and accept this boundary.",
  );
  return `${lines.join("\n")}\n`;
}

function buildReproducibilityTemplateText(bundle) {
  const lines = [
    "Reproducibility Summary",
    "",
    `- Bundle ID: ${bundle.bundle_id}`,
    `- Session ID: ${bundle.trace_locator.session_id}`,
    "- Maintainer:",
    `- Runtime lane: ${bundle.runtime_descriptor.runtime ?? "unknown"} / ${bundle.runtime_descriptor.target ?? "unknown"}`,
    `- Workflow: ${bundle.trace_locator.command_name}`,
    `- Failure domain: ${bundle.trace_locator.decisive_failure_domain}`,
    "- Live repro: yes / no",
    "- Compat-lab repro: yes / no",
    "- Closest fixture:",
    "- Root cause:",
    "- Fix path:",
    "- Evidence refs:",
    "- Decision: fixed / docs-only / known issue / not reproducible",
  ];
  return `${lines.join("\n")}\n`;
}

function buildTriageTemplateText(bundle) {
  const lines = [
    "Maintainer Triage Note",
    "",
    "- Intake date:",
    "- Owner:",
    "- Severity:",
    `- Failure domain: ${bundle.trace_locator.decisive_failure_domain}`,
    `- Share safety: ${bundle.safe_to_share ? "safe" : "local-only"}`,
    "- Primary artifact reviewed:",
    "- Missing artifact:",
    "- Next action:",
    `- Target lane: ${bundle.runtime_descriptor.runtime ?? "unknown"} / ${bundle.runtime_descriptor.target ?? "unknown"}`,
    "- Repro path: live / compat-lab / both",
    "- Due date:",
  ];
  return `${lines.join("\n")}\n`;
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
      `pairslash trace export --session ${latest.session_id} --support-bundle`,
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
  const { events: redactedEvents, report } = redactTraceEvents(events, { repoRoot });
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
  debugReport = null,
  doctorReport = null,
  contextExplanation = null,
  policyExplanation = null,
  outDir = null,
} = {}) {
  const { bundlesRoot } = resolveTracePaths(repoRoot);
  const bundleId = createBundleId();
  const outputDir = outDir ? resolve(repoRoot, outDir) : join(bundlesRoot, `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}-${bundleId}`);
  ensureDir(outputDir);
  const effectiveDebugReport =
    debugReport ??
    buildDebugReport({
      repoRoot,
      sessionId: traceExport.selector?.session_id ?? null,
      selector: traceExport.selector ?? {},
    });
  const traceLocator = {
    session_id: effectiveDebugReport.session_id,
    workflow_id: effectiveDebugReport.workflow_id ?? null,
    command_name: effectiveDebugReport.command_name,
    decisive_failure_domain: effectiveDebugReport.decisive_failure_domain,
    decisive_reason: effectiveDebugReport.decisive_reason ?? null,
  };
  const shareSafety = assessSupportShareSafety(traceExport.redaction_report);
  const files = [];
  function writeArtifact(id, fileName, payload, { asText = false } = {}) {
    const path = join(outputDir, fileName);
    writeTextFile(path, asText ? payload : stableJson(payload));
    files.push({
      id,
      path,
      size_bytes: statSync(path).size,
    });
    return path;
  }
  const debugPath = writeArtifact("debug-report", "debug-report.json", effectiveDebugReport);
  const doctorPath = doctorReport ? writeArtifact("doctor-report", "doctor-report.json", doctorReport) : null;
  const contextPath = contextExplanation ? writeArtifact("context-explanation", "context-explanation.json", contextExplanation) : null;
  const policyPath = policyExplanation ? writeArtifact("policy-explanation", "policy-explanation.json", policyExplanation) : null;
  const runtimeDescriptor = buildRuntimeDescriptor({
    contextExplanation,
    debugReport: effectiveDebugReport,
  });
  const bundle = {
    kind: "support-bundle",
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    bundle_id: bundleId,
    output_dir: outputDir,
    safe_to_share: shareSafety.safe_to_share,
    trace_locator: traceLocator,
    runtime_descriptor: runtimeDescriptor,
    privacy_descriptor: buildPrivacyDescriptor(traceExport, shareSafety),
    share_safety_reasons: shareSafety.reasons,
    trace_export: {
      path: join(traceExport.output_dir, "manifest.json"),
      session_count: traceExport.session_count,
      event_count: traceExport.event_count,
    },
    debug_report_path: debugPath,
    doctor_report_path: doctorPath,
    context_explanation_path: contextPath,
    policy_explanation_path: policyPath,
    redaction_report: traceExport.redaction_report,
    files: [],
  };
  const privacyNotePath = writeArtifact("privacy-note", "privacy-note.txt", buildPrivacyNoteText(bundle), {
    asText: true,
  });
  const issueTemplatePath = writeArtifact(
    "issue-template",
    "issue-template.md",
    buildIssueTemplateText({
      supportBundle: bundle,
      debugReport: effectiveDebugReport,
      contextExplanation,
    }),
    { asText: true },
  );
  const reproducibilityTemplatePath = writeArtifact(
    "reproducibility-template",
    "reproducibility-summary.template.md",
    buildReproducibilityTemplateText(bundle),
    { asText: true },
  );
  const triageTemplatePath = writeArtifact(
    "triage-template",
    "maintainer-triage-note.template.md",
    buildTriageTemplateText(bundle),
    { asText: true },
  );
  const readmePath = writeArtifact(
    "readme",
    "README.txt",
    [
      "PairSlash support bundle",
      "",
      "This bundle is local-first and redacted by design.",
      "Read privacy-note.txt before sharing anything outside your machine.",
      "Use issue-template.md for intake and the maintainer templates after triage.",
    ].join("\n"),
    { asText: true },
  );
  bundle.issue_template_path = issueTemplatePath;
  bundle.privacy_note_path = privacyNotePath;
  bundle.reproducibility_template_path = reproducibilityTemplatePath;
  bundle.triage_template_path = triageTemplatePath;
  bundle.readme_path = readmePath;
  bundle.files = sortFilesByKnownOrder(files, SUPPORT_BUNDLE_FILE_ORDER);
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
