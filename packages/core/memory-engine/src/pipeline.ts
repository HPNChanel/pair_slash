import { dirname } from "node:path";

import { readFileSync } from "node:fs";

import YAML from "yaml";

import {
  MEMORY_WRITE_PREVIEW_SCHEMA_VERSION,
  MEMORY_WRITE_RESULT_SCHEMA_VERSION,
  MEMORY_WRITE_STAGING_SCHEMA_VERSION,
  ensureDir,
  exists,
  stableYaml,
  validateMemoryWritePreview,
  validateMemoryWriteResult,
  validateMemoryWriteStagingArtifact,
  writeTextFile,
} from "@pairslash/spec-core";
import { evaluatePolicy } from "@pairslash/policy-engine";

import {
  authorityErrors,
  buildArtifactPath,
  buildArtifactReference,
  buildRecordId,
  buildStage,
  stableHash,
} from "./internal.ts";
import {
  collectRelatedRecords,
  detectConflicts,
  detectDuplicates,
  detectShadowWarnings,
  findCandidateConflicts,
  findSupersedeTarget,
  resolveTargetRelativeFile,
  summarizeEntry,
} from "./conflict.ts";
import { buildPreviewPatch, buildRequest } from "./request.ts";
import { loadExistingRecords } from "./records.ts";

export function buildCommonAnalysis({
  repoRoot,
  payload,
  requestIdentity,
  requestErrors,
  contract,
  policyContext = {},
}: any) {
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

export function persistStagingArtifact({
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

export function loadStagingArtifactForRequest({
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

export function createPreviewFromArtifact(artifact) {
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

export function createResultBase({
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

// Re-export for the apply module.
export { summarizeEntry };
