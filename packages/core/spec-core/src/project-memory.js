import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import YAML from "yaml";

import { exists, toPosix } from "./utils.js";

export const PROJECT_MEMORY_ROOT = ".pairslash/project-memory";
export const SYSTEM_RECORD_KINDS = ["charter", "stack-profile"];
export const MUTABLE_RECORD_KINDS = [
  "decision",
  "command",
  "glossary",
  "constraint",
  "ownership",
  "incident-lesson",
  "pattern",
];
export const PROJECT_MEMORY_REQUIRED_DIRECTORIES = [
  ".pairslash/project-memory",
  ".pairslash/task-memory",
  ".pairslash/sessions",
  ".pairslash/audit-log",
  ".pairslash/staging",
];
export const PROJECT_MEMORY_REQUIRED_PATHS = [
  ".pairslash/project-memory/00-project-charter.yaml",
  ".pairslash/project-memory/10-stack-profile.yaml",
  ".pairslash/project-memory/20-commands.yaml",
  ".pairslash/project-memory/30-glossary.yaml",
  ".pairslash/project-memory/40-ownership.yaml",
  ".pairslash/project-memory/50-constraints.yaml",
  ".pairslash/project-memory/60-architecture-decisions",
  ".pairslash/project-memory/70-known-good-patterns",
  ".pairslash/project-memory/80-incidents-and-lessons",
  ".pairslash/project-memory/90-memory-index.yaml",
];

const SYSTEM_RECORD_REQUIRED_FIELDS = {
  charter: [
    "phase",
    "identity",
    "runtimes",
    "canonical_entrypoint",
    "core_principles",
    "stage_statement",
    "truth_sources",
    "provenance",
  ],
  "stack-profile": [
    "runtimes",
    "project_language",
    "memory_format",
    "build_tooling",
    "provenance",
  ],
};

const SCOPES = new Set(["whole-project", "subsystem", "path-prefix"]);
const CONFIDENCE = new Set(["low", "medium", "high"]);
const ACTIONS = new Set(["append", "supersede", "reject-candidate-if-conflict"]);

function readYamlDocuments(path) {
  return YAML.parseAllDocuments(readFileSync(path, "utf8"))
    .map((document) => document.toJS())
    .filter((document) => document && typeof document === "object" && !Array.isArray(document));
}

function listYamlFiles(path) {
  if (!exists(path)) {
    return [];
  }
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
    .map((entry) => resolve(path, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function projectMemoryRelativePath(projectMemoryRoot, absolutePath) {
  return toPosix(relative(projectMemoryRoot, absolutePath));
}

export function validateProjectMemoryScope(scope, scopeDetail) {
  if (!SCOPES.has(scope)) {
    return [`invalid scope '${scope}'`];
  }
  if ((scope === "subsystem" || scope === "path-prefix") && !scopeDetail) {
    return ["scope_detail is required for subsystem/path-prefix scope"];
  }
  return [];
}

export function validateSystemRecord(record) {
  const errors = [];
  for (const field of ["kind", "title", "version"]) {
    if (!(field in record)) {
      errors.push(`missing field: ${field}`);
    }
  }
  if (!SYSTEM_RECORD_KINDS.includes(record.kind)) {
    errors.push(`invalid system kind: ${record.kind}`);
    return errors;
  }
  for (const field of SYSTEM_RECORD_REQUIRED_FIELDS[record.kind] ?? []) {
    if (!(field in record)) {
      errors.push(`missing field: ${field}`);
    }
  }
  for (const field of ["runtimes", "provenance"]) {
    if (field in record && (typeof record[field] !== "object" || record[field] === null || Array.isArray(record[field]))) {
      errors.push(`${field} must be an object`);
    }
  }
  if (record.kind === "charter") {
    if ("identity" in record && (typeof record.identity !== "object" || record.identity === null || Array.isArray(record.identity))) {
      errors.push("identity must be an object");
    }
    if ("core_principles" in record && !Array.isArray(record.core_principles)) {
      errors.push("core_principles must be a list");
    }
    if (
      "phase" in record &&
      !Number.isInteger(record.phase) &&
      !(typeof record.phase === "string" && record.phase.trim() !== "")
    ) {
      errors.push("phase must be an integer or non-empty string");
    }
    if ("stage_statement" in record && typeof record.stage_statement !== "string") {
      errors.push("stage_statement must be a string");
    }
    if ("truth_sources" in record && (typeof record.truth_sources !== "object" || record.truth_sources === null || Array.isArray(record.truth_sources))) {
      errors.push("truth_sources must be an object");
    }
  }
  if (record.kind === "stack-profile" && "build_tooling" in record && !Array.isArray(record.build_tooling)) {
    errors.push("build_tooling must be a list");
  }
  return errors;
}

export function validateMutableProjectMemoryRecord(record) {
  const errors = [];
  for (const field of [
    "kind",
    "title",
    "statement",
    "evidence",
    "scope",
    "confidence",
    "action",
    "tags",
    "source_refs",
    "updated_by",
    "timestamp",
  ]) {
    if (!(field in record)) {
      errors.push(`missing field: ${field}`);
    }
  }
  if (!MUTABLE_RECORD_KINDS.includes(record.kind)) {
    errors.push(`invalid mutable kind: ${record.kind}`);
  }
  errors.push(...validateProjectMemoryScope(record.scope, record.scope_detail));
  if (!CONFIDENCE.has(record.confidence)) {
    errors.push(`invalid confidence: ${record.confidence}`);
  }
  if (!ACTIONS.has(record.action)) {
    errors.push(`invalid action: ${record.action}`);
  }
  if (record.action === "supersede" && !record.supersedes) {
    errors.push("missing field: supersedes (required for supersede action)");
  }
  if (!Array.isArray(record.tags)) {
    errors.push("tags must be a list");
  }
  if (!Array.isArray(record.source_refs)) {
    errors.push("source_refs must be a list");
  }
  return errors;
}

export function loadProjectMemoryRecords(repoRoot) {
  const projectMemoryRoot = resolve(repoRoot, PROJECT_MEMORY_ROOT);
  const systemFiles = [
    resolve(projectMemoryRoot, "00-project-charter.yaml"),
    resolve(projectMemoryRoot, "10-stack-profile.yaml"),
  ];
  const mutableFiles = [
    resolve(projectMemoryRoot, "20-commands.yaml"),
    resolve(projectMemoryRoot, "30-glossary.yaml"),
    resolve(projectMemoryRoot, "40-ownership.yaml"),
    resolve(projectMemoryRoot, "50-constraints.yaml"),
    ...listYamlFiles(resolve(projectMemoryRoot, "60-architecture-decisions")),
    ...listYamlFiles(resolve(projectMemoryRoot, "70-known-good-patterns")),
    ...listYamlFiles(resolve(projectMemoryRoot, "80-incidents-and-lessons")),
  ];

  const errors = [];
  const systemEntries = [];
  const mutableEntries = [];

  for (const filePath of systemFiles) {
    if (!exists(filePath)) {
      continue;
    }
    try {
      for (const record of readYamlDocuments(filePath)) {
        systemEntries.push({
          file: filePath,
          relativePath: projectMemoryRelativePath(projectMemoryRoot, filePath),
          record,
        });
      }
    } catch (error) {
      errors.push(`${toPosix(relative(repoRoot, filePath))} :: failed to parse YAML :: ${error.message}`);
    }
  }

  for (const filePath of mutableFiles) {
    if (!exists(filePath)) {
      continue;
    }
    try {
      for (const record of readYamlDocuments(filePath)) {
        if (!record.kind) {
          continue;
        }
        mutableEntries.push({
          file: filePath,
          relativePath: projectMemoryRelativePath(projectMemoryRoot, filePath),
          record,
        });
      }
    } catch (error) {
      errors.push(`${toPosix(relative(repoRoot, filePath))} :: failed to parse YAML :: ${error.message}`);
    }
  }

  return { systemEntries, mutableEntries, errors };
}

export function validateProjectMemoryStructure(repoRoot) {
  const errors = [];
  for (const relativePath of PROJECT_MEMORY_REQUIRED_DIRECTORIES) {
    const absolutePath = resolve(repoRoot, relativePath);
    if (!exists(absolutePath)) {
      errors.push(`missing required directory: ${relativePath}`);
    }
  }
  for (const relativePath of PROJECT_MEMORY_REQUIRED_PATHS) {
    const absolutePath = resolve(repoRoot, relativePath);
    if (!exists(absolutePath)) {
      errors.push(`missing canonical memory path: ${relativePath}`);
    }
  }
  return errors;
}

export function validateProjectMemoryIndex(indexRecord, { systemEntries = [], mutableEntries = [] } = {}) {
  const errors = [];
  for (const field of ["version", "last_updated", "updated_by", "records"]) {
    if (!(field in indexRecord)) {
      errors.push(`missing top-level field ${field}`);
    }
  }
  const records = Array.isArray(indexRecord.records) ? indexRecord.records : [];
  if (!Array.isArray(indexRecord.records)) {
    errors.push("records must be a list");
  }

  const indexLookup = new Set();
  for (const item of records) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      errors.push("record entry must be object");
      continue;
    }
    for (const field of ["file", "kind", "title", "scope", "status", "record_family"]) {
      if (!(field in item)) {
        errors.push(`index entry missing field ${field}`);
      }
    }
    if (SYSTEM_RECORD_KINDS.includes(item.kind)) {
      if (item.record_family !== "system") {
        errors.push(`${item.kind} entry must have record_family=system`);
      }
      if (item.scope !== "whole-project") {
        errors.push(`${item.kind} entry must have scope=whole-project`);
      }
      if (item.schema_version !== "pre-0.1.0") {
        errors.push(`${item.kind} entry must declare schema_version=pre-0.1.0`);
      }
    }
    if (MUTABLE_RECORD_KINDS.includes(item.kind) && item.record_family !== "mutable") {
      errors.push(`${item.kind} entry must have record_family=mutable`);
    }
    indexLookup.add(`${item.file}::${item.kind}::${item.title}`);
  }

  for (const entry of [...systemEntries, ...mutableEntries.filter(({ record }) => MUTABLE_RECORD_KINDS.includes(record.kind))]) {
    const key = `${entry.relativePath}::${entry.record.kind}::${entry.record.title}`;
    if (!indexLookup.has(key)) {
      errors.push(`index missing coverage for ${entry.relativePath} :: ${entry.record.kind}/${entry.record.title}`);
    }
  }

  return errors;
}
