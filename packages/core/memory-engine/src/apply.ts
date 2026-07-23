import { evaluatePolicy } from "@pairslash/policy-engine";

import {
  buildApproval,
  buildArtifactReference,
  buildStage,
} from "./internal.ts";
import { summarizeEntry } from "./conflict.ts";
import {
  buildCommonAnalysis,
  createPreviewFromArtifact,
  createResultBase,
  loadStagingArtifactForRequest,
} from "./pipeline.ts";
import { buildAuditEntry, buildRequest, buildRequestIdentity, resolveContract } from "./request.ts";
import { writeAuthoritativeRecord } from "./records.ts";
import {
  loadStagedMemoryWritePreview,
  previewMemoryWrite,
} from "./preview.ts";

export function applyMemoryWrite({
  repoRoot,
  request,
  runtime = "codex_cli",
  target = "repo",
  requestSource = "cli",
  policyContext = {},
}: any = {}) {
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
}: any = {}) {
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
