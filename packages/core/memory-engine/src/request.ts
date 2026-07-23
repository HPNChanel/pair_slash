import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import YAML from "yaml";

import {
  AUDIT_LOG_ENTRY_SCHEMA_VERSION,
  MEMORY_WRITE_REQUEST_SCHEMA_VERSION,
  ensureDir,
  exists,
  normalizeRuntime,
  normalizeTarget,
  stableYaml,
  validateAuditLogEntry,
  validateMemoryWriteRequest,
  validatePackManifestV2,
  writeTextFile,
} from "@pairslash/spec-core";
import { buildMemoryWriteContract } from "@pairslash/contract-engine";

import {
  ALLOWED_RECORD_FIELDS,
  buildStage,
  normalizeStringList,
} from "./internal.ts";
import { loadRequestFile, nextAvailablePath } from "./records.ts";

export function loadManifest(repoRoot) {
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

export function normalizeRequestRecord(request: any = {}) {
  const unknownFields = Object.keys(request).filter((field) => !ALLOWED_RECORD_FIELDS.has(field));
  const record: any = {
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

export function buildRequestIdentity({ runtime, target, requestSource, normalizedRecord, rawRequest }: any) {
  const identityRecord: any = {
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

export function buildRequest({ request, runtime, target, requestSource = "cli" }) {
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

export function resolveContract(repoRoot, runtime, target) {
  const manifest = loadManifest(repoRoot);
  return buildMemoryWriteContract({
    manifest,
    runtime,
    target,
  });
}

export function buildPreviewPatch(request, relativeTargetFile) {
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

export function buildAuditEntry({
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

export { buildStage, loadRequestFile };
