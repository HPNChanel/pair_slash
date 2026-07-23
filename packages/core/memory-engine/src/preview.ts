import {
  MEMORY_WRITE_PREVIEW_SCHEMA_VERSION,
  validateMemoryWritePreview,
} from "@pairslash/spec-core";

import {
  buildApproval,
  buildArtifactReference,
} from "./internal.ts";
import { summarizeEntry } from "./conflict.ts";
import {
  buildCommonAnalysis,
  createPreviewFromArtifact,
  loadStagingArtifactForRequest,
  persistStagingArtifact,
} from "./pipeline.ts";
import { buildRequest, resolveContract } from "./request.ts";

export function previewMemoryWrite({
  repoRoot,
  request,
  runtime = "codex_cli",
  target = "repo",
  requestSource = "cli",
  policyContext = {},
}: any = {}) {
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
}: any = {}) {
  const artifact = loadStagingArtifactForRequest({
    repoRoot,
    request,
    runtime,
    target,
    requestSource,
  });
  return artifact ? createPreviewFromArtifact(artifact) : null;
}
