import {
  buildLifecycleCommand,
  buildReviewRemediationAction,
  buildRunCommandRemediationAction,
  collectLifecycleReasonCodes,
  dedupeRemediationActions,
} from "../semantics.ts";
import {
  PREVIEW_OPERATION_KINDS,
  PREVIEW_PLAN_SCHEMA_VERSION,
  loadPackCatalogRecords,
  loadPackManifestRecords,
  selectPackManifestRecords,
  validatePreviewPlan,
} from "@pairslash/spec-core";
import {
  CONFIG_MUTATION_SURFACES,
  MUTATING_OPERATION_KINDS,
  POLICY_PRECEDENCE,
  REASON_CODE_INSTALL_STATE_INVALID,
  REASON_CODE_INSTALL_STATE_METADATA_MISMATCH,
  REASON_CODE_MANAGED_ORPHAN_OVERRIDE,
  REASON_CODE_MANAGED_OVERRIDE,
  REASON_CODE_MANAGED_PACK_REQUIRES_UPDATE,
  REASON_CODE_OWNERSHIP_METADATA_CONFLICT,
  REASON_CODE_RECONCILE_IDENTICAL,
  REASON_CODE_RECONCILE_OVERRIDE,
  REASON_CODE_UNMANAGED_CONFLICT,
  REASON_CODE_UPDATE_CONFLICT,
  RISKY_MUTATION_SURFACES,
  compilePackForRuntime,
  uniqueSorted,
} from "./helpers.ts";

export function buildPreviewInstallAction({ runtime, target, packId, preferred = false }: { runtime?: string; target?: any; packId?: string; preferred?: any }) {
  return buildRunCommandRemediationAction({
    actionId: `preview-install:${runtime}:${target}:${packId}`,
    summary: "Review the install preview before applying changes.",
    command: buildLifecycleCommand({
      action: "preview install",
      runtime,
      target,
      packId,
    }),
    appliesToActions: ["doctor", "install"],
    reasonCodes: [
      REASON_CODE_RECONCILE_IDENTICAL,
      REASON_CODE_RECONCILE_OVERRIDE,
      REASON_CODE_UNMANAGED_CONFLICT,
      REASON_CODE_OWNERSHIP_METADATA_CONFLICT,
    ],
    preferred,
  });
}

export function buildPreviewUpdateAction({ runtime, target, packId, preferred = false }: { runtime?: string; target?: any; packId?: string; preferred?: any }) {
  return buildRunCommandRemediationAction({
    actionId: `preview-update:${runtime}:${target}:${packId}`,
    summary: "Review the update preview for the already managed pack.",
    command: buildLifecycleCommand({
      action: "update",
      runtime,
      target,
      packId,
      dryRun: true,
    }),
    appliesToActions: ["doctor", "install", "update"],
    reasonCodes: [
      REASON_CODE_MANAGED_PACK_REQUIRES_UPDATE,
      REASON_CODE_MANAGED_OVERRIDE,
      REASON_CODE_MANAGED_ORPHAN_OVERRIDE,
      REASON_CODE_UPDATE_CONFLICT,
      REASON_CODE_OWNERSHIP_METADATA_CONFLICT,
    ],
    preferred,
  });
}

export function buildStateReviewAction({ runtime, target, statePath, preferred = false }: { runtime?: string; target?: any; statePath?: string; preferred?: any }) {
  return buildReviewRemediationAction({
    actionId: `review-state:${runtime}:${target}`,
    summary: "Review and repair or remove the stale PairSlash install-state file before retrying.",
    path: statePath,
    appliesToActions: ["doctor", "install", "update", "uninstall"],
    reasonCodes: [REASON_CODE_INSTALL_STATE_INVALID, REASON_CODE_INSTALL_STATE_METADATA_MISMATCH],
    preferred,
  });
}

export function manifestSelection(repoRoot: string, requestedPacks: any = []) {
  const records = loadPackManifestRecords(repoRoot);
  const catalogRecords = loadPackCatalogRecords(repoRoot, { includeAdvanced: false });
  const inScopePackIds =
    requestedPacks.length > 0
      ? requestedPacks
      : catalogRecords.map((record: any) => record.id);
  const { valid, invalid, missing } = selectPackManifestRecords(records, inScopePackIds);
  const errors: string[] = [];

  for (const record of invalid) {
    errors.push(`manifest-invalid:${record.packId}: ${record.error}`);
  }
  for (const packId of missing) {
    errors.push(`pack-not-found: ${packId}`);
  }

  return {
    selection: valid.map((record: any) => ({
      manifestPath: record.manifestPath,
      manifest: record.manifest,
    })),
    errors,
  };
}

export function createSummary(operations: any) {
  const base = Object.fromEntries(PREVIEW_OPERATION_KINDS.map((kind: string) => [kind, 0]));
  for (const operation of operations) {
    base[operation.kind] += 1;
  }
  return base;
}

export function sortOperations(operations: any) {
  return operations
    .slice()
    .sort((left: any, right: any) =>
      [
        left.pack_id ?? "",
        left.absolute_path ?? "",
        left.relative_path ?? "",
        left.kind ?? "",
      ]
        .join("\u0000")
        .localeCompare(
          [
            right.pack_id ?? "",
            right.absolute_path ?? "",
            right.relative_path ?? "",
            right.kind ?? "",
          ].join("\u0000"),
        ),
    );
}

export function toChangeKind(operationKind: any) {
  if (operationKind === "create") {
    return "create";
  }
  if (operationKind === "replace") {
    return "update";
  }
  if (operationKind === "remove") {
    return "delete";
  }
  return "none";
}

export function buildAssetDiff({ operations, runtime }: { operations?: any; runtime?: string }) {
  const mutating = operations.filter((operation: any) => MUTATING_OPERATION_KINDS.has(operation.kind));
  const runtimeTargetedOutputs = mutating
    .map((operation: any) => ({
      runtime,
      operation: toChangeKind(operation.kind),
      pack_id: operation.pack_id,
      path: operation.relative_path ?? operation.absolute_path,
      install_surface: operation.install_surface ?? "unknown",
      asset_kind: operation.asset_kind ?? "unknown",
    }))
    .sort((left: any, right: any) =>
      `${left.pack_id}\u0000${left.path}\u0000${left.operation}`.localeCompare(
        `${right.pack_id}\u0000${right.path}\u0000${right.operation}`,
      ),
    );
  const configFragmentsAffected = runtimeTargetedOutputs
    .filter((entry: any) => CONFIG_MUTATION_SURFACES.has(entry.install_surface))
    .map((entry: any) => `${entry.pack_id}/${entry.path}`);
  const riskyMutations = runtimeTargetedOutputs
    .filter((entry: any) => RISKY_MUTATION_SURFACES.has(entry.install_surface))
    .map((entry: any) => `${entry.operation}:${entry.pack_id}/${entry.path}`);

  return {
    create_count: mutating.filter((operation: any) => operation.kind === "create").length,
    update_count: mutating.filter((operation: any) => operation.kind === "replace").length,
    delete_count: mutating.filter((operation: any) => operation.kind === "remove").length,
    mutating_operation_count: mutating.length,
    runtime_targeted_outputs: runtimeTargetedOutputs,
    config_fragments_affected: uniqueSorted(configFragmentsAffected),
    risky_mutations: uniqueSorted(riskyMutations),
  };
}

export function pickOverallVerdict(verdicts: any) {
  if (verdicts.length === 0) {
    return "allow";
  }
  return verdicts.reduce((current: any, candidate: any) =>
    POLICY_PRECEDENCE[candidate as keyof typeof POLICY_PRECEDENCE] > POLICY_PRECEDENCE[current as keyof typeof POLICY_PRECEDENCE] ? candidate : current, "allow");
}

export function buildPolicySummary({ lintReport, errors }: { lintReport?: any; errors: string[] }) {
  const packVerdicts = (lintReport?.policy_verdicts ?? [])
    .map((verdict: any) => ({
      pack_id: verdict.pack_id ?? null,
      runtime: verdict.runtime,
      verdict: verdict.overall_verdict,
      reason_codes: uniqueSorted((verdict.reasons ?? []).map((reason: any) => reason.code)),
    }))
    .sort((left: any, right: any) =>
      `${left.pack_id ?? ""}\u0000${left.runtime}\u0000${left.verdict}`.localeCompare(
        `${right.pack_id ?? ""}\u0000${right.runtime}\u0000${right.verdict}`,
      ),
    );
  const lintReasons = (lintReport?.issues ?? [])
    .filter((issue: any) => issue.result === "error")
    .filter((issue: any) => issue.code.startsWith("LINT-POLICY") || issue.code.startsWith("LINT-RUNTIME"))
    .map((issue: any) => `${issue.code}:${issue.pack_id ?? "global"}:${issue.runtime}`);
  const unsupportedRuntimeCapability =
    errors.some((entry: any) => entry.startsWith("runtime-unavailable:")) ||
    errors.some((entry: any) => entry.startsWith("runtime-mismatch:")) ||
    errors.some((entry: any) => entry.startsWith("runtime-version-unsupported:")) ||
    (lintReport?.issues ?? []).some((issue: any) => issue.code === "LINT-RUNTIME-004" && issue.result === "error");
  const reasons = uniqueSorted([
    ...lintReasons,
    ...(unsupportedRuntimeCapability ? ["unsupported-runtime-capability:no-silent-fallback"] : []),
  ]);

  let overallVerdict = pickOverallVerdict(packVerdicts.map((entry: any) => entry.verdict));
  if (errors.length > 0) {
    overallVerdict = "deny";
  }

  return {
    machine_readable: true,
    overall_verdict: overallVerdict,
    pack_verdicts: packVerdicts,
    no_silent_fallback: true,
    unsupported_runtime_capability: unsupportedRuntimeCapability,
    reasons,
    summary:
      unsupportedRuntimeCapability
        ? "Unsupported runtime/capability is blocked explicitly; no silent fallback is allowed."
        : `Policy verdict for preview is ${overallVerdict}.`,
  };
}

export function buildCommitability({
  operations,
  errors,
  policySummary,
  requiresConfirmation,
  reasonCodes = [],
}: { operations?: any; errors: string[]; policySummary?: any; requiresConfirmation?: any; reasonCodes?: any }) {
  const blockedOperations = operations.filter((operation: any) => operation.kind === "blocked_conflict");
  const mutatingOperations = operations.filter((operation: any) => MUTATING_OPERATION_KINDS.has(operation.kind));
  const canProceed =
    errors.length === 0 &&
    blockedOperations.length === 0 &&
    policySummary.overall_verdict !== "deny";
  const needsExplicitApproval =
    requiresConfirmation ||
    policySummary.overall_verdict === "ask" ||
    policySummary.overall_verdict === "require-preview";
  const blockedReasons = uniqueSorted([
    ...errors,
    ...blockedOperations.map((operation: any) => operation.reason),
    ...policySummary.reasons,
  ]);
  const blockedReasonCodes = collectLifecycleReasonCodes({
    reasonCodes,
    operations: blockedOperations,
  });

  return {
    status: canProceed ? (needsExplicitApproval ? "needs-explicit-approval" : "proceedable") : "blocked",
    can_proceed: canProceed,
    blocked: !canProceed,
    needs_explicit_approval: needsExplicitApproval,
    can_proceed_operations: canProceed
      ? uniqueSorted(
          mutatingOperations.map(
            (operation: any) => `${toChangeKind(operation.kind)}:${operation.pack_id}/${operation.relative_path ?? "."}`,
          ),
        )
      : [],
    blocked_operations_count: blockedOperations.length,
    blocked_reasons: blockedReasons,
    blocked_reason_codes: blockedReasonCodes,
    explicit_approval_hint: needsExplicitApproval ? "Run the same action with --apply and explicit confirmation." : null,
  };
}

export function createPlan({
  action,
  runtime,
  target,
  skillRoot = "runtime-default",
  emit = "skill",
  installRoot,
  statePath,
  operations,
  selectedPacks,
  lintReport = null,
  trustDelta = null,
  warnings = [],
  errors = [],
  reasonCodes = [],
  remediationActions = [],
}: { action?: any; runtime?: string; target?: any; skillRoot?: any; emit?: string; installRoot?: string; statePath?: string; operations?: any; selectedPacks: string[]; lintReport?: any; trustDelta?: any; warnings?: string[]; errors?: string[]; reasonCodes?: any; remediationActions?: any }) {
  const sortedOperations = sortOperations(operations);
  const sortedWarnings = warnings.slice().sort((a: any, b: any) => a.localeCompare(b));
  const trustDeltaErrors = (trustDelta?.pack_changes ?? [])
    .filter((change: any) => change.blocking)
    .flatMap((change: any) => {
      const reasons = change.reasons?.length ? change.reasons : ["blocked-trust-change"];
      return reasons.map((reason: any) => `trust-delta-blocked:${change.pack_id}:${reason}`);
    });
  const sortedErrors = [...errors, ...trustDeltaErrors].sort((a: any, b: any) => a.localeCompare(b));
  const requiresConfirmation = ["install", "update", "uninstall"].includes(action);
  const assetDiff = buildAssetDiff({ operations: sortedOperations, runtime });
  const policySummary = buildPolicySummary({
    lintReport,
    errors: sortedErrors,
  });
  const commitability = buildCommitability({
    operations: sortedOperations,
    errors: sortedErrors,
    policySummary,
    requiresConfirmation,
    reasonCodes,
  });
  const lifecycleReasonCodes = collectLifecycleReasonCodes({
    reasonCodes,
    operations: sortedOperations,
  });
  const planRemediationActions = dedupeRemediationActions([
    ...remediationActions,
    ...sortedOperations.flatMap((operation: any) => operation.remediation_actions ?? []),
  ]);
  const plan: any = {
    kind: "preview-plan",
    schema_version: PREVIEW_PLAN_SCHEMA_VERSION,
    action,
    runtime,
    target,
    skill_root: skillRoot,
    emit,
    install_root: installRoot,
    state_path: statePath,
    can_apply:
      sortedErrors.length === 0 &&
      sortedOperations.every((operation: any) => operation.kind !== "blocked_conflict") &&
      policySummary.overall_verdict !== "deny",
    requires_confirmation: requiresConfirmation,
    selected_packs: selectedPacks.slice().sort((a: any, b: any) => a.localeCompare(b)),
    summary: createSummary(sortedOperations),
    warnings: sortedWarnings,
    errors: sortedErrors,
    reason_codes: lifecycleReasonCodes,
    remediation_actions: planRemediationActions,
    operations: sortedOperations,
    asset_diff: assetDiff,
    policy_summary: policySummary,
    ...(trustDelta ? { trust_delta: trustDelta } : {}),
    commitability: commitability,
    preview_boundary: {
      preview_only: true,
      no_commit_on_preview: true,
      commit_path: `pairslash ${action} ... --apply`,
      note: "Preview is deterministic and does not write assets/config/memory.",
    },
  };
  const validationErrors = validatePreviewPlan(plan);
  if (validationErrors.length > 0) {
    throw new Error(`invalid ${action} preview plan :: ${validationErrors.join("; ")}`);
  }
  return plan;
}

export function buildOperation(kind: string, {
    packId,
    relativePath = null,
    absolutePath,
    reason,
    assetKind = null,
    installSurface = null,
    ownership = null,
    overrideEligible = null,
    reasonCode = null,
    reasonDetail = null,
    managementMode = null,
    reconcileMode = null,
    remediationActions = [],
  }: { packId?: string; relativePath?: string | null; absolutePath?: any; reason?: any; assetKind?: any; installSurface?: any; ownership?: any; overrideEligible?: any; reasonCode?: any; reasonDetail?: any; managementMode?: any; reconcileMode?: any; remediationActions?: any }) {
  return {
    kind,
    pack_id: packId,
    ...(relativePath ? { relative_path: relativePath } : {}),
    absolute_path: absolutePath,
    ...(assetKind ? { asset_kind: assetKind } : {}),
    ...(installSurface ? { install_surface: installSurface } : {}),
    ...(ownership ? { ownership } : {}),
    ...(typeof overrideEligible === "boolean" ? { override_eligible: overrideEligible } : {}),
    ...(reasonCode ? { reason_code: reasonCode } : {}),
    ...(reasonDetail ? { reason_detail: reasonDetail } : {}),
    ...(managementMode ? { management_mode: managementMode } : {}),
    ...(reconcileMode ? { reconcile_mode: reconcileMode } : {}),
    ...(remediationActions.length > 0
      ? { remediation_actions: dedupeRemediationActions(remediationActions) }
      : {}),
    reason,
  };
}

export function compileSelection({ repoRoot, runtime, selection, errors, emit = "skill" }: { repoRoot: string; runtime?: string; selection?: any; errors: string[]; emit?: string }) {
  const compiled: any[] = [];
  for (const { manifestPath, manifest } of selection) {
    try {
      compiled.push(
        compilePackForRuntime({
          repoRoot,
          manifestPath,
          runtime,
          emitMode: emit === "plugin" ? "plugin" : undefined,
        }),
      );
    } catch (error) {
      errors.push(`compile-failed:${manifest.pack.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return compiled.sort((left: any, right: any) => left.pack_id.localeCompare(right.pack_id));
}
