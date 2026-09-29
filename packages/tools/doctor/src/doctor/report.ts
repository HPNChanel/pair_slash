import {
  collectLifecycleReasonCodes,
  dedupeRemediationActions,
} from "@pairslash/installer";
import {
  SUPPORTED_TARGETS,
  exists,
  selectDefaultCatalogPack,
} from "@pairslash/spec-core";
import {
  listTraceIndexes,
  loadRetentionState,
  resolveRetentionPolicy,
  resolveTelemetryMode,
  resolveTraceRoot,
} from "@pairslash/trace";
import {
  dirname,
} from "node:path";
import {
  describeTrustPosture,
  normalizePackTrustReceipt,
} from "./checks/trust-posture.ts";
import {
  ISSUE_STATUSES,
  REASON_CODE_MANAGED_ORPHAN_OVERRIDE,
  REASON_CODE_MANAGED_OVERRIDE,
  REASON_CODE_OWNERSHIP_METADATA_CONFLICT,
  REASON_CODE_RECONCILE_IDENTICAL,
  REASON_CODE_RECONCILE_OVERRIDE,
  REASON_CODE_UNINSTALL_PRESERVE_UNMANAGED,
  REASON_CODE_UNMANAGED_CONFLICT,
  REMEDIATION_DECISION_ABORT,
  REMEDIATION_DECISION_RECONCILE,
  REMEDIATION_DECISION_REPAIR,
  REMEDIATION_STATUS_ADVISORY,
  REMEDIATION_STATUS_BLOCKED,
  REMEDIATION_STATUS_NONE,
  buildIssueCode,
  isWritablePath,
  workflowMaturityRank,
} from "./helpers.ts";

export function buildRuntimeCompatibility(context: any, checks: any) {
  const versionCheck = checks.find((check: any) => check.id === "runtime.version_range");
  const incompatiblePackIds =
    versionCheck?.evidence?.mismatches?.map((entry: any) => entry.pack_id).sort((left: any, right: any) => left.localeCompare(right)) ?? [];
  const selectedPackCount = context.selectedManifests.length;
  const compatiblePackCount = Math.max(0, selectedPackCount - incompatiblePackIds.length);
  return {
    requested_runtime_range_max_status:
      versionCheck?.status === "fail"
        ? "mismatch"
        : versionCheck?.status === "warn" || versionCheck?.status === "skip"
          ? "unknown"
          : "supported",
    selected_pack_count: selectedPackCount,
    compatible_pack_count: compatiblePackCount,
    incompatible_pack_ids: incompatiblePackIds,
  };
}

export function buildInstalledPacks(state: any) {
  if (!state) {
    return [];
  }
  return state.packs
    .map((pack: any) => ({
      ...(() => {
        const receipt = normalizePackTrustReceipt(pack);
        return {
          source_class: receipt.source_class,
          verification_status: receipt.verification_status,
          trust_tier: receipt.trust_tier ?? "local-dev",
          signature_status: receipt.signature_status ?? "missing",
          support_level: receipt.support_level ?? "local-dev",
          trust_note: describeTrustPosture(receipt),
        };
      })(),
      id: pack.id,
      version: pack.version,
      install_dir: pack.install_dir,
      local_overrides: pack.files.filter((file: any) => file.local_override).length,
    }))
    .sort((left: any, right: any) => left.id.localeCompare(right.id));
}

export function buildIssues(checks: any) {
  return checks
    .filter((check: any) => ISSUE_STATUSES.has(check.status))
    .map((check: any) => ({
      code: buildIssueCode(check.id),
      verdict: check.status,
      severity: check.status === "fail" || check.status === "unsupported" ? "fail" : "warn",
      check_id: check.id,
      summary: check.summary,
      evidence: check.evidence,
      suggested_fix: check.remediation,
      blocking_for_install: check.blocking_for_install,
      message: check.summary,
      remediation: check.remediation,
      reason_codes: collectLifecycleReasonCodes({
        reasonCodes: check.reason_codes ?? [],
      }),
      remediation_actions: dedupeRemediationActions(check.remediation_actions ?? []),
    }));
}

export function buildRemediationActions(checks: any, issues: any[]) {
  return dedupeRemediationActions([
    ...checks.flatMap((check: any) => check.remediation_actions ?? []),
    ...issues.flatMap((issue: any) => issue.remediation_actions ?? []),
  ]);
}

export function remediationDecisionForReasonCodes(reasonCodes: any) {
  if (
    reasonCodes.includes(REASON_CODE_UNMANAGED_CONFLICT) ||
    reasonCodes.includes(REASON_CODE_OWNERSHIP_METADATA_CONFLICT)
  ) {
    return REMEDIATION_DECISION_ABORT;
  }
  if (reasonCodes.includes(REASON_CODE_RECONCILE_IDENTICAL)) {
    return REMEDIATION_DECISION_RECONCILE;
  }
  if (
    reasonCodes.some((reasonCode: any) => [
      REASON_CODE_RECONCILE_OVERRIDE,
      REASON_CODE_MANAGED_OVERRIDE,
      REASON_CODE_MANAGED_ORPHAN_OVERRIDE,
      REASON_CODE_UNINSTALL_PRESERVE_UNMANAGED,
    ].includes(reasonCode))
  ) {
    return REMEDIATION_DECISION_RECONCILE;
  }
  return REMEDIATION_DECISION_REPAIR;
}

export function buildDoctorRemediation({ remediationActions, activeReasonCodes, installBlocked, issues }: { remediationActions?: any; activeReasonCodes?: any; installBlocked?: any; issues?: any[] }) {
  const normalizedActions = dedupeRemediationActions(remediationActions).map((action: any) => {
    const actionReasonCodes = collectLifecycleReasonCodes({
      reasonCodes: action.reason_codes ?? [],
    });
    const effectiveReasonCodes = collectLifecycleReasonCodes({
      reasonCodes:
        actionReasonCodes.filter((reasonCode: any) => activeReasonCodes.includes(reasonCode)).length > 0
          ? actionReasonCodes.filter((reasonCode: any) => activeReasonCodes.includes(reasonCode))
          : actionReasonCodes,
    });
    return {
      action_id: action.action_id,
      action_kind: action.action_kind,
      summary: action.summary,
      command: action.command ?? null,
      path: action.path ?? null,
      safe_without_write: action.safe_without_write,
      requires_preview: action.requires_preview,
      applies_to_actions: [...(action.applies_to_actions ?? [])],
      reason_codes: effectiveReasonCodes,
      preferred: action.preferred,
      decision: remediationDecisionForReasonCodes(effectiveReasonCodes),
    };
  });
  const commands: any[] = [];
  const seenCommands = new Set();
  for (const action of normalizedActions) {
    if (typeof action.command !== "string" || action.command.trim() === "") {
      continue;
    }
    const key = `${action.command}\u0000${action.decision}`;
    if (seenCommands.has(key)) {
      continue;
    }
    seenCommands.add(key);
    commands.push({
      action_id: action.action_id,
      summary: action.summary,
      command: action.command,
      applies_to_actions: [...action.applies_to_actions],
      reason_codes: [...action.reason_codes],
      safe_without_write: action.safe_without_write,
      requires_preview: action.requires_preview,
      preferred: action.preferred,
      decision: action.decision,
    });
  }
  const status = installBlocked
    ? REMEDIATION_STATUS_BLOCKED
    : commands.length > 0 || normalizedActions.length > 0 || (issues ?? []).length > 0
      ? REMEDIATION_STATUS_ADVISORY
      : REMEDIATION_STATUS_NONE;
  return {
    status,
    commands,
    actions: normalizedActions,
  };
}

export function buildNextActions(issues: any[], remediationActions: any = []) {
  const commandActions = remediationActions
    .filter((action: any) => typeof action.command === "string" && action.command.trim() !== "")
    .map((action: any) => action.command);
  if (commandActions.length > 0) {
    return [...new Set(commandActions)];
  }
  const deduped: any[] = [];
  const seen = new Set();
  for (const issue of issues) {
    if (!issue.suggested_fix || seen.has(issue.suggested_fix)) {
      continue;
    }
    seen.add(issue.suggested_fix);
    deduped.push(issue.suggested_fix);
  }
  return deduped.length > 0
    ? deduped
    : ["No action required. Environment is ready for PairSlash compatibility diagnostics."];
}

export function aggregateVerdict(checks: any) {
  if (checks.some((check: any) => check.status === "unsupported")) {
    return "unsupported";
  }
  if (checks.some((check: any) => check.status === "fail")) {
    return "fail";
  }
  if (checks.some((check: any) => check.status === "degraded")) {
    return "degraded";
  }
  if (checks.some((check: any) => check.status === "warn")) {
    return "warn";
  }
  return "pass";
}

export function buildEnvironmentSummary(context: any) {
  return {
    os: context.os,
    shell: context.shell,
    shell_profile_candidates: context.shellProfileCandidates,
    cwd: context.cwd,
    repo_root: context.repoRoot,
    config_home: context.configHome,
    install_root: context.installRoot,
    state_path: context.statePath,
    runtime_executable: context.detection.executable ?? null,
    runtime_version: context.detection.version ?? null,
    runtime_available: Boolean(context.detection.available),
  };
}

export function buildScopeProbes(context: any) {
  return Object.fromEntries(
    SUPPORTED_TARGETS.map((target: any) => [
      target,
      {
        ...context.scopeProbes[target],
      },
    ]),
  );
}

export function buildObservabilityHealth(repoRoot: string, runtime: string, target: any) {
  const traceRoot = resolveTraceRoot(repoRoot);
  const indexes = listTraceIndexes(repoRoot)
    .filter((entry: any) => (runtime ? entry.runtime === runtime : true))
    .filter((entry: any) => (target ? entry.target === target : true));
  const missingEventFiles = indexes.filter((entry: any) => !exists(entry.event_file)).length;
  const retentionState = loadRetentionState(repoRoot);
  const retentionPolicy = resolveRetentionPolicy(repoRoot);
  const writableProbePath = exists(traceRoot) ? traceRoot : dirname(traceRoot);
  return {
    trace_root_exists: exists(traceRoot),
    trace_root_writable: isWritablePath(writableProbePath),
    index_event_consistent: missingEventFiles === 0,
    missing_event_files: missingEventFiles,
    retention_last_pruned_at: retentionState?.last_pruned_at ?? null,
    retention_policy: retentionPolicy,
  };
}

export function buildRecentTraceSummary(repoRoot: string, runtime: string, target: any) {
  const indexes = listTraceIndexes(repoRoot)
    .filter((entry: any) => (runtime ? entry.runtime === runtime : true))
    .filter((entry: any) => (target ? entry.target === target : true))
    .sort((left: any, right: any) => (right.started_at ?? "").localeCompare(left.started_at ?? ""))
    .slice(0, 5);
  return {
    telemetry_mode: resolveTelemetryMode(repoRoot),
    session_count: indexes.length,
    latest_session_id: indexes[0]?.session_id ?? null,
    latest_outcome: indexes[0]?.last_outcome ?? null,
    latest_failure_domain: indexes[0]?.decisive_failure_domain ?? null,
    retention_last_pruned_at: loadRetentionState(repoRoot)?.last_pruned_at ?? null,
  };
}

export function buildCatalogRecordMap(catalogRecords: any) {
  return new Map((catalogRecords ?? []).map((record: any) => [record.id, record]));
}

export function compareRecommendationPriority(left: any, right: any) {
  const leftEffectiveRank = workflowMaturityRank(left.effective_workflow_maturity);
  const rightEffectiveRank = workflowMaturityRank(right.effective_workflow_maturity);
  if (leftEffectiveRank !== rightEffectiveRank) {
    return rightEffectiveRank - leftEffectiveRank;
  }
  if (left.workflow_maturity_blocked !== right.workflow_maturity_blocked) {
    return left.workflow_maturity_blocked ? 1 : -1;
  }
  if (left.default_recommendation !== right.default_recommendation) {
    return left.default_recommendation ? -1 : 1;
  }
  const leftAssignedRank = workflowMaturityRank(left.workflow_maturity);
  const rightAssignedRank = workflowMaturityRank(right.workflow_maturity);
  if (leftAssignedRank !== rightAssignedRank) {
    return rightAssignedRank - leftAssignedRank;
  }
  return left.id.localeCompare(right.id);
}

export function sortPackIdsForRecommendation(context: any, packIds: string[]) {
  const catalogByPackId = buildCatalogRecordMap(context.catalogRecords);
  return [...new Set(packIds)]
    .filter((packId: string) => typeof packId === "string" && packId.trim() !== "")
    .map((packId: string) => {
      const record: any = catalogByPackId.get(packId);
      return {
        id: packId,
        workflow_maturity: record?.workflow_maturity ?? "canary",
        effective_workflow_maturity: record?.effective_workflow_maturity ?? "canary",
        workflow_maturity_blocked: Boolean(record?.workflow_maturity_blocked),
        default_recommendation: Boolean(record?.default_recommendation),
      };
    })
    .sort(compareRecommendationPriority)
    .map((entry: any) => entry.id);
}

export function preferredPackId(context: any) {
  const selectedPackIds = sortPackIdsForRecommendation(
    context,
    context.selectedManifests.map((record: any) => record.packId),
  );
  if (selectedPackIds.length > 0) {
    return selectedPackIds[0];
  }

  const installedPackIds = sortPackIdsForRecommendation(
    context,
    (context.state?.packs ?? []).map((pack: any) => pack.id),
  );
  if (installedPackIds.length > 0) {
    return installedPackIds[0];
  }

  const defaultCatalogRecord = selectDefaultCatalogPack(context.catalogRecords ?? []);
  if (defaultCatalogRecord) {
    return defaultCatalogRecord.id;
  }

  const availablePackIds = sortPackIdsForRecommendation(
    context,
    (context.catalogRecords ?? []).map((record: any) => record.id),
  );
  return availablePackIds[0] ?? null;
}

export function runtimeFlag(runtime: string) {
  return runtime === "codex_cli" ? "codex" : "copilot";
}

export function buildWorkflowMaturitySummary(context: any) {
  const catalogByPackId = buildCatalogRecordMap(context.catalogRecords);
  const selectedPackIds = sortPackIdsForRecommendation(
    context,
    context.selectedManifests.map((record: any) => record.packId),
  );
  const selectedPacks = selectedPackIds.map((packId: string) => {
    const catalogRecord: any = catalogByPackId.get(packId);
    const workflowMaturity = catalogRecord?.workflow_maturity ?? "canary";
    const effectiveWorkflowMaturity = catalogRecord?.effective_workflow_maturity ?? "canary";
    const blockers = Array.isArray(catalogRecord?.workflow_maturity_blockers)
      ? catalogRecord.workflow_maturity_blockers
      : [];
    const demotionTriggersActive = Array.isArray(catalogRecord?.workflow_demotion_triggers_active)
      ? catalogRecord.workflow_demotion_triggers_active
      : [];
    return {
      pack_id: packId,
      workflow_maturity: workflowMaturity,
      effective_workflow_maturity: effectiveWorkflowMaturity,
      workflow_transition_legal: catalogRecord?.workflow_transition_legal !== false,
      workflow_maturity_blocked: Boolean(catalogRecord?.workflow_maturity_blocked),
      workflow_maturity_blockers: blockers,
      workflow_demotion_triggers_active: demotionTriggersActive,
      workflow_promotion_checklist_ready: catalogRecord?.workflow_promotion_checklist_ready === true,
      runtime_support_status: catalogRecord?.runtime_support?.[context.runtime]?.resolved_status ?? null,
      runtime_support_evidence_kind: catalogRecord?.runtime_support?.[context.runtime]?.evidence_kind ?? null,
      support_scope: catalogRecord?.support_scope ?? null,
      default_recommendation: catalogRecord?.default_recommendation === true,
      pack_manifest: catalogRecord?.metadata_file ?? null,
      demoted: workflowMaturityRank(workflowMaturity) > workflowMaturityRank(effectiveWorkflowMaturity),
    };
  });

  const contradictoryClaims = selectedPacks.filter(
    (pack: any) => pack.demoted || pack.workflow_transition_legal === false,
  );
  const blockedPacks = selectedPacks.filter(
    (pack: any) => pack.workflow_maturity_blocked || pack.workflow_maturity_blockers.length > 0,
  );
  const highestEffective = selectedPacks.length === 0
    ? null
    : selectedPacks
      .map((pack: any) => pack.effective_workflow_maturity)
      .sort((left: any, right: any) => workflowMaturityRank(right) - workflowMaturityRank(left))[0];
  return {
    selected_pack_count: selectedPacks.length,
    recommended_pack_id: selectedPacks[0]?.pack_id ?? preferredPackId(context),
    highest_effective_workflow_maturity: highestEffective,
    contradictory_claim_count: contradictoryClaims.length,
    blocked_pack_count: blockedPacks.length,
    advanced_lane_fence: "core-only-catalog",
    selected_packs: selectedPacks,
  };
}

export function buildFirstWorkflowGuidance(context: any, { installBlocked, workflowMaturity }: { installBlocked?: any; workflowMaturity?: any }) {
  const recommendedPackId = workflowMaturity?.recommended_pack_id ?? preferredPackId(context);
  const effectiveLabel = workflowMaturity?.selected_packs?.find((entry: any) => entry.pack_id === recommendedPackId)
    ?.effective_workflow_maturity;
  const doctorCommand = `node packages/tools/cli/src/bin/pairslash.js doctor --runtime ${runtimeFlag(context.runtime)} --target ${context.target}`;

  if (installBlocked) {
    return {
      ready: false,
      recommended_pack_id: recommendedPackId,
      rationale: "Blocking issues must be fixed before install or first workflow execution.",
      commands: [doctorCommand],
    };
  }

  if ((context.state?.packs ?? []).length > 0) {
    return {
      ready: true,
      recommended_pack_id: recommendedPackId,
      rationale: `A managed pack is already installed for this runtime and target.${effectiveLabel ? ` Keep the workflow label caveat explicit (${effectiveLabel}).` : ""}`,
      commands: [
        `Launch ${context.detection.executable ?? runtimeFlag(context.runtime)} from the repo root and use /skills to run ${recommendedPackId ?? "the installed pack"}.`,
      ],
    };
  }

  if (recommendedPackId) {
    return {
      ready: false,
      recommended_pack_id: recommendedPackId,
      rationale: `Install the baseline pack first, then enter the runtime through /skills.${effectiveLabel ? ` Current evidence-backed workflow maturity: ${effectiveLabel}.` : ""}`,
      commands: [
        `node packages/tools/cli/src/bin/pairslash.js preview install ${recommendedPackId} --runtime ${runtimeFlag(context.runtime)} --target ${context.target}`,
        `node packages/tools/cli/src/bin/pairslash.js install ${recommendedPackId} --runtime ${runtimeFlag(context.runtime)} --target ${context.target} --apply --yes`,
        `Launch ${context.detection.executable ?? runtimeFlag(context.runtime)} from the repo root and use /skills to run ${recommendedPackId}.`,
      ],
    };
  }

  return {
    ready: false,
    recommended_pack_id: null,
    rationale: "No valid pack manifest was discovered for this repository yet.",
    commands: [doctorCommand],
  };
}
