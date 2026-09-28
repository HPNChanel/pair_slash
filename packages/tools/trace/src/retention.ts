import { readFileSync, unlinkSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

import {
  ensureDir,
  exists,
  stableJson,
  writeTextFile,
} from "@pairslash/spec-core";

import { listTraceIndexes, resolveTracePaths } from "./store.ts";

type RetentionPolicy = {
  max_days: number;
  max_sessions: number;
  preserve_exports: boolean;
  preserve_bundles: boolean;
};

const DEFAULT_RETENTION_POLICY: RetentionPolicy = Object.freeze({
  max_days: 14,
  max_sessions: 100,
  preserve_exports: true,
  preserve_bundles: true,
});

function isObject(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePolicy(raw: unknown): RetentionPolicy {
  if (!isObject(raw)) {
    return { ...DEFAULT_RETENTION_POLICY };
  }
  const candidate = raw as Record<string, unknown>;
  const maxDays = candidate.max_days;
  const maxSessions = candidate.max_sessions;
  return {
    max_days:
      typeof maxDays === "number" && Number.isInteger(maxDays) && maxDays > 0
        ? maxDays
        : DEFAULT_RETENTION_POLICY.max_days,
    max_sessions:
      typeof maxSessions === "number" && Number.isInteger(maxSessions) && maxSessions >= 0
        ? maxSessions
        : DEFAULT_RETENTION_POLICY.max_sessions,
    preserve_exports:
      typeof candidate.preserve_exports === "boolean"
        ? candidate.preserve_exports
        : DEFAULT_RETENTION_POLICY.preserve_exports,
    preserve_bundles:
      typeof candidate.preserve_bundles === "boolean"
        ? candidate.preserve_bundles
        : DEFAULT_RETENTION_POLICY.preserve_bundles,
  };
}

function parseJsonFile(path: string) {
  if (!exists(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function isPathWithinRoot(path: string, root: string) {
  const resolvedRoot = resolve(root);
  const resolvedPath = resolve(path);
  return resolvedPath === resolvedRoot || resolvedPath.startsWith(`${resolvedRoot}${sep}`);
}

function safeDeleteFile(path: string | null | undefined, root: string) {
  if (!path || !isPathWithinRoot(path, root) || !exists(path)) {
    return false;
  }
  unlinkSync(path);
  return true;
}

function retentionStatePath(repoRoot: string) {
  const { stateRoot } = resolveTracePaths(repoRoot);
  return join(stateRoot, "retention.json");
}

function retentionConfigPath(repoRoot: string) {
  const { configRoot } = resolveTracePaths(repoRoot);
  return join(configRoot, "retention.json");
}

export function resolveRetentionPolicy(repoRoot: string) {
  return normalizePolicy(parseJsonFile(retentionConfigPath(repoRoot)));
}

export function loadRetentionState(repoRoot: string) {
  return parseJsonFile(retentionStatePath(repoRoot));
}

function writeRetentionState(repoRoot: string, summary: unknown) {
  const statePath = retentionStatePath(repoRoot);
  ensureDir(dirname(statePath));
  writeTextFile(statePath, stableJson(summary));
}

export function pruneTraceStore({
  repoRoot,
  policy = null,
  now = new Date(),
  skipSessionIds = [],
}: any = {}) {
  const resolvedPolicy = normalizePolicy(policy ?? resolveRetentionPolicy(repoRoot));
  const { traceRoot } = resolveTracePaths(repoRoot);
  const indexes = listTraceIndexes(repoRoot).sort((left, right) => (right.started_at ?? "").localeCompare(left.started_at ?? ""));
  const cutoffMs = now.getTime() - (resolvedPolicy.max_days * 24 * 60 * 60 * 1000);
  const skip = new Set(skipSessionIds.filter(Boolean));
  const keepByCount = new Set(
    indexes
      .filter((index) => !skip.has(index.session_id))
      .slice(0, resolvedPolicy.max_sessions)
      .map((index) => index.session_id),
  );
  const prunedSessionIds = [];
  let prunedIndexFiles = 0;
  let prunedEventFiles = 0;

  for (const index of indexes) {
    if (skip.has(index.session_id)) {
      continue;
    }
    const startedAtMs = Date.parse(index.started_at ?? "");
    const isWithinAge =
      Number.isFinite(startedAtMs) &&
      startedAtMs >= cutoffMs;
    const shouldKeep = keepByCount.has(index.session_id) || isWithinAge;
    if (shouldKeep) {
      continue;
    }
    const indexPath = join(traceRoot, "indexes", `${index.session_id}.json`);
    const indexDeleted = safeDeleteFile(indexPath, traceRoot);
    const eventDeleted = safeDeleteFile(index.event_file, traceRoot);
    if (indexDeleted || eventDeleted) {
      prunedSessionIds.push(index.session_id);
    }
    if (indexDeleted) {
      prunedIndexFiles += 1;
    }
    if (eventDeleted) {
      prunedEventFiles += 1;
    }
  }

  const summary = {
    kind: "trace-retention-state",
    schema_version: "1.0.0",
    last_pruned_at: now.toISOString(),
    policy: resolvedPolicy,
    total_sessions_before: indexes.length,
    retained_sessions: Math.max(0, indexes.length - prunedSessionIds.length),
    pruned_sessions: prunedSessionIds.length,
    pruned_index_files: prunedIndexFiles,
    pruned_event_files: prunedEventFiles,
    pruned_session_ids: prunedSessionIds,
  };
  writeRetentionState(repoRoot, summary);
  return summary;
}
