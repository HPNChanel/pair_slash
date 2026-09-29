import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import YAML from "yaml";
import { stableJson } from "@pairslash/spec-core";

export const RETRIEVAL_INDEX_KIND = "pairslash.retrieval-index/v1";
export const RETRIEVAL_INDEX_FILENAME = "retrieval-index.json";
export const DEFAULT_INDEX_DIR = join(
  ".pairslash",
  "observability",
  "indexes",
  "retrieval",
);

export interface RetrievalIndexSource {
  id: string;
  kind: string;
  path: string;
}

export interface IndexedRecordMeta {
  id: string | null;
  kind: string | null;
  title: string | null;
  scope: string | null;
  tags: string[];
  updated_at: string | null;
}

export interface IndexedFile {
  path: string;
  sha256: string;
  size_bytes: number;
  record: IndexedRecordMeta | null;
}

export interface IndexedSource {
  id: string;
  kind: string;
  path: string;
  files: IndexedFile[];
}

export interface RetrievalIndex {
  kind: typeof RETRIEVAL_INDEX_KIND;
  sources: IndexedSource[];
  totals: {
    source_count: number;
    file_count: number;
  };
}

export interface IndexWriteResult {
  index_path: string;
  file_count: number;
  sha256: string;
}

export type IndexStalenessState = "fresh" | "stale" | "missing";

export interface IndexStalenessReport {
  state: IndexStalenessState;
  reasons: string[];
  stale_files: string[];
  missing_files: string[];
  unexpected_files: string[];
}

export const DEFAULT_MEMORY_SOURCES: Readonly<RetrievalIndexSource[]> = Object.freeze([
  Object.freeze({ id: "project-memory", kind: "repo_local", path: ".pairslash/project-memory" }),
  Object.freeze({ id: "task-memory", kind: "repo_local", path: ".pairslash/task-memory" }),
  Object.freeze({ id: "sessions", kind: "artifact_local", path: ".pairslash/sessions" }),
  Object.freeze({ id: "staging", kind: "artifact_local", path: ".pairslash/staging" }),
]);

function sha256(contents: string): string {
  return createHash("sha256").update(contents, "utf8").digest("hex");
}

function toPosix(pathValue: string): string {
  return pathValue.split(sep).join("/");
}

function assertInsideRepo(repoRoot: string, absolutePath: string): string {
  const root = resolve(repoRoot);
  const resolved = resolve(absolutePath);
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    throw new Error(`path escapes repository root: ${absolutePath}`);
  }
  return resolved;
}

function listFilesRecursive(rootDir: string): string[] {
  const out: string[] = [];
  if (!existsSync(rootDir)) {
    return out;
  }
  const stat = statSync(rootDir);
  if (!stat.isDirectory()) {
    return out;
  }
  const entries = readdirSync(rootDir, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const childPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(childPath));
      continue;
    }
    if (entry.isFile()) {
      out.push(childPath);
    }
  }
  return out;
}

function extractRecordMeta(filePath: string, contents: string): IndexedRecordMeta | null {
  if (!/\.(ya?ml)$/i.test(filePath)) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = YAML.parse(contents);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === "string").sort()
    : [];
  const asStringOrNull = (value: unknown): string | null =>
    typeof value === "string" && value.trim() !== "" ? value : null;
  return {
    id:
      asStringOrNull(record.id) ??
      asStringOrNull(record.record_id) ??
      asStringOrNull(record.key),
    kind: asStringOrNull(record.kind),
    title: asStringOrNull(record.title),
    scope: asStringOrNull(record.scope),
    tags,
    updated_at:
      asStringOrNull(record.updated_at) ??
      asStringOrNull(record.timestamp) ??
      asStringOrNull(record.recorded_at),
  };
}

export function resolveIndexDir(repoRoot: string, indexDir?: string): string {
  const dir = indexDir ?? join(repoRoot, DEFAULT_INDEX_DIR);
  return assertInsideRepo(repoRoot, dir);
}

export function resolveIndexPath(repoRoot: string, indexDir?: string): string {
  return join(resolveIndexDir(repoRoot, indexDir), RETRIEVAL_INDEX_FILENAME);
}

export function buildRetrievalIndex({
  repoRoot,
  sources = [...DEFAULT_MEMORY_SOURCES],
}: {
  repoRoot: string;
  sources?: RetrievalIndexSource[];
}): RetrievalIndex {
  const indexedSources: IndexedSource[] = [];
  const sortedSources = [...sources].sort((left, right) => left.id.localeCompare(right.id));
  for (const source of sortedSources) {
    const sourceRoot = assertInsideRepo(repoRoot, join(repoRoot, source.path));
    const files: IndexedFile[] = [];
    for (const filePath of listFilesRecursive(sourceRoot)) {
      const contents = readFileSync(filePath, "utf8");
      const stats = statSync(filePath);
      files.push({
        path: toPosix(relative(repoRoot, filePath)),
        sha256: sha256(contents),
        size_bytes: stats.size,
        record: extractRecordMeta(filePath, contents),
      });
    }
    indexedSources.push({
      id: source.id,
      kind: source.kind,
      path: toPosix(source.path),
      files,
    });
  }
  const fileCount = indexedSources.reduce((total, source) => total + source.files.length, 0);
  return {
    kind: RETRIEVAL_INDEX_KIND,
    sources: indexedSources,
    totals: {
      source_count: indexedSources.length,
      file_count: fileCount,
    },
  };
}

export function serializeRetrievalIndex(index: RetrievalIndex): string {
  return stableJson(index) + "\n";
}

export function writeRetrievalIndex({
  repoRoot,
  indexDir,
  sources,
}: {
  repoRoot: string;
  indexDir?: string;
  sources?: RetrievalIndexSource[];
}): IndexWriteResult {
  const dir = resolveIndexDir(repoRoot, indexDir);
  const index = buildRetrievalIndex({ repoRoot, sources });
  const payload = serializeRetrievalIndex(index);
  mkdirSync(dir, { recursive: true });
  const targetPath = join(dir, RETRIEVAL_INDEX_FILENAME);
  const tmpPath = join(dir, `${RETRIEVAL_INDEX_FILENAME}.tmp`);
  writeFileSync(tmpPath, payload, "utf8");
  renameSync(tmpPath, targetPath);
  return {
    index_path: toPosix(relative(repoRoot, targetPath)),
    file_count: index.totals.file_count,
    sha256: sha256(payload),
  };
}

export function loadRetrievalIndex({
  repoRoot,
  indexDir,
}: {
  repoRoot: string;
  indexDir?: string;
}): RetrievalIndex | null {
  const indexPath = resolveIndexPath(repoRoot, indexDir);
  if (!existsSync(indexPath)) {
    return null;
  }
  const parsed: unknown = JSON.parse(readFileSync(indexPath, "utf8"));
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    (parsed as { kind?: unknown }).kind !== RETRIEVAL_INDEX_KIND
  ) {
    return null;
  }
  return parsed as RetrievalIndex;
}

export function assessIndexStaleness({
  repoRoot,
  indexDir,
  sources,
}: {
  repoRoot: string;
  indexDir?: string;
  sources?: RetrievalIndexSource[];
}): IndexStalenessReport {
  const index = loadRetrievalIndex({ repoRoot, indexDir });
  if (index === null) {
    return {
      state: "missing",
      reasons: ["index file absent or unreadable"],
      stale_files: [],
      missing_files: [],
      unexpected_files: [],
    };
  }
  const current = buildRetrievalIndex({ repoRoot, sources });
  const indexedPaths = new Map<string, IndexedFile>();
  for (const source of index.sources) {
    for (const file of source.files) {
      indexedPaths.set(file.path, file);
    }
  }
  const staleFiles: string[] = [];
  const unexpectedFiles: string[] = [];
  for (const source of current.sources) {
    for (const file of source.files) {
      const indexed = indexedPaths.get(file.path);
      if (indexed === undefined) {
        unexpectedFiles.push(file.path);
        continue;
      }
      if (indexed.sha256 !== file.sha256) {
        staleFiles.push(file.path);
      }
      indexedPaths.delete(file.path);
    }
  }
  const missingFiles = [...indexedPaths.keys()].sort();
  const reasons: string[] = [];
  if (staleFiles.length > 0) {
    reasons.push(`content changed: ${staleFiles.join(", ")}`);
  }
  if (unexpectedFiles.length > 0) {
    reasons.push(`new files not indexed: ${unexpectedFiles.join(", ")}`);
  }
  if (missingFiles.length > 0) {
    reasons.push(`indexed files removed: ${missingFiles.join(", ")}`);
  }
  return {
    state: reasons.length > 0 ? "stale" : "fresh",
    reasons,
    stale_files: staleFiles,
    missing_files: missingFiles,
    unexpected_files: unexpectedFiles,
  };
}
