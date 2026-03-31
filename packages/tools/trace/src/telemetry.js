import { dirname, join, resolve } from "node:path";

import {
  TELEMETRY_SUMMARY_SCHEMA_VERSION,
  ensureDir,
  stableJson,
  validateTelemetrySummary,
  writeTextFile,
} from "@pairslash/spec-core";

import { loadTraceEvents, listTraceIndexes, resolveTelemetryMode, resolveTracePaths } from "./store.js";

const SUCCESS_OUTCOMES = new Set(["ok", "pass", "allow", "finished", "exported"]);
const TTFS_OUTCOMES = new Set(["ok", "pass", "allow", "exported", "finished"]);

function toSelector(runtime, target) {
  return {
    runtime: runtime ?? null,
    target: target ?? null,
  };
}

function median(values) {
  if (values.length === 0) {
    return null;
  }
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(3))
    : Number(sorted[middle].toFixed(3));
}

function deriveWorkflowKey(index, events) {
  const explicitPack = events.find((event) => typeof event.pack_id === "string" && event.pack_id.trim() !== "");
  return explicitPack?.pack_id ?? index.command_name ?? "unknown";
}

function deriveTtfsSeconds(index, events) {
  const startedAt = Date.parse(index.started_at ?? "");
  if (!Number.isFinite(startedAt)) {
    return null;
  }
  const successEvent = events.find(
    (event) =>
      TTFS_OUTCOMES.has(event.outcome) &&
      event.event_type !== "session.started" &&
      event.event_type !== "workflow.started" &&
      event.event_type !== "command.started",
  );
  if (!successEvent) {
    return null;
  }
  const successAt = Date.parse(successEvent.timestamp ?? "");
  if (!Number.isFinite(successAt) || successAt < startedAt) {
    return null;
  }
  return Number(((successAt - startedAt) / 1000).toFixed(3));
}

function buildWorkflowEntry({ workflowKey, runtime, target, sessions }) {
  const successfulSessions = sessions.filter((session) => SUCCESS_OUTCOMES.has(session.index.last_outcome)).length;
  const failedSessions = sessions.length - successfulSessions;
  const weeklyReuseDays = new Set(
    sessions
      .map((session) => String(session.index.started_at ?? "").slice(0, 10))
      .filter(Boolean),
  ).size;
  const supportBundleExports = sessions.reduce(
    (total, session) => total + session.events.filter((event) => event.event_type === "support.bundle_created").length,
    0,
  );
  const ttfsSamples = sessions
    .map((session) => deriveTtfsSeconds(session.index, session.events))
    .filter((value) => typeof value === "number");
  return {
    workflow_key: workflowKey,
    runtime,
    target,
    sessions: sessions.length,
    successful_sessions: successfulSessions,
    failed_sessions: failedSessions,
    weekly_reuse_days: weeklyReuseDays,
    support_bundle_exports: supportBundleExports,
    median_ttfs_seconds: median(ttfsSamples),
  };
}

export function buildTelemetrySummary({ repoRoot, runtime = null, target = null } = {}) {
  const selector = toSelector(runtime, target);
  const indexes = listTraceIndexes(repoRoot)
    .filter((entry) => (selector.runtime ? entry.runtime === selector.runtime : true))
    .filter((entry) => (selector.target ? entry.target === selector.target : true))
    .sort((left, right) => (left.started_at ?? "").localeCompare(right.started_at ?? ""));
  const sessions = indexes.map((index) => ({
    index,
    events: loadTraceEvents({ repoRoot, sessionId: index.session_id }),
  }));
  const grouped = new Map();
  for (const session of sessions) {
    const workflowKey = deriveWorkflowKey(session.index, session.events);
    const groupingKey = `${workflowKey}\u0000${session.index.runtime}\u0000${session.index.target}`;
    const existing = grouped.get(groupingKey) ?? {
      workflowKey,
      runtime: session.index.runtime,
      target: session.index.target,
      sessions: [],
    };
    existing.sessions.push(session);
    grouped.set(groupingKey, existing);
  }
  const workflows = [...grouped.values()]
    .map((entry) =>
      buildWorkflowEntry({
        workflowKey: entry.workflowKey,
        runtime: entry.runtime,
        target: entry.target,
        sessions: entry.sessions,
      }),
    )
    .sort((left, right) =>
      `${left.workflow_key}\u0000${left.runtime}\u0000${left.target}`.localeCompare(
        `${right.workflow_key}\u0000${right.runtime}\u0000${right.target}`,
      ),
    );
  const successfulSessions = sessions.filter((session) => SUCCESS_OUTCOMES.has(session.index.last_outcome)).length;
  const ttfsSamples = sessions
    .map((session) => deriveTtfsSeconds(session.index, session.events))
    .filter((value) => typeof value === "number");
  const summary = {
    kind: "telemetry-summary",
    schema_version: TELEMETRY_SUMMARY_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    mode: resolveTelemetryMode(repoRoot),
    selector,
    privacy: {
      local_only: true,
      export_requires_explicit_action: true,
      source: "derived-from-local-traces",
    },
    totals: {
      sessions: sessions.length,
      successful_sessions: successfulSessions,
      failed_sessions: sessions.length - successfulSessions,
      support_bundle_exports: sessions.reduce(
        (total, session) => total + session.events.filter((event) => event.event_type === "support.bundle_created").length,
        0,
      ),
    },
    metrics: {
      workflow_runs_started: sessions.length,
      workflow_runs_succeeded: successfulSessions,
      weekly_reuse_days: new Set(indexes.map((index) => String(index.started_at ?? "").slice(0, 10)).filter(Boolean)).size,
      median_ttfs_seconds: median(ttfsSamples),
    },
    workflows,
    output_path: null,
  };
  const validationErrors = validateTelemetrySummary(summary);
  if (validationErrors.length > 0) {
    throw new Error(`invalid telemetry summary :: ${validationErrors.join("; ")}`);
  }
  return summary;
}

export function exportTelemetrySummary({
  repoRoot,
  runtime = null,
  target = null,
  outPath = null,
} = {}) {
  const summary = buildTelemetrySummary({ repoRoot, runtime, target });
  const { exportsRoot } = resolveTracePaths(repoRoot);
  const outputPath = outPath
    ? resolve(repoRoot, outPath)
    : join(exportsRoot, `telemetry-summary-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`);
  ensureDir(dirname(outputPath));
  const exported = {
    ...summary,
    output_path: outputPath,
  };
  const validationErrors = validateTelemetrySummary(exported);
  if (validationErrors.length > 0) {
    throw new Error(`invalid telemetry summary export :: ${validationErrors.join("; ")}`);
  }
  writeTextFile(outputPath, stableJson(exported));
  return exported;
}
