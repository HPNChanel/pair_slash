import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import {
  TELEMETRY_MODES,
  ensureDir,
  exists,
  stableJson,
  toPosix,
  validateTraceEvent,
  writeTextFile,
} from "@pairslash/spec-core";

function parseJsonLines(path) {
  if (!exists(path)) {
    return [];
  }
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function indexPathFor(traceRoot, sessionId) {
  return join(traceRoot, "indexes", `${sessionId}.json`);
}

function eventPathFor(traceRoot, sessionId, timestamp) {
  const [year, month, day] = timestamp.slice(0, 10).split("-");
  return join(traceRoot, "events", year, month, day, `${sessionId}.jsonl`);
}

function buildSessionIndex({ traceRoot, sessionId, events }) {
  const failures = events.filter((event) => ["blocked", "denied", "failed"].includes(event.outcome));
  const first = events[0] ?? null;
  const last = events.at(-1) ?? null;
  return {
    session_id: sessionId,
    event_count: events.length,
    runtime: last?.runtime ?? first?.runtime ?? null,
    target: last?.target ?? first?.target ?? null,
    command_name: first?.command_name ?? last?.command_name ?? "unknown",
    started_at: first?.timestamp ?? null,
    finished_at: last?.timestamp ?? null,
    last_outcome: last?.outcome ?? null,
    decisive_failure_domain: failures[0]?.failure_domain ?? "none",
    decisive_reason: failures[0]?.summary ?? failures[0]?.error_code ?? null,
    event_file: toPosix(resolve(eventPathFor(traceRoot, sessionId, first?.timestamp ?? new Date().toISOString()))),
    related_artifacts: [...new Set(events.flatMap((event) => event.artifact_paths ?? []))].sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

export function resolveTraceRoot(repoRoot) {
  return join(repoRoot, ".pairslash", "observability");
}

export function resolveTracePaths(repoRoot) {
  const traceRoot = resolveTraceRoot(repoRoot);
  return {
    traceRoot,
    indexesRoot: join(traceRoot, "indexes"),
    exportsRoot: join(traceRoot, "exports"),
    bundlesRoot: join(traceRoot, "bundles"),
    configRoot: join(traceRoot, "config"),
    stateRoot: join(traceRoot, "state"),
  };
}

export function resolveTelemetryMode(repoRoot) {
  const { configRoot } = resolveTracePaths(repoRoot);
  const configPath = join(configRoot, "telemetry.json");
  if (!exists(configPath)) {
    return "off";
  }
  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8"));
    return TELEMETRY_MODES.includes(parsed?.mode) ? parsed.mode : "off";
  } catch {
    return "off";
  }
}

export function appendTraceEvent({ repoRoot, event }) {
  const validationErrors = validateTraceEvent(event);
  if (validationErrors.length > 0) {
    throw new Error(`invalid trace event :: ${validationErrors.join("; ")}`);
  }
  const traceRoot = resolveTraceRoot(repoRoot);
  const eventPath = eventPathFor(traceRoot, event.session_id, event.timestamp);
  ensureDir(dirname(eventPath));
  const existing = exists(eventPath) ? readFileSync(eventPath, "utf8") : "";
  writeTextFile(eventPath, `${existing}${JSON.stringify(event)}\n`);
  const events = parseJsonLines(eventPath);
  const index = buildSessionIndex({
    traceRoot,
    sessionId: event.session_id,
    events,
  });
  writeTextFile(indexPathFor(traceRoot, event.session_id), stableJson(index));
  return {
    eventPath,
    indexPath: indexPathFor(traceRoot, event.session_id),
    event,
  };
}

export function loadTraceEvents({ repoRoot, sessionId }) {
  const traceRoot = resolveTraceRoot(repoRoot);
  const indexesRoot = join(traceRoot, "indexes");
  const indexPath = join(indexesRoot, `${sessionId}.json`);
  if (!exists(indexPath)) {
    return [];
  }
  const index = JSON.parse(readFileSync(indexPath, "utf8"));
  return parseJsonLines(index.event_file);
}

export function loadTraceIndex({ repoRoot, sessionId }) {
  const traceRoot = resolveTraceRoot(repoRoot);
  const indexPath = indexPathFor(traceRoot, sessionId);
  if (!exists(indexPath)) {
    return null;
  }
  return JSON.parse(readFileSync(indexPath, "utf8"));
}

export function listTraceIndexes(repoRoot) {
  const traceRoot = resolveTraceRoot(repoRoot);
  const indexesRoot = join(traceRoot, "indexes");
  if (!exists(indexesRoot)) {
    return [];
  }
  return readdirSync(indexesRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => join(indexesRoot, entry.name))
    .sort((left, right) => left.localeCompare(right))
    .map((path) => JSON.parse(readFileSync(path, "utf8")));
}
