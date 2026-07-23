// PairSlash CLI command handlers.
//
// Phase M1 (modernization foundation): extracted from bin/pairslash.js.
// No behavioral change — the existing cli.test.js suite is the contract.

import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";

import { stableJson } from "@pairslash/spec-core";
import {
  applyMemoryWrite,
  buildMemoryAuditReport,
  buildMemoryCandidateReport,
  loadRequestFile,
  loadStagedMemoryWritePreview,
  previewMemoryWrite,
  rejectMemoryWrite,
} from "@pairslash/memory-engine";

import {
  applyInstall,
  applyUninstall,
  applyUpdate,
  assertLifecycleAction,
  assertRuntime,
  buildLifecycleEnvelope,
  emit,
  materializePlan,
  resolveExecutionRuntime,
} from "./internals.ts";
import {
  formatInstallResult,
  formatMemoryAuditReportText,
  formatMemoryCandidateReportText,
  formatMemoryWritePreviewBlockedText,
  formatMemoryWritePreviewText,
  formatMemoryWriteResultText,
  formatPreviewPlanText,
} from "./formatters.ts";

export function buildMemoryRequest(repoRoot, options) {
  const requestFromFile = options.requestPath ? loadRequestFile(resolve(repoRoot, options.requestPath)) : {};
  return {
    ...requestFromFile,
    ...(options.recordKind ? { kind: options.recordKind } : {}),
    ...(options.title ? { title: options.title } : {}),
    ...(options.statement ? { statement: options.statement } : {}),
    ...(options.evidence ? { evidence: options.evidence } : {}),
    ...(options.scope ? { scope: options.scope } : {}),
    ...(options.scopeDetail ? { scope_detail: options.scopeDetail } : {}),
    ...(options.confidence ? { confidence: options.confidence } : {}),
    ...(options.recordAction ? { action: options.recordAction } : {}),
    ...(options.tags.length > 0 ? { tags: options.tags } : {}),
    ...(options.sourceRefs.length > 0 ? { source_refs: options.sourceRefs } : {}),
    ...(options.supersedes ? { supersedes: options.supersedes } : {}),
    ...(options.updatedBy ? { updated_by: options.updatedBy } : {}),
  };
}

export function buildMemoryCandidateInput(options) {
  return {
    taskScope: options.taskScope,
    evidenceSources: options.evidenceSources,
    strictness: options.strictness,
    maxCandidates: options.maxCandidates,
  };
}

export function buildMemoryAuditInput(options) {
  return {
    auditScope: options.auditScope,
    mode: options.mode,
    focus: options.focus,
  };
}

export async function confirmApply({ action, stdin, stdout, options }) {
  if (options.yes) {
    return;
  }
  if (options.nonInteractive || !stdin?.isTTY || !stdout?.isTTY) {
    throw new Error("confirmation-required: rerun with --yes or use an interactive terminal");
  }
  const rl = createInterface({
    input: stdin,
    output: stdout,
  });
  try {
    const answer = await rl.question(`Type '${action}' to confirm: `);
    if (answer.trim() !== action) {
      throw new Error(`confirmation-denied: expected '${action}'`);
    }
  } finally {
    rl.close();
  }
}

export async function confirmMemoryWrite({ stdin, stdout, options }) {
  if (options.yes) {
    return true;
  }
  if (options.nonInteractive || !stdin?.isTTY || !stdout?.isTTY) {
    throw new Error("confirmation-required: rerun with --yes or use an interactive terminal");
  }
  const rl = createInterface({
    input: stdin,
    output: stdout,
  });
  try {
    const answer = await rl.question("Type 'write-global' to confirm: ");
    return answer.trim() === "write-global";
  } finally {
    rl.close();
  }
}

export function handlePreview(action, repoRoot, options, stdout) {
  if (action === "memory-write-global") {
    throw new Error("memory-write-global preview requires interactive handler");
  }
  assertRuntime(options.runtime);
  if (options.force) {
    throw new Error("unsupported-flag: --force is not available in Phase 4");
  }
  const envelope = buildLifecycleEnvelope(action, repoRoot, options);
  const plan = materializePlan(repoRoot, envelope.plan, options.planOut);
  emit(stdout, plan, {
    format: options.format,
    text: formatPreviewPlanText,
  });
  return {
    exitCode: plan.can_apply ? 0 : 1,
    artifact: plan,
    runtime: plan.runtime ?? options.runtime,
    target: plan.target ?? options.target,
    summary: `${action} preview ${plan.can_apply ? "ready" : "blocked"}`,
  };
}

export async function handleApply(action, repoRoot, options, stdout, stdin) {
  assertRuntime(options.runtime);
  assertLifecycleAction(action);
  if (options.apply && options.dryRun) {
    throw new Error("--apply and --dry-run cannot be used together");
  }
  if (options.force) {
    throw new Error("unsupported-flag: --force is not available in Phase 4");
  }
  const envelope = buildLifecycleEnvelope(action, repoRoot, options);
  const plan = materializePlan(repoRoot, envelope.plan, options.planOut);
  if (!options.apply || options.preview) {
    emit(stdout, plan, {
      format: options.format,
      text: formatPreviewPlanText,
    });
    return {
      exitCode: plan.can_apply ? 0 : 1,
      artifact: plan,
      runtime: plan.runtime ?? options.runtime,
      target: plan.target ?? options.target,
      summary: `${action} preview ${plan.can_apply ? "ready" : "blocked"}`,
    };
  }
  if (!plan.can_apply) {
    emit(stdout, plan, {
      format: options.format,
      text: formatPreviewPlanText,
    });
    return {
      exitCode: 1,
      artifact: plan,
      runtime: plan.runtime ?? options.runtime,
      target: plan.target ?? options.target,
      summary: `${action} blocked by preview plan`,
    };
  }
  await confirmApply({ action, stdin, stdout, options });
  const result =
    action === "install"
      ? applyInstall(envelope)
      : action === "update"
        ? applyUpdate(envelope)
        : applyUninstall(envelope);
  emit(stdout, result, {
    format: options.format,
    text:
      action === "install" || action === "update" || action === "uninstall"
        ? formatInstallResult
        : (value) => `${stableJson(value)}`,
  });
  return {
    exitCode: 0,
    artifact: result,
    runtime: result.runtime ?? options.runtime,
    target: result.target ?? options.target,
    summary: `${action} applied`,
  };
}

export async function handleMemoryWrite(repoRoot, options, stdout, stdin, { forcePreview = false } = {}) {
  const request = buildMemoryRequest(repoRoot, options);
  const runtime = resolveExecutionRuntime(repoRoot, options.runtime, options.target);
  const target = options.target;
  if (!options.apply || options.preview || forcePreview) {
    try {
      const preview = previewMemoryWrite({
        repoRoot,
        request,
        runtime,
        target,
      });
      emit(stdout, preview, {
        format: options.format,
        text: formatMemoryWritePreviewText,
      });
      return {
        exitCode: preview.ready_for_apply ? 0 : 1,
        artifact: preview,
        runtime: preview.runtime,
        target: preview.target,
        summary: `memory preview ${preview.ready_for_apply ? "ready" : "blocked"}`,
      };
    } catch (error) {
      const blockedPreview = {
        kind: "memory-write-preview-blocked",
        runtime,
        target,
        blocked: true,
        no_silent_fallback: true,
        errors: [error.message],
        notes: ["invalid request source data blocks preview; no silent fallback"],
        request,
      };
      emit(stdout, blockedPreview, {
        format: options.format,
        text: formatMemoryWritePreviewBlockedText,
      });
      return {
        exitCode: 1,
        artifact: blockedPreview,
        runtime,
        target,
        summary: "memory preview blocked",
      };
    }
  }
  const stagedPreview = loadStagedMemoryWritePreview({
    repoRoot,
    request,
    runtime,
    target,
  });
  if (stagedPreview && options.format === "text") {
    emit(stdout, stagedPreview, {
      format: options.format,
      text: formatMemoryWritePreviewText,
    });
  }
  if (!stagedPreview?.ready_for_apply) {
    const blocked = applyMemoryWrite({
      repoRoot,
      request,
      runtime,
      target,
    });
    emit(stdout, blocked, {
      format: options.format,
      text: formatMemoryWriteResultText,
    });
    return {
      exitCode: blocked.committed ? 0 : 1,
      artifact: blocked,
      runtime: blocked.runtime,
      target: blocked.target,
      summary: `memory apply ${blocked.status}`,
    };
  }
  const confirmed = await confirmMemoryWrite({ stdin, stdout, options });
  if (!confirmed) {
    const rejected = rejectMemoryWrite({
      repoRoot,
      request,
      runtime,
      target,
    });
    emit(stdout, rejected, {
      format: options.format,
      text: formatMemoryWriteResultText,
    });
    return {
      exitCode: 1,
      artifact: rejected,
      runtime: rejected.runtime,
      target: rejected.target,
      summary: "memory preview rejected",
    };
  }
  const result = applyMemoryWrite({
    repoRoot,
    request,
    runtime,
    target,
  });
  emit(stdout, result, {
    format: options.format,
    text: formatMemoryWriteResultText,
  });
  return {
    exitCode: result.committed ? 0 : 1,
    artifact: result,
    runtime: result.runtime,
    target: result.target,
    summary: `memory apply ${result.status}`,
  };
}

export function handleMemoryCandidate(repoRoot, options, stdout) {
  if (options.apply || options.preview || options.dryRun) {
    throw new Error("unsupported-flag: memory candidate is read-only and does not support --apply/--preview/--dry-run");
  }
  const runtime = resolveExecutionRuntime(repoRoot, options.runtime, options.target);
  const target = options.target;
  const input = buildMemoryCandidateInput(options);
  const report = buildMemoryCandidateReport({
    repoRoot,
    runtime,
    target,
    ...input,
  });
  emit(stdout, report, {
    format: options.format,
    text: formatMemoryCandidateReportText,
  });
  return {
    exitCode: 0,
    artifact: report,
    runtime: report.runtime,
    target: report.target,
    summary: `memory candidate generated ${report.candidates.length} item(s)`,
  };
}

export function handleMemoryAudit(repoRoot, options, stdout) {
  if (options.apply || options.preview || options.dryRun) {
    throw new Error("unsupported-flag: memory audit is read-only and does not support --apply/--preview/--dry-run");
  }
  const runtime = resolveExecutionRuntime(repoRoot, options.runtime, options.target);
  const target = options.target;
  const input = buildMemoryAuditInput(options);
  const report = buildMemoryAuditReport({
    repoRoot,
    runtime,
    target,
    ...input,
  });
  emit(stdout, report, {
    format: options.format,
    text: formatMemoryAuditReportText,
  });
  return {
    exitCode: 0,
    artifact: report,
    runtime: report.runtime,
    target: report.target,
    summary: `memory audit generated ${report.findings.length} finding(s)`,
  };
}
