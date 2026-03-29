import { readFileSync, unlinkSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

import {
  ensureDir,
  exists,
  stableJson,
  writeTextFile,
} from "@pairslash/spec-core";

import { listTraceIndexes, resolveTracePaths } from "./store.js";

const DEFAULT_RETENTION_POLICY = Object.freeze({
  max_days: 14,
  max_sessions: 100,
  preserve_exports: true,
  preserve_bundles: true,
});

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePolicy(raw) {
  if (!isObject(raw)) {
    return { ...DEFAULT_RETENTION_POLICY };
  }
  return {
    max_days: Number.isInteger(raw.max_days) && raw.max_days > 0 ? raw.max_days : DEFAULT_RETENTION_POLICY.max_days,
    max_sessions:
      Number.isInteger(raw.max_sessions) && raw.max_sessions >= 0
        ? raw.max_sessions
        : DEFAULT_RETENTION_POLICY.max_sessions,
    preserve_exports:
      typeof raw.preserve_exports === "boolean"
        ? raw.preserve_exports
        : DEFAULT_RETENTION_POLICY.preserve_exports,
    preserve_bundles:
      typeof raw.preserve_bundles === "boolean"
        ? raw.preserve_bundles
        : DEFAULT_RETENTION_POLICY.preserve_bundles,
  };
}

function parseJsonFile(path) {
  if (!exists(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function isPathWithinRoot(path, root) {
  const resolvedRoot = resolve(root);
  const resolvedPath = resolve(path);
  return resolvedPath === resolvedRoot || resolvedPath.startsWith(`${resolvedRoot}${sep}`);
}

function safeDeleteFile(path, root) {
  if (!path || !isPathWithinRoot(path, root) || !exists(path)) {
    return false;
  }
  unlinkSync(path);
  return true;
}

function retentionStatePath(repoRoot) {
  const { stateRoot } = resolveTracePaths(repoRoot);
  return join(stateRoot, "retention.json");
}

function retentionConfigPath(repoRoot) {
  const { configRoot } = resolveTracePaths(repoRoot);
  return join(configRoot, "retention.json");
}

export function resolveRetentionPolicy(repoRoot) {
  return normalizePolicy(parseJsonFile(retentionConfigPath(repoRoot)));
}

export function loadRetentionState(repoRoot) {
  return parseJsonFile(retentionStatePath(repoRoot));
}

function writeRetentionState(repoRoot, summary) {
  const statePath = retentionStatePath(repoRoot);
  ensureDir(dirname(statePath));
  writeTextFile(statePath, stableJson(summary));
}

export function pruneTraceStore({
  repoRoot,
  policy = null,
  now = new Date(),
  skipSessionIds = [],
} = {}) {
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
