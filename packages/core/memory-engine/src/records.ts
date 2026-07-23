import { readFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

import YAML from "yaml";

import {
  ensureDir,
  exists,
  stableYaml,
  walkFiles,
  writeTextFile,
} from "@pairslash/spec-core";

import {
  DIRECTORY_FILES,
  ROOT_FILES,
  SYSTEM_RECORD_FILES,
  buildRecordId,
  slugify,
  stableHash,
  titlesMatch,
} from "./internal.ts";

export function loadRequestFile(path) {
  const content = readFileSync(path, "utf8");
  return extname(path).toLowerCase() === ".json" ? JSON.parse(content) : YAML.parse(content);
}

export function parseAllYamlDocuments(path) {
  if (!exists(path)) {
    return [];
  }
  return YAML.parseAllDocuments(readFileSync(path, "utf8"))
    .map((document) => document.toJSON())
    .filter(Boolean);
}

export function listYamlFiles(rootDir) {
  if (!exists(rootDir)) {
    return [];
  }
  return walkFiles(rootDir).filter((filePath) => /\.(yaml|yml)$/i.test(filePath));
}

export function buildEntry({ record, file, layer, artifactPath = null }) {
  return { record, file, layer, artifact_path: artifactPath };
}

export function readDirectoryRecords(rootDir, layer, { includeSystemFiles = true }: any = {}) {
  return listYamlFiles(rootDir).flatMap((filePath) => {
    const fileName = filePath.split(/[\\/]/).pop();
    if (!includeSystemFiles && SYSTEM_RECORD_FILES.has(fileName)) {
      return [];
    }
    return parseAllYamlDocuments(filePath)
      .filter((record) => record?.kind && record?.title)
      .map((record) => buildEntry({ record, file: filePath, layer }));
  });
}

export function readStagingRecords(stagingRoot) {
  return listYamlFiles(stagingRoot).flatMap((filePath) =>
    parseAllYamlDocuments(filePath).flatMap((document) => {
      if (document?.kind === "memory-write-staging-artifact" && document.request?.record) {
        return [
          buildEntry({
            record: document.request.record,
            file: filePath,
            layer: "staging",
            artifactPath: document.path ?? null,
          }),
        ];
      }
      if (document?.kind && document?.title) {
        return [buildEntry({ record: document, file: filePath, layer: "staging" })];
      }
      return [];
    }),
  );
}

export function loadExistingRecords(repoRoot, { ignoreArtifactPath = null }: any = {}) {
  const projectRoot = resolve(repoRoot, ".pairslash", "project-memory");
  const taskRoot = resolve(repoRoot, ".pairslash", "task-memory");
  const sessionsRoot = resolve(repoRoot, ".pairslash", "sessions");
  const stagingRoot = resolve(repoRoot, ".pairslash", "staging");
  const projectRecords = readDirectoryRecords(projectRoot, "global-project-memory", { includeSystemFiles: false });
  const taskRecords = readDirectoryRecords(taskRoot, "task-memory");
  const sessionRecords = readDirectoryRecords(sessionsRoot, "session");
  const stagingRecords = readStagingRecords(stagingRoot);
  const combined = [...projectRecords, ...taskRecords, ...sessionRecords, ...stagingRecords];
  if (!ignoreArtifactPath) {
    return combined;
  }
  const ignored = resolve(repoRoot, ignoreArtifactPath);
  return combined.filter((entry) => resolve(entry.file) !== ignored);
}

export function routeTargetFile(record) {
  if (DIRECTORY_FILES[record.kind]) {
    return join(DIRECTORY_FILES[record.kind], `${slugify(record.title)}.yaml`).replace(/\\/g, "/");
  }
  return ROOT_FILES[record.kind];
}

export function stringifyYamlDocuments(records) {
  return `${records.map((record) => stableYaml(record).trimEnd()).join("\n---\n")}\n`;
}

export function loadMutableDocuments(path) {
  return parseAllYamlDocuments(path).filter((record) => record?.kind && record?.title);
}

export function upsertMemoryDocument(path, record) {
  const existing = loadMutableDocuments(path);
  if (record.action === "supersede") {
    const index = existing.findIndex(
      (entry) => buildRecordId(entry) === record.supersedes || (entry.kind === record.kind && titlesMatch(entry, record)),
    );
    if (index === -1) {
      throw new Error(`no record found matching ${record.supersedes ?? buildRecordId(record)}`);
    }
    existing[index] = record;
  } else {
    existing.push(record);
  }
  writeTextFile(path, stringifyYamlDocuments(existing));
}

export function updateMemoryIndex({ repoRoot, record, relativeTargetFile, updatedBy }) {
  const indexPath = resolve(repoRoot, ".pairslash", "project-memory", "90-memory-index.yaml");
  const index = exists(indexPath)
    ? YAML.parse(readFileSync(indexPath, "utf8"))
    : { version: "0.1.0", last_updated: null, updated_by: updatedBy, records: [] };
  index.records = (index.records ?? []).map((entry) => {
    if (record.action === "supersede" && `${entry.kind}/${entry.title}` === record.supersedes) {
      return {
        ...entry,
        status: "superseded",
      };
    }
    return entry;
  });
  const nextEntry = {
    file: relativeTargetFile,
    kind: record.kind,
    title: record.title,
    scope: record.scope,
    ...(record.scope_detail ? { scope_detail: record.scope_detail } : {}),
    status: "active",
    record_family: "mutable",
  };
  const entryId = buildRecordId(record);
  const existingIndex = index.records.findIndex((entry) => `${entry.kind}/${entry.title}` === entryId);
  if (existingIndex >= 0) {
    index.records[existingIndex] = nextEntry;
  } else {
    index.records.push(nextEntry);
  }
  index.records.sort((left, right) =>
    `${left.file}\u0000${left.kind}\u0000${left.title}`.localeCompare(
      `${right.file}\u0000${right.kind}\u0000${right.title}`,
    ),
  );
  index.last_updated = new Date().toISOString();
  index.updated_by = updatedBy;
  writeTextFile(indexPath, stableYaml(index));
  return indexPath;
}

export function nextAvailablePath(basePath) {
  if (!exists(basePath)) {
    return basePath;
  }
  const extension = extname(basePath);
  const stem = basePath.slice(0, -extension.length);
  let attempt = 1;
  while (true) {
    const candidate = `${stem}-${String(attempt).padStart(3, "0")}${extension}`;
    if (!exists(candidate)) {
      return candidate;
    }
    attempt += 1;
  }
}

export function compareWrittenRecord(path, record) {
  return loadMutableDocuments(path).some((entry) => stableYaml(entry) === stableYaml(record));
}

export function writeAuthoritativeRecord({ repoRoot, preview }) {
  const targetFile = preview.preview_patch.target_file;
  const relativeTargetFile = targetFile.replace(".pairslash/project-memory/", "");
  const absoluteTargetFile = resolve(repoRoot, ".pairslash", "project-memory", relativeTargetFile);
  ensureDir(dirname(absoluteTargetFile));
  if (DIRECTORY_FILES[preview.request.record.kind]) {
    writeTextFile(absoluteTargetFile, stableYaml(preview.request.record));
  } else {
    upsertMemoryDocument(absoluteTargetFile, preview.request.record);
  }
  if (!compareWrittenRecord(absoluteTargetFile, preview.request.record)) {
    throw new Error("written record does not match staged preview payload");
  }
  updateMemoryIndex({
    repoRoot,
    record: preview.request.record,
    relativeTargetFile,
    updatedBy: preview.request.record.updated_by,
  });
  return {
    targetFile,
    relativeTargetFile,
  };
}

// Re-export for downstream modules that need stableHash for content fingerprinting.
export { stableHash };
