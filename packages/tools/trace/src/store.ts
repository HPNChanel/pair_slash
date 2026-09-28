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

import type { TraceEvent, TraceIndex } from "./types.ts";

function parseJsonLines(path: string): TraceEvent[] {
  if (!exists(path)) {
    return [];
  }
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TraceEvent);
}

function indexPathFor(traceRoot: string, sessionId: string) {
  return join(traceRoot, "indexes", `${sessionId}.json`);
}

function eventPathFor(traceRoot: string, sessionId: string, timestamp: string) {
  const [year, month, day] = timestamp.slice(0, 10).split("-");
  return join(traceRoot, "events", year, month, day, `${sessionId}.jsonl`);
}

function buildSessionIndex({ traceRoot, sessionId, events }: { traceRoot: string; sessionId: string; events: TraceEvent[] }) {
  const failures = events.filter((event) => ["blocked", "denied", "failed"].includes(event.outcome ?? ""));
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
    related_artifacts: [...new Set(events.flatMap((event) => event.artifact_paths ?? []))].sort((left: string, right: string) =>
      left.localeCompare(right),
    ),
  };
}

export function resolveTraceRoot(repoRoot: string) {
  return join(repoRoot, ".pairslash", "observability");
}

export function resolveTracePaths(repoRoot: string) {
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

export function resolveTelemetryMode(repoRoot: string) {
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

export function appendTraceEvent({ repoRoot, event }: { repoRoot: string; event: TraceEvent }) {
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

export function loadTraceEvents({ repoRoot, sessionId }: { repoRoot: string; sessionId: string }) {
  const traceRoot = resolveTraceRoot(repoRoot);
  const indexesRoot = join(traceRoot, "indexes");
  const indexPath = join(indexesRoot, `${sessionId}.json`);
  if (!exists(indexPath)) {
    return [];
  }
  const index = JSON.parse(readFileSync(indexPath, "utf8")) as TraceIndex;
  return parseJsonLines(index.event_file);
}

export function loadTraceIndex({ repoRoot, sessionId }: { repoRoot: string; sessionId: string }) {
  const traceRoot = resolveTraceRoot(repoRoot);
  const indexPath = indexPathFor(traceRoot, sessionId);
  if (!exists(indexPath)) {
    return null;
  }
  return JSON.parse(readFileSync(indexPath, "utf8")) as TraceIndex;
}

export function listTraceIndexes(repoRoot: string) {
  const traceRoot = resolveTraceRoot(repoRoot);
  const indexesRoot = join(traceRoot, "indexes");
  if (!exists(indexesRoot)) {
    return [];
  }
  return readdirSync(indexesRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => join(indexesRoot, entry.name))
    .sort((left: string, right: string) => left.localeCompare(right))
    .map((path) => JSON.parse(readFileSync(path, "utf8")) as TraceIndex);
}
