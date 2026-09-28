import {
  isOneOf,
  WORKFLOW_MATURITY_LEVELS,
  WORKFLOW_MATURITY_STRENGTH_ORDER,
} from "../constants.ts";
import {
  stableYaml,
} from "../utils.ts";
import {
  LIVE_RUNTIME_EVIDENCE_ROOT,
  PREVIEW_WORKFLOW_LANE_SUPPORT_LEVELS,
  STABLE_WORKFLOW_LANE_SUPPORT_LEVELS,
  WORKFLOW_TRANSITION_MAP,
  countMatchingWorkflowVerificationRuns,
  isObject,
  normalizeEvidenceRefCollectionForCompare,
  normalizeEvidenceRefDescriptor,
  normalizePackId,
  readScopedReleaseGateStatus,
  supportedWorkflowRuntimes,
  workflowEvidenceScopeMatches,
  workflowSmokeCoverageRuntimes,
} from "./helpers.ts";

export function normalizeWorkflowMaturity(level: any) {
  return isOneOf(level, WORKFLOW_MATURITY_LEVELS) ? level : "canary";
}

export function workflowMaturityRank(level: any) {
  return WORKFLOW_MATURITY_STRENGTH_ORDER[normalizeWorkflowMaturity(level)] ?? 0;
}

export function pickWeakerWorkflowMaturity(left: any, right: any) {
  return workflowMaturityRank(left) <= workflowMaturityRank(right)
    ? normalizeWorkflowMaturity(left)
    : normalizeWorkflowMaturity(right);
}

export function collectCanaryWorkflowMaturityBlockers(manifest: any) {
  const blockers: any[] = [];
  if (manifest?.canonical_entrypoint !== "/skills") {
    blockers.push("workflow-maturity-canonical-entrypoint-missing:/skills");
  }
  if (manifest?.status !== "active") {
    blockers.push(`workflow-maturity-pack-inactive:${manifest?.status ?? "unknown"}`);
  }
  if (manifest?.catalog?.pack_class !== "core") {
    blockers.push(`workflow-maturity-pack-class-not-core:${manifest?.catalog?.pack_class ?? "unknown"}`);
  }
  const deterministicRefs = manifest?.support?.workflow_evidence?.deterministic_refs ?? [];
  if (!Array.isArray(deterministicRefs) || deterministicRefs.length === 0) {
    blockers.push("workflow-maturity-deterministic-evidence-missing");
  }
  return blockers.sort((left: any, right: any) => left.localeCompare(right));
}

export function findDefaultPromotionLanes(publicSupport: any, runtime: string) {
  const defaultTarget =
    publicSupport?.evidence_policy?.runbook_policy?.runtime_runbooks?.[runtime]?.default_target ?? null;
  return (publicSupport?.runtime_lanes ?? [])
    .filter((lane: any) =>
      lane.runtime_id === runtime &&
      lane.target === defaultTarget &&
      lane.release_gate === "required")
    .slice()
    .sort((left: any, right: any) => left.lane_id.localeCompare(right.lane_id));
}

export function findClaimedOrDefaultLanes(manifest: any, publicSupport: any, runtime: string) {
  const claimedLaneIds = Array.isArray(manifest?.support?.promotion_checklist?.claimed_lanes?.[runtime])
    ? manifest.support.promotion_checklist.claimed_lanes[runtime]
    : [];
  const runtimeLanes = (publicSupport?.runtime_lanes ?? []).filter((lane: any) => lane.runtime_id === runtime);
  if (claimedLaneIds.length > 0) {
    return claimedLaneIds
      .map((laneId: any) => runtimeLanes.find((lane: any) => lane.lane_id === laneId) ?? null)
      .filter(Boolean)
      .sort((left: any, right: any) => left.lane_id.localeCompare(right.lane_id));
  }
  return findDefaultPromotionLanes(publicSupport, runtime);
}

export function resolveWorkflowEvidenceAnalysis({ manifest, runtime, publicSupport, laneRecordIndex }: { manifest?: any; runtime: string; publicSupport?: any; laneRecordIndex?: any }) {
  const packId = normalizePackId(manifest);
  const lanes = findClaimedOrDefaultLanes(manifest, publicSupport, runtime);
  const laneIds = new Set(lanes.map((lane: any) => lane.lane_id));
  const refs = Array.isArray(manifest?.support?.workflow_evidence?.live_workflow_refs?.[runtime])
    ? manifest.support.workflow_evidence.live_workflow_refs[runtime]
    : [];
  const invalidBlockers: any[] = [];
  const evidenceByLaneId = new Map();

  for (const evidenceRef of refs) {
    const { path, remote, fragment } = normalizeEvidenceRefDescriptor(evidenceRef);
    if (remote) {
      invalidBlockers.push(`workflow-maturity-live-workflow-ref-invalid:${runtime}:remote`);
      continue;
    }
    if (!path) {
      invalidBlockers.push(`workflow-maturity-live-workflow-ref-invalid:${runtime}:missing`);
      continue;
    }
    if (fragment) {
      invalidBlockers.push(`workflow-maturity-live-workflow-ref-invalid:${runtime}:${path}:fragment`);
      continue;
    }
    if (!path.startsWith(`${LIVE_RUNTIME_EVIDENCE_ROOT}/`) || !path.endsWith(".yaml")) {
      invalidBlockers.push(`workflow-maturity-live-workflow-ref-invalid:${runtime}:${path}:authoritative-root-required`);
      continue;
    }
    const indexedRecord = laneRecordIndex?.byEvidenceRef?.get(path);
    if (!indexedRecord) {
      invalidBlockers.push(`workflow-maturity-live-workflow-ref-invalid:${runtime}:${path}:unregistered-live-runtime-record`);
      continue;
    }
    if (indexedRecord.lane.runtime_id !== runtime || indexedRecord.record?.runtime_id !== runtime) {
      invalidBlockers.push(`workflow-maturity-live-workflow-ref-invalid:${runtime}:${path}:runtime-mismatch`);
      continue;
    }
    if (!workflowEvidenceScopeMatches(indexedRecord.record, packId)) {
      invalidBlockers.push(`workflow-maturity-live-workflow-ref-invalid:${runtime}:${path}:workflow-scope-mismatch`);
      continue;
    }
    if (!laneIds.has(indexedRecord.lane.lane_id)) {
      invalidBlockers.push(`workflow-maturity-live-workflow-ref-invalid:${runtime}:${path}:lane-not-claimed`);
      continue;
    }
    evidenceByLaneId.set(indexedRecord.lane.lane_id, {
      lane: indexedRecord.lane,
      record: indexedRecord.record,
      verification_run_count: countMatchingWorkflowVerificationRuns(indexedRecord.record, packId),
    });
  }

  return {
    lanes,
    invalidBlockers,
    evidenceByLaneId,
    totalVerificationRuns: [...evidenceByLaneId.values()]
      .reduce((sum: any, entry: any) => sum + entry.verification_run_count, 0),
  };
}

export function collectPreviewWorkflowMaturityBlockers(manifest: any, runtimeSupport: any, publicSupport: any, laneRecordIndex: any) {
  const blockers: any[] = [];
  const runtimes = supportedWorkflowRuntimes(manifest);
  const smokeCoverage = workflowSmokeCoverageRuntimes(manifest);
  const isWriteAuthorityWorkflow =
    manifest?.workflow_class === "write-authority" ||
    manifest?.memory_permissions?.global_project_memory === "write" ||
    (manifest?.capabilities ?? []).includes("memory_write_global");
  const packId = normalizePackId(manifest);
  for (const runtime of runtimes) {
    if (!smokeCoverage.has(runtime)) {
      blockers.push(`workflow-maturity-preview-deterministic-coverage-missing:${runtime}`);
    }
    const liveRefs = manifest?.support?.workflow_evidence?.live_workflow_refs?.[runtime];
    if (!Array.isArray(liveRefs) || liveRefs.length === 0) {
      blockers.push(`workflow-maturity-preview-live-workflow-evidence-missing:${runtime}`);
    }
    const claim = runtimeSupport?.[runtime];
    if (claim?.required_for_promotion === false) {
      continue;
    }
    if (claim?.declared_status === "blocked") {
      blockers.push(`workflow-maturity-runtime-support-blocked:${runtime}`);
    }
    if (claim?.declared_status === "unverified") {
      blockers.push(`workflow-maturity-runtime-support-unverified:${runtime}`);
    }
    if (claim?.evidence_kind !== "pack-runtime-live") {
      blockers.push(`workflow-maturity-pack-runtime-live-required:${runtime}:${claim?.evidence_kind ?? "missing"}`);
    }
    if (!claim?.evidence_present) {
      blockers.push(`workflow-maturity-live-evidence-missing:${runtime}:${claim?.evidence_scope ?? "missing"}`);
    }
    const analysis = resolveWorkflowEvidenceAnalysis({
      manifest,
      runtime,
      publicSupport,
      laneRecordIndex,
    });
    blockers.push(...analysis.invalidBlockers);
    if (analysis.lanes.length === 0) {
      blockers.push(`workflow-maturity-preview-claimed-lane-missing:${runtime}`);
    }
    for (const lane of analysis.lanes) {
      const evidence = analysis.evidenceByLaneId.get(lane.lane_id);
      if (!evidence) {
        blockers.push(`workflow-maturity-preview-live-workflow-lane-unbound:${runtime}:${lane.lane_id}`);
        continue;
      }
      if (!PREVIEW_WORKFLOW_LANE_SUPPORT_LEVELS.has(lane.support_level)) {
        blockers.push(
          `workflow-maturity-preview-public-lane-not-preview:${runtime}:${lane.lane_id}:${lane.support_level ?? "unknown"}`,
        );
      }
      if (lane.freshness_state !== "fresh") {
        blockers.push(
          `workflow-maturity-preview-public-lane-not-fresh:${runtime}:${lane.lane_id}:${lane.freshness_state ?? "unknown"}`,
        );
      }
      if (evidence.record?.surface_verdicts?.canonical_picker !== "pass") {
        blockers.push(`workflow-maturity-preview-canonical-picker-unverified:${runtime}:${lane.lane_id}`);
      }
      if (!["live_verification", "repeated_live_verification"].includes(evidence.record?.best_live_evidence_class)) {
        blockers.push(
          `workflow-maturity-preview-live-verification-missing:${runtime}:${lane.lane_id}:${evidence.record?.best_live_evidence_class ?? "none-recorded"}`,
        );
      }
      if (evidence.verification_run_count < 1) {
        blockers.push(`workflow-maturity-preview-workflow-verification-run-missing:${runtime}:${lane.lane_id}`);
      }
    }
  }
  if (isWriteAuthorityWorkflow) {
    const operationalSafetyRefs = manifest?.support?.workflow_evidence?.operational_safety_refs ?? [];
    const validOperationalSafetyRefs = operationalSafetyRefs.filter((evidenceRef: string) => {
      const { path, remote, fragment } = normalizeEvidenceRefDescriptor(evidenceRef);
      const indexedRecord =
        !remote && !fragment && typeof path === "string"
          ? laneRecordIndex?.byEvidenceRef?.get(path)
          : null;
      return Boolean(indexedRecord && workflowEvidenceScopeMatches(indexedRecord.record, packId));
    });
    if (validOperationalSafetyRefs.length === 0) {
      blockers.push("workflow-maturity-write-authority-operational-safety-evidence-missing");
    }
  }
  if (manifest?.support?.promotion_checklist?.canonical_entrypoint_verified !== true) {
    blockers.push("workflow-maturity-preview-checklist-canonical-entrypoint-unverified");
  }
  return blockers.sort((left: any, right: any) => left.localeCompare(right));
}

export function collectBetaWorkflowMaturityBlockers(manifest: any, publicSupport: any, laneRecordIndex: any) {
  const blockers: any[] = [];
  for (const runtime of supportedWorkflowRuntimes(manifest)) {
    const analysis = resolveWorkflowEvidenceAnalysis({
      manifest,
      runtime,
      publicSupport,
      laneRecordIndex,
    });
    blockers.push(...analysis.invalidBlockers);
    if (analysis.totalVerificationRuns < 2) {
      blockers.push(`workflow-maturity-beta-repeated-live-evidence-required:${runtime}`);
    }
  }
  if (manifest?.support?.promotion_checklist?.docs_synced !== true) {
    blockers.push("workflow-maturity-beta-checklist-docs-unsynced");
  }
  return [...new Set(blockers)].sort((left: any, right: any) => left.localeCompare(right));
}

export function collectStableWorkflowMaturityBlockers(manifest: any, runtimeSupport: any, publicSupport: any, releaseGateStatus: any, laneRecordIndex: any) {
  const blockers: any[] = [];
  const isWriteAuthorityWorkflow =
    manifest?.workflow_class === "write-authority" ||
    manifest?.memory_permissions?.global_project_memory === "write" ||
    (manifest?.capabilities ?? []).includes("memory_write_global");
  const packId = normalizePackId(manifest);
  if (releaseGateStatus !== "GO") {
    blockers.push(`workflow-maturity-release-gate:${releaseGateStatus.toLowerCase()}`);
  }
  if (manifest?.support?.promotion_checklist?.wording_verified !== true) {
    blockers.push("workflow-maturity-stable-checklist-wording-unverified");
  }
  for (const runtime of supportedWorkflowRuntimes(manifest)) {
    const claim = runtimeSupport?.[runtime];
    if (claim?.required_for_promotion === false) {
      continue;
    }
    const lanes = findClaimedOrDefaultLanes(manifest, publicSupport, runtime);
    if (lanes.length === 0) {
      blockers.push(`workflow-maturity-public-lane-missing:${runtime}`);
      continue;
    }
    const analysis = resolveWorkflowEvidenceAnalysis({
      manifest,
      runtime,
      publicSupport,
      laneRecordIndex,
    });
    blockers.push(...analysis.invalidBlockers);
    for (const lane of lanes) {
      const evidence = analysis.evidenceByLaneId.get(lane.lane_id);
      if (!evidence) {
        blockers.push(`workflow-maturity-stable-live-workflow-lane-unbound:${runtime}:${lane.lane_id}`);
        continue;
      }
      if (lane.freshness_state !== "fresh") {
        blockers.push(
          `workflow-maturity-public-lane-not-fresh:${runtime}:${lane.lane_id}:${lane.freshness_state ?? "unknown"}`,
        );
      }
      if (!STABLE_WORKFLOW_LANE_SUPPORT_LEVELS.has(lane.support_level)) {
        blockers.push(
          `workflow-maturity-public-lane-not-stable:${runtime}:${lane.lane_id}:${lane.support_level ?? "unknown"}`,
        );
      }
      if (evidence.record?.surface_verdicts?.canonical_picker !== "pass") {
        blockers.push(`workflow-maturity-stable-canonical-picker-unverified:${runtime}:${lane.lane_id}`);
      }
      if (evidence.record?.best_live_evidence_class !== "repeated_live_verification") {
        blockers.push(
          `workflow-maturity-stable-repeated-live-verification-required:${runtime}:${lane.lane_id}:${evidence.record?.best_live_evidence_class ?? "none-recorded"}`,
        );
      }
      if (evidence.verification_run_count < 2) {
        blockers.push(`workflow-maturity-stable-workflow-verification-runs-required:${runtime}:${lane.lane_id}`);
      }
    }
  }
  if (isWriteAuthorityWorkflow) {
    const operationalSafetyRefs = manifest?.support?.workflow_evidence?.operational_safety_refs ?? [];
    const operationalSafetyVerificationRuns = operationalSafetyRefs.reduce((sum: any, evidenceRef: string) => {
      const { path, remote, fragment } = normalizeEvidenceRefDescriptor(evidenceRef);
      if (remote || fragment || typeof path !== "string") {
        return sum;
      }
      const indexedRecord = laneRecordIndex?.byEvidenceRef?.get(path);
      if (!indexedRecord || !workflowEvidenceScopeMatches(indexedRecord.record, packId)) {
        return sum;
      }
      return sum + countMatchingWorkflowVerificationRuns(indexedRecord.record, packId);
    }, 0);
    if (operationalSafetyVerificationRuns < 2) {
      blockers.push("workflow-maturity-write-authority-operational-safety-repeated-verification-required");
    }
  }
  return blockers.sort((left: any, right: any) => left.localeCompare(right));
}

export function collectDeprecatedWorkflowMaturityBlockers(manifest: any) {
  const blockers: any[] = [];
  if (manifest?.status !== "deprecated") {
    blockers.push(`workflow-maturity-deprecated-status-required:${manifest?.status ?? "unknown"}`);
  }
  if (!["deprecated", "archived"].includes(manifest?.catalog?.deprecation_status)) {
    blockers.push(
      `workflow-maturity-deprecated-catalog-status-required:${manifest?.catalog?.deprecation_status ?? "unknown"}`,
    );
  }
  const hasReplacement =
    typeof manifest?.catalog?.replacement_pack === "string" &&
    manifest.catalog.replacement_pack.trim() !== "";
  const migrationRefs = manifest?.support?.workflow_evidence?.migration_refs ?? [];
  if (!hasReplacement && (!Array.isArray(migrationRefs) || migrationRefs.length === 0)) {
    blockers.push("workflow-maturity-deprecated-migration-guidance-missing");
  }
  return blockers.sort((left: any, right: any) => left.localeCompare(right));
}

export function deriveDemotionTriggersFromBlockers(blockers: any[]) {
  const triggerCodes = new Set();
  for (const blocker of blockers) {
    if (blocker.startsWith("workflow-maturity-release-gate:")) {
      triggerCodes.add("release-no-go");
      continue;
    }
    if (
      blocker.includes("not-fresh") ||
      blocker.includes("live-evidence-missing") ||
      blocker.includes("deterministic-evidence-missing") ||
      blocker.includes("repeated-live-evidence") ||
      blocker.includes("live-workflow-ref-invalid") ||
      blocker.includes("workflow-verification-run") ||
      blocker.includes("live-verification")
    ) {
      triggerCodes.add("evidence-stale");
      continue;
    }
    if (
      blocker.includes("runtime-support-") ||
      blocker.includes("public-lane-") ||
      blocker.includes("pack-runtime-live-required") ||
      blocker.includes("lane-unbound")
    ) {
      triggerCodes.add("runtime-regression");
      continue;
    }
    if (blocker.includes("checklist-docs") || blocker.includes("checklist-wording")) {
      triggerCodes.add("docs-drift");
      continue;
    }
    if (
      blocker.includes("promotion-checklist") ||
      blocker.includes("canonical-entrypoint") ||
      blocker.includes("transition-illegal") ||
      blocker.includes("deprecated-")
    ) {
      triggerCodes.add("docs-drift");
      continue;
    }
    if (blocker.includes("write-authority")) {
      triggerCodes.add("write-safety-regression");
    }
  }
  if (blockers.length > 0 && triggerCodes.size === 0) {
    triggerCodes.add("docs-drift");
  }
  return [...triggerCodes].sort((left: any, right: any) => left.localeCompare(right));
}

export function normalizeWorkflowTransitionFrom(manifest: any, assigned: any) {
  const transitionFrom = manifest?.support?.workflow_transition?.from;
  return WORKFLOW_MATURITY_LEVELS.includes(transitionFrom) ? transitionFrom : assigned;
}

export function isWorkflowTransitionLegal(transitionFrom: any, assigned: any) {
  if (!isOneOf(transitionFrom, WORKFLOW_MATURITY_LEVELS) || !isOneOf(assigned, WORKFLOW_MATURITY_LEVELS)) {
    return false;
  }
  return WORKFLOW_TRANSITION_MAP[transitionFrom]?.has(assigned) ?? false;
}

export function promotionChecklistReady(manifest: any) {
  const checklist = manifest?.support?.promotion_checklist;
  if (!isObject(checklist)) {
    return false;
  }
  return (
    checklist.required_for_label === manifest?.support?.workflow_maturity &&
    checklist.canonical_entrypoint_verified === true
  );
}

export function resolveWorkflowMaturity({ repoRoot, manifest, runtimeSupport, publicSupport, laneRecordIndex }: { repoRoot: string; manifest?: any; runtimeSupport?: any; publicSupport?: any; laneRecordIndex?: any }) {
  const assigned = normalizeWorkflowMaturity(manifest?.support?.workflow_maturity);
  const transitionFrom = normalizeWorkflowTransitionFrom(manifest, assigned);
  const transitionLegal = isWorkflowTransitionLegal(transitionFrom, assigned);
  const canaryBlockers = collectCanaryWorkflowMaturityBlockers(manifest);
  const previewBlockers = canaryBlockers.length === 0
    ? collectPreviewWorkflowMaturityBlockers(manifest, runtimeSupport, publicSupport, laneRecordIndex)
    : [];
  const betaBlockers = previewBlockers.length === 0
    ? collectBetaWorkflowMaturityBlockers(manifest, publicSupport, laneRecordIndex)
    : [];
  const releaseGateStatus = readScopedReleaseGateStatus(repoRoot);
  const stableBlockers = betaBlockers.length === 0
    ? collectStableWorkflowMaturityBlockers(
      manifest,
      runtimeSupport,
      publicSupport,
      releaseGateStatus,
      laneRecordIndex,
    )
    : [];
  const deprecatedBlockers = collectDeprecatedWorkflowMaturityBlockers(manifest);
  const transitionBlockers = transitionLegal ? [] : [
    `workflow-maturity-transition-illegal:${transitionFrom}->${assigned}`,
  ];
  const checklistBlockers = promotionChecklistReady(manifest)
    ? []
    : ["workflow-maturity-promotion-checklist-incomplete"];
  let maxSupported = "canary";
  if (previewBlockers.length === 0 && canaryBlockers.length === 0) {
    maxSupported = "preview";
  }
  if (betaBlockers.length === 0 && maxSupported === "preview") {
    maxSupported = "beta";
  }
  if (stableBlockers.length === 0 && maxSupported === "beta") {
    maxSupported = "stable";
  }
  if (assigned === "deprecated") {
    maxSupported = "deprecated";
  }
  const blockers = [...transitionBlockers, ...checklistBlockers];
  if (assigned === "deprecated") {
    blockers.push(...deprecatedBlockers);
  } else {
    if (workflowMaturityRank(assigned) >= workflowMaturityRank("canary")) {
      blockers.push(...canaryBlockers);
    }
    if (workflowMaturityRank(assigned) >= workflowMaturityRank("preview")) {
      blockers.push(...previewBlockers);
    }
    if (workflowMaturityRank(assigned) >= workflowMaturityRank("beta")) {
      blockers.push(...betaBlockers);
    }
    if (workflowMaturityRank(assigned) >= workflowMaturityRank("stable")) {
      blockers.push(...stableBlockers);
    }
  }
  const effective = assigned === "deprecated"
    ? "deprecated"
    : pickWeakerWorkflowMaturity(assigned, maxSupported);
  const dedupedBlockers = [...new Set(blockers)].sort((left: any, right: any) => left.localeCompare(right));
  return {
    assigned,
    effective,
    blockers: dedupedBlockers,
    blocked:
      runtimeSupport?.codex_cli?.declared_status === "blocked" ||
      runtimeSupport?.copilot_cli?.declared_status === "blocked",
    promotion_ready: effective === "stable" && dedupedBlockers.length === 0,
    release_gate_status: releaseGateStatus,
    transition_from: transitionFrom,
    transition_legal: transitionLegal,
    checklist_ready: promotionChecklistReady(manifest),
    demotion_triggers_active: deriveDemotionTriggersFromBlockers(dedupedBlockers),
  };
}

export function validateEvidenceRefCollectionsMatch(laneRefs: any, recordRefs: any, errorKey: any) {
  const left = normalizeEvidenceRefCollectionForCompare(laneRefs);
  const right = normalizeEvidenceRefCollectionForCompare(recordRefs);
  if (stableYaml(left) !== stableYaml(right)) {
    throw new Error(`public-support-snapshot-invalid:${errorKey}`);
  }
}

export function isPromotionEvidenceReady(claim: any) {
  return Boolean(
    claim?.evidence_present &&
      (claim?.required_for_promotion === false || claim?.evidence_kind === "pack-runtime-live"),
  );
}
