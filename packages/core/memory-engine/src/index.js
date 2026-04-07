import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

import YAML from "yaml";

import {
  AUDIT_LOG_ENTRY_SCHEMA_VERSION,
  MEMORY_WRITE_PREVIEW_SCHEMA_VERSION,
  MEMORY_WRITE_REQUEST_SCHEMA_VERSION,
  MEMORY_WRITE_RESULT_SCHEMA_VERSION,
  MEMORY_WRITE_STAGING_SCHEMA_VERSION,
  ensureDir,
  exists,
  normalizeRuntime,
  normalizeTarget,
  stableYaml,
  validateMemoryWritePreview,
  validateMemoryWriteRequest,
  validateMemoryWriteResult,
  validateAuditLogEntry,
  validateMemoryWriteStagingArtifact,
  validatePackManifestV2,
  walkFiles,
  writeTextFile,
} from "@pairslash/spec-core";
import { buildMemoryWriteContract } from "@pairslash/contract-engine";
import { evaluatePolicy } from "@pairslash/policy-engine";

const ROOT_FILES = {
  command: "20-commands.yaml",
  glossary: "30-glossary.yaml",
  ownership: "40-ownership.yaml",
  constraint: "50-constraints.yaml",
};

const DIRECTORY_FILES = {
  decision: "60-architecture-decisions",
  pattern: "70-known-good-patterns",
  "incident-lesson": "80-incidents-and-lessons",
};

const SYSTEM_RECORD_FILES = new Set([
  "00-project-charter.yaml",
  "10-stack-profile.yaml",
  "90-memory-index.yaml",
]);

const AUTHORITATIVE_LAYERS = new Set(["global-project-memory"]);
const CANDIDATE_LAYERS = new Set(["task-memory", "session", "staging"]);
const ALLOWED_RECORD_FIELDS = new Set([
  "kind",
  "title",
  "statement",
  "evidence",
  "scope",
  "scope_detail",
  "confidence",
  "action",
  "tags",
  "source_refs",
  "supersedes",
  "updated_by",
  "timestamp",
]);

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) {
    return value ?? [];
  }
  return [...new Set(value.map((entry) => String(entry).trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function stableHash(value) {
  return createHash("sha256").update(stableYaml(value)).digest("hex");
}

function loadRequestFile(path) {
  const content = readFileSync(path, "utf8");
  return extname(path).toLowerCase() === ".json" ? JSON.parse(content) : YAML.parse(content);
}

function loadManifest(repoRoot) {
  const manifestPath = resolve(
    repoRoot,
    "packs",
    "core",
    "pairslash-memory-write-global",
    "pack.manifest.yaml",
  );
  if (!exists(manifestPath)) {
    throw new Error("pairslash-memory-write-global manifest was not found in this repository");
  }
  const manifest = YAML.parse(readFileSync(manifestPath, "utf8"));
  const errors = validatePackManifestV2(manifest);
  if (errors.length > 0) {
    throw new Error(`invalid pairslash-memory-write-global manifest :: ${errors.join("; ")}`);
  }
  return manifest;
}

function normalizeRequestRecord(request = {}) {
  const unknownFields = Object.keys(request).filter((field) => !ALLOWED_RECORD_FIELDS.has(field));
  const record = {
    kind: request.kind,
    title: request.title,
    statement: request.statement,
    evidence: request.evidence,
    scope: request.scope,
    confidence: request.confidence,
    action: request.action,
    tags: normalizeStringList(request.tags ?? []),
    source_refs: normalizeStringList(request.source_refs ?? []),
    updated_by: request.updated_by ?? "session-user",
    timestamp: request.timestamp ?? new Date().toISOString(),
  };
  if (request.scope_detail !== undefined) {
    record.scope_detail = request.scope_detail;
  }
  if (request.supersedes !== undefined) {
    record.supersedes = request.supersedes;
  }
  return { record, unknownFields };
}

function buildRequestIdentity({ runtime, target, requestSource, normalizedRecord, rawRequest }) {
  const identityRecord = {
    kind: normalizedRecord.kind,
    title: normalizedRecord.title,
    statement: normalizedRecord.statement,
    evidence: normalizedRecord.evidence,
    scope: normalizedRecord.scope,
    confidence: normalizedRecord.confidence,
    action: normalizedRecord.action,
    tags: normalizedRecord.tags,
    source_refs: normalizedRecord.source_refs,
    updated_by: normalizedRecord.updated_by,
  };
  if (normalizedRecord.scope_detail !== undefined) {
    identityRecord.scope_detail = normalizedRecord.scope_detail;
  }
  if (normalizedRecord.supersedes !== undefined) {
    identityRecord.supersedes = normalizedRecord.supersedes;
  }
  if (rawRequest?.timestamp !== undefined) {
    identityRecord.timestamp = normalizedRecord.timestamp;
  }
  return {
    runtime,
    target,
    request_source: requestSource,
    record: identityRecord,
  };
}

function buildRequest({ request, runtime, target, requestSource = "cli" }) {
  const normalizedRuntime = normalizeRuntime(runtime);
  const normalizedTarget = normalizeTarget(target);
  const { record, unknownFields } = normalizeRequestRecord(request);
  const payload = {
    kind: "memory-write-request",
    schema_version: MEMORY_WRITE_REQUEST_SCHEMA_VERSION,
    runtime: normalizedRuntime,
    target: normalizedTarget,
    request_source: requestSource,
    record,
  };
  const errors = [
    ...validateMemoryWriteRequest(payload),
    ...unknownFields.map((field) => `record.${field} is not allowed in authoritative memory writes`),
  ];
  return {
    payload,
    requestIdentity: buildRequestIdentity({
      runtime: normalizedRuntime,
      target: normalizedTarget,
      requestSource,
      normalizedRecord: record,
      rawRequest: request,
    }),
    errors,
  };
}

function parseAllYamlDocuments(path) {
  if (!exists(path)) {
    return [];
  }
  return YAML.parseAllDocuments(readFileSync(path, "utf8"))
    .map((document) => document.toJSON())
    .filter(Boolean);
}

function listYamlFiles(rootDir) {
  if (!exists(rootDir)) {
    return [];
  }
  return walkFiles(rootDir).filter((filePath) => /\.(yaml|yml)$/i.test(filePath));
}

function buildEntry({ record, file, layer, artifactPath = null }) {
  return { record, file, layer, artifact_path: artifactPath };
}

function readDirectoryRecords(rootDir, layer, { includeSystemFiles = true } = {}) {
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

function readStagingRecords(stagingRoot) {
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

function loadExistingRecords(repoRoot, { ignoreArtifactPath = null } = {}) {
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

function routeTargetFile(record) {
  if (DIRECTORY_FILES[record.kind]) {
    return join(DIRECTORY_FILES[record.kind], `${slugify(record.title)}.yaml`).replace(/\\/g, "/");
  }
  return ROOT_FILES[record.kind];
}

function buildRecordId(record) {
  return `${record.kind}/${record.title}`;
}

function scopesMatch(left, right) {
  return (
    left.scope === right.scope &&
    normalizeText(left.scope_detail ?? "") === normalizeText(right.scope_detail ?? "")
  );
}

function titlesMatch(left, right) {
  return normalizeText(left.title) === normalizeText(right.title);
}

function statementsMatch(left, right) {
  return normalizeText(left.statement) === normalizeText(right.statement);
}

function relativeFromProjectMemory(repoRoot, absolutePath) {
  return relative(resolve(repoRoot, ".pairslash", "project-memory"), absolutePath).replace(/\\/g, "/");
}

function summarizeEntry(entry, reasons = []) {
  return {
    layer: entry.layer,
    file: entry.file.replace(/\\/g, "/"),
    kind: entry.record.kind,
    title: entry.record.title,
    scope: entry.record.scope,
    scope_detail: entry.record.scope_detail ?? null,
    statement: entry.record.statement ?? null,
    artifact_path: entry.artifact_path ?? null,
    reasons: [...new Set(reasons)].sort((left, right) => left.localeCompare(right)),
  };
}

function findSupersedeTarget(existingRecords, record) {
  return existingRecords.find(
    (entry) =>
      entry.layer === "global-project-memory" &&
      (buildRecordId(entry.record) === record.supersedes ||
        (entry.record.kind === record.kind && titlesMatch(entry.record, record))),
  );
}

function detectDuplicates(existingRecords, record) {
  return existingRecords.filter(
    (entry) =>
      AUTHORITATIVE_LAYERS.has(entry.layer) &&
      entry.record.kind === record.kind &&
      titlesMatch(entry.record, record) &&
      scopesMatch(entry.record, record) &&
      statementsMatch(entry.record, record),
  );
}

function detectConflicts(existingRecords, record) {
  return existingRecords.filter((entry) => {
    if (!AUTHORITATIVE_LAYERS.has(entry.layer)) {
      return false;
    }
    if (entry.record.kind !== record.kind) {
      return false;
    }
    if (!scopesMatch(entry.record, record)) {
      return false;
    }
    if (statementsMatch(entry.record, record)) {
      return false;
    }
    return titlesMatch(entry.record, record) || buildRecordId(entry.record) === record.supersedes;
  });
}

function detectShadowWarnings(existingRecords, record) {
  if (record.scope === "whole-project") {
    return [];
  }
  return existingRecords
    .filter(
      (entry) =>
        entry.layer === "global-project-memory" &&
        entry.record.kind === record.kind &&
        entry.record.scope === "whole-project",
    )
    .map((entry) => `scope-shadow:${buildRecordId(entry.record)}`);
}

function findCandidateConflicts(existingRecords, record) {
  return existingRecords.filter((entry) => {
    if (!CANDIDATE_LAYERS.has(entry.layer)) {
      return false;
    }
    if (entry.record.kind !== record.kind) {
      return false;
    }
    if (!(titlesMatch(entry.record, record) || scopesMatch(entry.record, record))) {
      return false;
    }
    return !statementsMatch(entry.record, record);
  });
}

function collectRelatedRecords(existingRecords, record) {
  return existingRecords
    .filter((entry) => {
      if (entry.record.kind !== record.kind) {
        return false;
      }
      return (
        titlesMatch(entry.record, record) ||
        scopesMatch(entry.record, record) ||
        buildRecordId(entry.record) === record.supersedes ||
        (record.scope !== "whole-project" && entry.record.scope === "whole-project")
      );
    })
    .map((entry) => {
      const reasons = [];
      if (titlesMatch(entry.record, record)) {
        reasons.push("title-match");
      }
      if (scopesMatch(entry.record, record)) {
        reasons.push("scope-match");
      }
      if (buildRecordId(entry.record) === record.supersedes) {
        reasons.push("supersede-target");
      }
      if (record.scope !== "whole-project" && entry.record.scope === "whole-project") {
        reasons.push("scope-shadow-source");
      }
      return summarizeEntry(entry, reasons);
    })
    .sort((left, right) =>
      `${left.layer}\u0000${left.kind}\u0000${left.title}\u0000${left.file}`.localeCompare(
        `${right.layer}\u0000${right.kind}\u0000${right.title}\u0000${right.file}`,
      ),
    );
}

function resolveTargetRelativeFile(repoRoot, existingRecords, record) {
  const supersedeTarget = record.action === "supersede" ? findSupersedeTarget(existingRecords, record) : null;
  if (supersedeTarget?.layer === "global-project-memory") {
    return relativeFromProjectMemory(repoRoot, supersedeTarget.file);
  }
  return routeTargetFile(record);
}

function buildPreviewPatch(request, relativeTargetFile) {
  const wrapper = {
    target_file: relativeTargetFile ? `.pairslash/project-memory/${relativeTargetFile}` : null,
    action: request.record.action,
    content: structuredClone(request.record),
  };
  return {
    ...wrapper,
    text:
      wrapper.target_file === null
        ? ""
        : [
            "--- preview patch ---",
            stableYaml(wrapper).trimEnd(),
            "--- end preview ---",
          ].join("\n"),
  };
}

function stringifyYamlDocuments(records) {
  return `${records.map((record) => stableYaml(record).trimEnd()).join("\n---\n")}\n`;
}

function loadMutableDocuments(path) {
  return parseAllYamlDocuments(path).filter((record) => record?.kind && record?.title);
}

function upsertMemoryDocument(path, record) {
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

function updateMemoryIndex({ repoRoot, record, relativeTargetFile, updatedBy }) {
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

function nextAvailablePath(basePath) {
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

function buildAuditEntry({
  repoRoot,
  record,
  relativeTargetFile,
  result,
  notes = null,
  stagingArtifact = null,
  duplicateCount = 0,
  conflictCount = 0,
  approvalState = "not-required",
  relatedRecords = [],
}) {
  const baseTimestamp = String(record.timestamp)
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "")
    .replace("T", "-");
  const auditDir = resolve(repoRoot, ".pairslash", "audit-log");
  ensureDir(auditDir);
  const auditPath = nextAvailablePath(
    resolve(auditDir, `${baseTimestamp}-${record.kind}-${record.action}.yaml`),
  );
  const payload = {
    schema_version: AUDIT_LOG_ENTRY_SCHEMA_VERSION,
    timestamp: record.timestamp,
    action: record.action,
    kind: record.kind,
    title: record.title,
    target_file: relativeTargetFile ? `.pairslash/project-memory/${relativeTargetFile}` : "unresolved",
    updated_by: record.updated_by,
    confidence: record.confidence,
    result,
    approval: approvalState,
    duplicate_count: duplicateCount,
    conflict_count: conflictCount,
    related_layers: [...new Set(relatedRecords.map((entry) => entry.layer))].sort((left, right) =>
      left.localeCompare(right),
    ),
    ...(stagingArtifact?.path ? { preview_artifact: stagingArtifact.path } : {}),
    notes:
      [
        notes,
        record.confidence === "low" ? "low-confidence-authoritative-write" : null,
      ]
        .filter(Boolean)
        .join("; "),
  };
  const validationErrors = validateAuditLogEntry(payload);
  if (validationErrors.length > 0) {
    throw new Error(`invalid audit log entry :: ${validationErrors.join("; ")}`);
  }
  writeTextFile(auditPath, stableYaml(payload));
  return auditPath;
}

function compareWrittenRecord(path, record) {
  return loadMutableDocuments(path).some((entry) => stableYaml(entry) === stableYaml(record));
}

function resolveContract(repoRoot, runtime, target) {
  const manifest = loadManifest(repoRoot);
  return buildMemoryWriteContract({
    manifest,
    runtime,
    target,
  });
}

function buildStage(name, status, notes = []) {
  return {
    name,
    status,
    blocking: status === "blocked",
    notes: notes.filter(Boolean),
  };
}

function buildApproval({ required = true, state = "pending" } = {}) {
  return {
    required,
    state,
    confirmation_phrase: required ? "write-global" : null,
  };
}

function buildArtifactReference({ artifactId, artifactPath, requestKey, contentFingerprint, exists: present }) {
  return {
    artifact_id: artifactId,
    path: artifactPath,
    request_key: requestKey,
    content_fingerprint: contentFingerprint,
    exists: present,
  };
}

function buildArtifactPath({ repoRoot, requestIdentity, record }) {
  const artifactId = stableHash(requestIdentity).slice(0, 16);
  const relativePath = `.pairslash/staging/memory-write-${artifactId}-${slugify(record.title)}.yaml`;
  return {
    artifactId,
    relativePath,
    absolutePath: resolve(repoRoot, relativePath),
  };
}

function authorityErrors(contract, policyContext = {}) {
  const errors = [];
  if (
    contract.memory_contract?.authoritative_write_allowed &&
    (policyContext.read_only_workflow === true ||
      policyContext.workflow_class === "read-oriented" ||
      policyContext.authority_mode === "read-only")
  ) {
    errors.push("authority:read-only-workflow");
  }
  if (policyContext.implicit_promote_attempted) {
    errors.push("authority:implicit-promote-blocked");
  }
  return errors;
}

function buildCommonAnalysis({
  repoRoot,
  payload,
  requestIdentity,
  requestErrors,
  contract,
  policyContext = {},
}) {
  const { artifactId, relativePath: artifactPath, absolutePath: artifactAbsolutePath } = buildArtifactPath({
    repoRoot,
    requestIdentity,
    record: payload.record,
  });
  const contentFingerprint = stableHash(payload.record).slice(0, 16);
  const recordDisposition = payload.record.action;
  const authorityViolations = authorityErrors(contract, policyContext);
  const existing =
    requestErrors.length === 0
      ? loadExistingRecords(repoRoot, { ignoreArtifactPath: artifactPath })
      : [];
  const duplicates = requestErrors.length === 0 ? detectDuplicates(existing, payload.record) : [];
  const conflicts = requestErrors.length === 0 ? detectConflicts(existing, payload.record) : [];
  const shadowWarnings = requestErrors.length === 0 ? detectShadowWarnings(existing, payload.record) : [];
  const candidateConflicts =
    requestErrors.length === 0 && payload.record.action === "reject-candidate-if-conflict"
      ? findCandidateConflicts(existing, payload.record)
      : [];
  const relatedRecords = requestErrors.length === 0 ? collectRelatedRecords(existing, payload.record) : [];
  const supersedeTarget =
    requestErrors.length === 0 && payload.record.action === "supersede"
      ? findSupersedeTarget(existing, payload.record)
      : null;
  const pipelineErrors = [...requestErrors, ...authorityViolations];
  if (payload.record.action === "supersede" && !supersedeTarget) {
    pipelineErrors.push(`supersede-target-missing:${payload.record.supersedes ?? buildRecordId(payload.record)}`);
  }
  if (payload.record.action === "reject-candidate-if-conflict" && candidateConflicts.length === 0) {
    pipelineErrors.push("reject-candidate-if-conflict requires a conflicting task/session/staging candidate");
  }
  pipelineErrors.push(...duplicates.map((entry) => `duplicate:${buildRecordId(entry.record)}`));
  pipelineErrors.push(...conflicts.map((entry) => `conflict:${buildRecordId(entry.record)}`));
  const lowConfidenceWarning =
    payload.record.confidence === "low"
      ? "low-confidence: prefer task-memory or staging unless authoritative commit is explicitly justified"
      : null;
  const warnings = [...shadowWarnings, ...(lowConfidenceWarning ? [lowConfidenceWarning] : [])];
  const relativeTargetFile =
    requestErrors.length === 0 ? resolveTargetRelativeFile(repoRoot, existing, payload.record) : null;
  const previewPatch = buildPreviewPatch(payload, relativeTargetFile);
  const policyVerdict = evaluatePolicy({
    contract,
    request: {
      action: "memory.write-global",
      requested_runtime: payload.runtime,
      requested_target: payload.target,
      apply: false,
      preview_requested: true,
      approval: "none",
      conflicts: pipelineErrors.filter((entry) => entry.startsWith("duplicate:") || entry.startsWith("conflict:")),
      workflow_class: policyContext.workflow_class,
      authority_mode: policyContext.authority_mode,
      read_only_workflow: policyContext.read_only_workflow,
      hidden_write_attempted: policyContext.hidden_write_attempted,
      implicit_promote_attempted: policyContext.implicit_promote_attempted,
      fallback_attempted: policyContext.fallback_attempted,
      allow_fallback: policyContext.allow_fallback,
    },
  });
  const stages = [
    buildStage(
      "parse-input",
      requestErrors.length > 0 ? "blocked" : "ok",
      requestErrors.length > 0 ? requestErrors : ["request schema accepted"],
    ),
    buildStage(
      "locate-related-records",
      requestErrors.length > 0 ? "skipped" : "ok",
      requestErrors.length > 0 ? ["blocked by invalid request"] : [`${relatedRecords.length} related record(s) found`],
    ),
    buildStage(
      "duplicate-detection",
      requestErrors.length > 0 ? "skipped" : duplicates.length > 0 ? "blocked" : "ok",
      requestErrors.length > 0
        ? ["blocked by invalid request"]
        : duplicates.length > 0
          ? duplicates.map((entry) => buildRecordId(entry.record))
          : ["no authoritative duplicates found"],
    ),
    buildStage(
      "conflict-detection",
      requestErrors.length > 0
        ? "skipped"
        : conflicts.length > 0 ||
            pipelineErrors.some((entry) => entry.startsWith("supersede-target-missing")) ||
            pipelineErrors.includes("reject-candidate-if-conflict requires a conflicting task/session/staging candidate")
          ? "blocked"
          : "ok",
      requestErrors.length > 0
        ? ["blocked by invalid request"]
        : [
            ...conflicts.map((entry) => buildRecordId(entry.record)),
            ...pipelineErrors.filter((entry) => entry.startsWith("supersede-target-missing")),
            ...(payload.record.action === "reject-candidate-if-conflict"
              ? candidateConflicts.length > 0
                ? candidateConflicts.map((entry) => `candidate:${buildRecordId(entry.record)}`)
                : ["no conflicting candidate found"]
              : ["no authoritative conflicts found"]),
          ],
    ),
    buildStage(
      "scope-validation",
      requestErrors.length > 0
        ? "skipped"
        : authorityViolations.length > 0
          ? "blocked"
          : shadowWarnings.length > 0
            ? "warn"
            : "ok",
      requestErrors.length > 0
        ? ["blocked by invalid request"]
        : [...authorityViolations, ...shadowWarnings, "scope validated"],
    ),
    buildStage(
      "preview-patch-generation",
      previewPatch.target_file ? "ok" : "blocked",
      previewPatch.target_file ? [previewPatch.target_file] : ["target file could not be resolved"],
    ),
    buildStage(
      "approval-gate",
      policyVerdict.overall_verdict === "deny" ? "blocked" : "warn",
      ["explicit approval remains required before apply"],
    ),
    buildStage("commit-path", "skipped", ["apply only"]),
    buildStage("audit-log-append", "skipped", ["apply or reject only"]),
    buildStage("memory-index-update", "skipped", ["apply only"]),
  ];
  const artifactReference = buildArtifactReference({
    artifactId,
    artifactPath,
    requestKey: stableHash(requestIdentity).slice(0, 24),
    contentFingerprint,
    exists: false,
  });
  return {
    artifactAbsolutePath,
    artifactReference,
    candidateConflicts,
    conflicts,
    duplicates,
    policyVerdict,
    previewPatch,
    readyForApply: pipelineErrors.length === 0 && policyVerdict.overall_verdict !== "deny",
    recordDisposition,
    relatedRecords,
    requestErrors: pipelineErrors,
    scopeWarnings: shadowWarnings,
    stages,
    warnings,
  };
}

function persistStagingArtifact({
  absolutePath,
  artifactReference,
  payload,
  previewPatch,
  pipelineStages,
  relatedRecords,
  duplicateMatches,
  conflictMatches,
  scopeWarnings,
  recordDisposition,
  approval,
  policyVerdict,
  readyForApply,
  warnings,
  errors,
}) {
  const artifact = {
    kind: "memory-write-staging-artifact",
    schema_version: MEMORY_WRITE_STAGING_SCHEMA_VERSION,
    runtime: payload.runtime,
    target: payload.target,
    artifact_id: artifactReference.artifact_id,
    request_key: artifactReference.request_key,
    content_fingerprint: artifactReference.content_fingerprint,
    path: artifactReference.path,
    request: payload,
    preview_patch: previewPatch,
    pipeline_stages: pipelineStages,
    related_records: relatedRecords,
    duplicate_matches: duplicateMatches,
    conflict_matches: conflictMatches,
    scope_warnings: scopeWarnings,
    record_disposition: recordDisposition,
    approval,
    policy_verdict: policyVerdict,
    ready_for_apply: readyForApply,
    warnings,
    errors,
  };
  const validationErrors = validateMemoryWriteStagingArtifact(artifact);
  if (validationErrors.length > 0) {
    throw new Error(`invalid memory write staging artifact :: ${validationErrors.join("; ")}`);
  }
  ensureDir(dirname(absolutePath));
  writeTextFile(absolutePath, stableYaml(artifact));
  return artifact;
}

function loadStagingArtifactForRequest({
  repoRoot,
  request,
  runtime = "codex_cli",
  target = "repo",
  requestSource = "cli",
}) {
  const { payload, requestIdentity, errors } = buildRequest({
    request,
    runtime,
    target,
    requestSource,
  });
  if (errors.length > 0) {
    return null;
  }
  const { absolutePath } = buildArtifactPath({
    repoRoot,
    requestIdentity,
    record: payload.record,
  });
  if (!exists(absolutePath)) {
    return null;
  }
  const artifact = YAML.parse(readFileSync(absolutePath, "utf8"));
  const validationErrors = validateMemoryWriteStagingArtifact(artifact);
  if (validationErrors.length > 0) {
    throw new Error(`invalid memory write staging artifact :: ${validationErrors.join("; ")}`);
  }
  return artifact;
}

function createPreviewFromArtifact(artifact) {
  const preview = {
    kind: "memory-write-preview",
    schema_version: MEMORY_WRITE_PREVIEW_SCHEMA_VERSION,
    runtime: artifact.runtime,
    target: artifact.target,
    request: artifact.request,
    policy_verdict: artifact.policy_verdict,
    preview_patch: artifact.preview_patch,
    pipeline_stages: artifact.pipeline_stages,
    related_records: artifact.related_records,
    duplicate_matches: artifact.duplicate_matches,
    conflict_matches: artifact.conflict_matches,
    scope_warnings: artifact.scope_warnings,
    record_disposition: artifact.record_disposition,
    staging_artifact: {
      artifact_id: artifact.artifact_id,
      path: artifact.path,
      request_key: artifact.request_key,
      content_fingerprint: artifact.content_fingerprint,
      exists: true,
    },
    approval: artifact.approval,
    ready_for_apply: artifact.ready_for_apply,
    requires_confirmation: artifact.approval.required,
    warnings: artifact.warnings,
    errors: artifact.errors,
  };
  const validationErrors = validateMemoryWritePreview(preview);
  if (validationErrors.length > 0) {
    throw new Error(`invalid memory write preview :: ${validationErrors.join("; ")}`);
  }
  return preview;
}

function createResultBase({
  status,
  committed,
  request,
  policyVerdict,
  pipelineStages,
  relatedRecords,
  duplicateMatches,
  conflictMatches,
  scopeWarnings,
  recordDisposition,
  stagingArtifact,
  approval,
  targetFile = null,
  auditLogPath = null,
  indexUpdated = false,
  warnings = [],
  errors = [],
}) {
  const result = {
    kind: "memory-write-result",
    schema_version: MEMORY_WRITE_RESULT_SCHEMA_VERSION,
    status,
    runtime: request.runtime,
    target: request.target,
    request,
    policy_verdict: policyVerdict,
    pipeline_stages: pipelineStages,
    related_records: relatedRecords,
    duplicate_matches: duplicateMatches,
    conflict_matches: conflictMatches,
    scope_warnings: scopeWarnings,
    record_disposition: recordDisposition,
    staging_artifact: stagingArtifact,
    approval,
    target_file: targetFile,
    audit_log_path: auditLogPath,
    committed,
    index_updated: indexUpdated,
    warnings,
    errors,
  };
  const validationErrors = validateMemoryWriteResult(result);
  if (validationErrors.length > 0) {
    throw new Error(`invalid memory write result :: ${validationErrors.join("; ")}`);
  }
  return result;
}

function writeAuthoritativeRecord({ repoRoot, preview }) {
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

export function previewMemoryWrite({
  repoRoot,
  request,
  runtime = "codex_cli",
  target = "repo",
  requestSource = "cli",
  policyContext = {},
} = {}) {
  const { payload, requestIdentity, errors: requestErrors } = buildRequest({
    request,
    runtime,
    target,
    requestSource,
  });
  const contract = resolveContract(repoRoot, payload.runtime, payload.target);
  const analysis = buildCommonAnalysis({
    repoRoot,
    payload,
    requestIdentity,
    requestErrors,
    contract,
    policyContext,
  });
  const duplicateMatches = analysis.duplicates.map((entry) => summarizeEntry(entry, ["duplicate"]));
  const conflictMatches = [
    ...analysis.conflicts.map((entry) => summarizeEntry(entry, ["conflict"])),
    ...analysis.candidateConflicts.map((entry) => summarizeEntry(entry, ["candidate-conflict"])),
  ];
  const artifact = analysis.previewPatch.target_file
    ? persistStagingArtifact({
        absolutePath: analysis.artifactAbsolutePath,
        artifactReference: analysis.artifactReference,
        payload,
        previewPatch: analysis.previewPatch,
        pipelineStages: analysis.stages,
        relatedRecords: analysis.relatedRecords,
        duplicateMatches,
        conflictMatches,
        scopeWarnings: analysis.scopeWarnings,
        recordDisposition: analysis.recordDisposition,
        approval: buildApproval({ required: true, state: "pending" }),
        policyVerdict: analysis.policyVerdict,
        readyForApply: analysis.readyForApply,
        warnings: analysis.warnings,
        errors: analysis.requestErrors,
      })
    : null;
  const preview = {
    kind: "memory-write-preview",
    schema_version: MEMORY_WRITE_PREVIEW_SCHEMA_VERSION,
    runtime: payload.runtime,
    target: payload.target,
    request: payload,
    policy_verdict: analysis.policyVerdict,
    preview_patch: analysis.previewPatch,
    pipeline_stages: analysis.stages,
    related_records: analysis.relatedRecords,
    duplicate_matches: duplicateMatches,
    conflict_matches: conflictMatches,
    scope_warnings: analysis.scopeWarnings,
    record_disposition: analysis.recordDisposition,
    staging_artifact: buildArtifactReference({
      artifactId: analysis.artifactReference.artifact_id,
      artifactPath: analysis.artifactReference.path,
      requestKey: analysis.artifactReference.request_key,
      contentFingerprint: analysis.artifactReference.content_fingerprint,
      exists: Boolean(artifact),
    }),
    approval: buildApproval({ required: true, state: "pending" }),
    ready_for_apply: analysis.readyForApply,
    requires_confirmation: true,
    warnings: analysis.warnings,
    errors: analysis.requestErrors,
  };
  const validationErrors = validateMemoryWritePreview(preview);
  if (validationErrors.length > 0) {
    throw new Error(`invalid memory write preview :: ${validationErrors.join("; ")}`);
  }
  return preview;
}

export function loadStagedMemoryWritePreview({
  repoRoot,
  request,
  runtime = "codex_cli",
  target = "repo",
  requestSource = "cli",
} = {}) {
  const artifact = loadStagingArtifactForRequest({
    repoRoot,
    request,
    runtime,
    target,
    requestSource,
  });
  return artifact ? createPreviewFromArtifact(artifact) : null;
}

export function applyMemoryWrite({
  repoRoot,
  request,
  runtime = "codex_cli",
  target = "repo",
  requestSource = "cli",
  policyContext = {},
} = {}) {
  const { payload, errors: requestErrors } = buildRequest({
    request,
    runtime,
    target,
    requestSource,
  });
  const contract = resolveContract(repoRoot, payload.runtime, payload.target);
  const artifact =
    requestErrors.length === 0
      ? loadStagingArtifactForRequest({
          repoRoot,
          request,
          runtime,
          target,
          requestSource,
        })
      : null;
  const stagedPreview = artifact ? createPreviewFromArtifact(artifact) : null;
  const targetFile = stagedPreview?.preview_patch.target_file ?? null;
  const relativeTargetFile = targetFile ? targetFile.replace(".pairslash/project-memory/", "") : null;
  const previewMissingErrors =
    stagedPreview === null && requestErrors.length === 0
      ? ["preview-required: no staged preview artifact found for this request"]
      : [];
  const stagedPayload = stagedPreview?.request ?? payload;
  const requestIdentity = buildRequestIdentity({
    runtime: stagedPayload.runtime,
    target: stagedPayload.target,
    requestSource: stagedPayload.request_source,
    normalizedRecord: stagedPayload.record,
    rawRequest: request,
  });
  const analysis = buildCommonAnalysis({
    repoRoot,
    payload: stagedPayload,
    requestIdentity,
    requestErrors: [...requestErrors, ...previewMissingErrors],
    contract,
    policyContext,
  });
  const explicitVerdict = evaluatePolicy({
    contract,
    request: {
      action: "memory.write-global",
      requested_runtime: stagedPayload.runtime,
      requested_target: stagedPayload.target,
      apply: true,
      preview_requested: Boolean(stagedPreview),
      approval: "explicit",
      conflicts: analysis.requestErrors.filter((entry) => entry.startsWith("duplicate:") || entry.startsWith("conflict:")),
      workflow_class: policyContext.workflow_class,
      authority_mode: policyContext.authority_mode,
      read_only_workflow: policyContext.read_only_workflow,
      hidden_write_attempted: policyContext.hidden_write_attempted,
      implicit_promote_attempted: policyContext.implicit_promote_attempted,
      fallback_attempted: policyContext.fallback_attempted,
      allow_fallback: policyContext.allow_fallback,
    },
  });
  const approval = buildApproval({ required: true, state: "explicit" });
  const stagingArtifact = stagedPreview?.staging_artifact ??
    buildArtifactReference({
      artifactId: analysis.artifactReference.artifact_id,
      artifactPath: analysis.artifactReference.path,
      requestKey: analysis.artifactReference.request_key,
      contentFingerprint: analysis.artifactReference.content_fingerprint,
      exists: Boolean(stagedPreview),
    });
  const duplicateMatches = analysis.duplicates.map((entry) => summarizeEntry(entry, ["duplicate"]));
  const conflictMatches = [
    ...analysis.conflicts.map((entry) => summarizeEntry(entry, ["conflict"])),
    ...analysis.candidateConflicts.map((entry) => summarizeEntry(entry, ["candidate-conflict"])),
  ];
  const stagePrefix = analysis.stages.slice(0, 7);
  const blocked =
    requestErrors.length > 0 ||
    stagedPreview === null ||
    !stagedPreview?.ready_for_apply ||
    explicitVerdict.overall_verdict === "deny";
  if (blocked) {
    const auditLogPath =
      relativeTargetFile
        ? buildAuditEntry({
            repoRoot,
            record: stagedPayload.record,
            relativeTargetFile,
            result: analysis.requestErrors.some((entry) => entry.startsWith("duplicate:") || entry.startsWith("conflict:"))
              ? "conflict"
              : "failed",
            notes: analysis.requestErrors.join("; "),
            stagingArtifact,
            duplicateCount: duplicateMatches.length,
            conflictCount: conflictMatches.length,
            approvalState: stagedPreview ? "explicit" : "pending",
            relatedRecords: analysis.relatedRecords,
          })
        : null;
    return createResultBase({
      status: analysis.requestErrors.some((entry) => entry.startsWith("duplicate:") || entry.startsWith("conflict:"))
        ? "conflict"
        : "denied",
      committed: false,
      request: stagedPayload,
      policyVerdict: explicitVerdict,
      pipelineStages: [
        ...stagePrefix,
        buildStage(
          "commit-path",
          "blocked",
          stagedPreview === null
            ? ["missing preview artifact"]
            : stagedPreview.ready_for_apply
              ? ["policy denied apply"]
              : ["preview exists but is not ready for apply"],
        ),
        buildStage("audit-log-append", auditLogPath ? "ok" : "skipped", auditLogPath ? [auditLogPath] : ["no audit path"]),
        buildStage("memory-index-update", "skipped", ["commit did not succeed"]),
      ],
      relatedRecords: analysis.relatedRecords,
      duplicateMatches,
      conflictMatches,
      scopeWarnings: analysis.scopeWarnings,
      recordDisposition: stagedPayload.record.action,
      stagingArtifact,
      approval,
      targetFile,
      auditLogPath,
      warnings: analysis.warnings,
      errors: analysis.requestErrors,
    });
  }
  try {
    const commitResult = writeAuthoritativeRecord({
      repoRoot,
      preview: {
        request: stagedPayload,
        preview_patch: stagedPreview.preview_patch,
      },
    });
    const auditLogPath = buildAuditEntry({
      repoRoot,
      record: stagedPayload.record,
      relativeTargetFile: commitResult.relativeTargetFile,
      result: "success",
      stagingArtifact,
      duplicateCount: duplicateMatches.length,
      conflictCount: conflictMatches.length,
      approvalState: "explicit",
      relatedRecords: analysis.relatedRecords,
    });
    return createResultBase({
      status: "committed",
      committed: true,
      request: stagedPayload,
      policyVerdict: explicitVerdict,
      pipelineStages: [
        ...stagePrefix,
        buildStage("commit-path", "ok", [commitResult.targetFile]),
        buildStage("audit-log-append", "ok", [auditLogPath]),
        buildStage("memory-index-update", "ok", ["90-memory-index.yaml updated deterministically"]),
      ],
      relatedRecords: analysis.relatedRecords,
      duplicateMatches,
      conflictMatches,
      scopeWarnings: analysis.scopeWarnings,
      recordDisposition: stagedPayload.record.action,
      stagingArtifact,
      approval,
      targetFile: commitResult.targetFile,
      auditLogPath,
      indexUpdated: true,
      warnings: analysis.warnings,
      errors: [],
    });
  } catch (error) {
    const auditLogPath =
      relativeTargetFile
        ? buildAuditEntry({
            repoRoot,
            record: stagedPayload.record,
            relativeTargetFile,
            result: "failed",
            notes: error.message,
            stagingArtifact,
            duplicateCount: duplicateMatches.length,
            conflictCount: conflictMatches.length,
            approvalState: "explicit",
            relatedRecords: analysis.relatedRecords,
          })
        : null;
    return createResultBase({
      status: "failed",
      committed: false,
      request: stagedPayload,
      policyVerdict: explicitVerdict,
      pipelineStages: [
        ...stagePrefix,
        buildStage("commit-path", "blocked", [error.message]),
        buildStage("audit-log-append", auditLogPath ? "ok" : "skipped", auditLogPath ? [auditLogPath] : ["no audit path"]),
        buildStage("memory-index-update", "skipped", ["commit failed"]),
      ],
      relatedRecords: analysis.relatedRecords,
      duplicateMatches,
      conflictMatches,
      scopeWarnings: analysis.scopeWarnings,
      recordDisposition: stagedPayload.record.action,
      stagingArtifact,
      approval,
      targetFile,
      auditLogPath,
      warnings: analysis.warnings,
      errors: [error.message],
    });
  }
}

export function rejectMemoryWrite({
  repoRoot,
  request,
  runtime = "codex_cli",
  target = "repo",
  requestSource = "cli",
  notes = "user rejected preview",
} = {}) {
  const preview =
    loadStagedMemoryWritePreview({
      repoRoot,
      request,
      runtime,
      target,
      requestSource,
    }) ??
    previewMemoryWrite({
      repoRoot,
      request,
      runtime,
      target,
      requestSource,
    });
  const targetFile = preview.preview_patch.target_file;
  const relativeTargetFile = targetFile ? targetFile.replace(".pairslash/project-memory/", "") : null;
  const auditLogPath =
    relativeTargetFile
      ? buildAuditEntry({
          repoRoot,
          record: preview.request.record,
          relativeTargetFile,
          result: "rejected",
          notes,
          stagingArtifact: preview.staging_artifact,
          duplicateCount: preview.duplicate_matches.length,
          conflictCount: preview.conflict_matches.length,
          approvalState: "rejected",
          relatedRecords: preview.related_records,
        })
      : null;
  return createResultBase({
    status: "rejected",
    committed: false,
    request: preview.request,
    policyVerdict: preview.policy_verdict,
    pipelineStages: [
      ...preview.pipeline_stages.slice(0, 7),
      buildStage("commit-path", "skipped", ["user rejected preview"]),
      buildStage("audit-log-append", auditLogPath ? "ok" : "skipped", auditLogPath ? [auditLogPath] : ["no audit path"]),
      buildStage("memory-index-update", "skipped", ["preview was rejected"]),
    ],
    relatedRecords: preview.related_records,
    duplicateMatches: preview.duplicate_matches,
    conflictMatches: preview.conflict_matches,
    scopeWarnings: preview.scope_warnings,
    recordDisposition: preview.record_disposition,
    stagingArtifact: preview.staging_artifact,
    approval: buildApproval({ required: true, state: "rejected" }),
    targetFile,
    auditLogPath,
    warnings: preview.warnings,
    errors: preview.errors,
  });
}

export { loadRequestFile };
export { buildMemoryCandidateReport } from "./candidate.js";
