import {
  SUPPORTED_RUNTIMES,
} from "../constants.ts";
import {
  loadPackManifestRecords,
} from "../manifest.ts";
import {
  evaluatePackTrustAuthority,
  evaluateRuntimeSupportClaim,
  loadPackTrustDescriptorRecord,
} from "../release-trust.ts";
import {
  exists,
  stableYaml,
} from "../utils.ts";
import {
  basename,
  resolve,
} from "node:path";
import {
  LIVE_RUNTIME_LANE_RECORD_SCHEMA_REF,
  PLATFORM_TO_OS_LANE,
  SHARED_RUNTIME_SURFACE_MATRIX,
  buildLiveRuntimeLaneRecordIndex,
  clone,
  discoverAdvancedManifestPaths,
  normalizeEvidenceScope,
  normalizeSnapshotCollection,
  readYamlFile,
  relativePosix,
  resolvePackDocPath,
  splitEvidenceRefs,
  toPosixPath,
  validateEvidenceRefCollection,
  validateEvidenceRefExists,
  validateRequiredEvidenceRefCollection,
} from "./helpers.ts";
import {
  validateLiveRuntimeLaneRecord,
  validateRunbookPolicy,
} from "./lane-records.ts";
import {
  isPromotionEvidenceReady,
  resolveWorkflowMaturity,
  workflowMaturityRank,
} from "./workflow-maturity.ts";

export function buildCatalogRuntimeSupport({
  repoRoot,
  manifest,
  descriptorRecord,
}) {
  return Object.fromEntries(
    SUPPORTED_RUNTIMES.map((runtime) => {
      const claim = evaluateRuntimeSupportClaim({
        repoRoot,
        manifest,
        runtime,
        descriptorRecord,
      });
      const evidenceScope = normalizeEvidenceScope(claim.evidence_ref);
      return [
        runtime,
        {
          ...claim,
          evidence_scope: evidenceScope,
          promotion_evidence_ready: isPromotionEvidenceReady({
            ...claim,
            evidence_scope: evidenceScope,
          }),
        },
      ];
    }),
  );
}

export function buildPromotionBlockers(runtimeSupport) {
  return SUPPORTED_RUNTIMES.flatMap((runtime) => {
    const claim = runtimeSupport[runtime];
    if (claim?.declared_status === "blocked") {
      return [`runtime-promotion-blocked-surface:${runtime}`];
    }
    if (claim?.declared_status === "unverified") {
      return [`runtime-promotion-unverified-surface:${runtime}`];
    }
    if (!["supported", "partial"].includes(claim?.declared_status)) {
      return [`runtime-promotion-unknown-surface:${runtime}`];
    }
    if (claim.promotion_evidence_ready) {
      return [];
    }
    return [
      `runtime-promotion-evidence-missing:${runtime}:${claim.evidence_scope}`,
    ];
  }).sort((left, right) => left.localeCompare(right));
}

export function buildCoreCatalogRecord(repoRoot, record, { publicSupport, laneRecordIndex }) {
  const descriptorRecord = loadPackTrustDescriptorRecord({
    manifestPath: record.manifestPath,
    manifest: record.manifest,
  });
  const runtimeSupport = buildCatalogRuntimeSupport({
    repoRoot,
    manifest: record.manifest,
    descriptorRecord,
  });
  const authorityDecision = evaluatePackTrustAuthority({
    repoRoot,
    packId: record.packId,
    manifest: record.manifest,
    descriptor: descriptorRecord.descriptor,
  });
  const sourceRoot = toPosixPath(record.manifest.runtime_assets?.source_root ?? `packs/core/${record.packId}`);
  const supportScope = record.manifest.support?.support_level_claim ?? descriptorRecord.descriptor?.support_level_claim ?? null;
  const releaseChannel = record.manifest.release_channel ?? null;
  const maturity = record.manifest.catalog?.maturity ?? releaseChannel;
  const workflowMaturity = resolveWorkflowMaturity({
    repoRoot,
    manifest: record.manifest,
    runtimeSupport,
    publicSupport,
    laneRecordIndex,
  });
  return {
    id: record.packId,
    catalog_scope: "core",
    catalog_status: record.isValid ? "operational" : "invalid",
    public_catalog:
      record.manifest.status === "active" &&
      record.manifest.catalog?.pack_class === "core" &&
      record.manifest.catalog?.docs_visibility === "public",
    version: record.manifest.pack_version ?? null,
    phase: record.manifest.phase ?? null,
    status: record.manifest.status ?? null,
    pack_class: record.manifest.catalog?.pack_class ?? "core",
    category: record.manifest.category ?? null,
    workflow_class: record.manifest.workflow_class ?? null,
    display_name: record.manifest.display_name ?? record.manifest.pack?.display_name ?? record.packId,
    summary: record.manifest.summary ?? record.manifest.pack?.summary ?? null,
    release_channel: releaseChannel,
    maturity,
    workflow_maturity: workflowMaturity.assigned,
    effective_workflow_maturity: workflowMaturity.effective,
    workflow_transition_from: workflowMaturity.transition_from,
    workflow_transition_reason: record.manifest.support?.workflow_transition?.reason ?? null,
    workflow_transition_legal: workflowMaturity.transition_legal,
    workflow_maturity_blocked: workflowMaturity.blocked,
    workflow_maturity_blockers: workflowMaturity.blockers,
    workflow_promotion_ready: workflowMaturity.promotion_ready,
    workflow_promotion_checklist_ready: workflowMaturity.checklist_ready,
    workflow_demotion_triggers_active: workflowMaturity.demotion_triggers_active,
    workflow_promotion_checklist: record.manifest.support?.promotion_checklist ?? null,
    workflow_demotion_policy: record.manifest.support?.demotion_policy ?? null,
    workflow_evidence: record.manifest.support?.workflow_evidence ?? null,
    scoped_release_gate_status: workflowMaturity.release_gate_status,
    support_scope: supportScope,
    support_metadata_complete: Boolean(
      releaseChannel &&
      maturity &&
      workflowMaturity.assigned &&
      supportScope &&
      record.manifest.support?.workflow_transition &&
      record.manifest.support?.workflow_evidence &&
      record.manifest.support?.promotion_checklist &&
      record.manifest.support?.demotion_policy
    ),
    docs_visibility: record.manifest.catalog?.docs_visibility ?? null,
    default_discovery: record.manifest.catalog?.default_discovery ?? true,
    default_recommendation: record.manifest.catalog?.default_recommendation ?? false,
    release_visibility: record.manifest.catalog?.release_visibility ?? null,
    deprecation_status: record.manifest.catalog?.deprecation_status ?? "active",
    canonical_entrypoint: record.manifest.canonical_entrypoint ?? record.manifest.pack?.canonical_entrypoint ?? null,
    pack_manifest: relativePosix(repoRoot, record.manifestPath),
    trust_descriptor: descriptorRecord.descriptorPath
      ? relativePosix(repoRoot, descriptorRecord.descriptorPath)
      : null,
    skill_file: resolvePackDocPath(sourceRoot, record.manifest.runtime_assets?.primary_skill),
    contract_file: resolvePackDocPath(sourceRoot, record.manifest.docs_refs?.contract),
    validation_checklist: resolvePackDocPath(sourceRoot, record.manifest.docs_refs?.validation_checklist),
    spec_file: exists(resolve(repoRoot, "packages", "core", "spec-core", "specs", `${record.packId}.spec.yaml`))
      ? `packages/core/spec-core/specs/${record.packId}.spec.yaml`
      : null,
    compatibility_matrix: SHARED_RUNTIME_SURFACE_MATRIX,
    trust_tier: authorityDecision.authorized_tier,
    publisher_id: record.manifest.support?.publisher?.publisher_id ?? descriptorRecord.descriptor?.publisher?.publisher_id ?? null,
    publisher_class: record.manifest.support?.publisher?.publisher_class ?? descriptorRecord.descriptor?.publisher?.publisher_class ?? null,
    maintainer_owner: record.manifest.support?.maintainers?.owner ?? null,
    maintainer_contact: record.manifest.support?.maintainers?.contact ?? null,
    runtime_support: runtimeSupport,
    promotion_ready: buildPromotionBlockers(runtimeSupport).length === 0,
    promotion_blockers: buildPromotionBlockers(runtimeSupport),
    descriptor_errors: [...(descriptorRecord.errors ?? []), ...(authorityDecision.errors ?? [])]
      .sort((left, right) => left.localeCompare(right)),
    descriptor_shim_errors: [...(descriptorRecord.shimErrors ?? [])].sort((left, right) => left.localeCompare(right)),
  };
}

export function buildInvalidCoreCatalogRecord(repoRoot, record) {
  const manifest = record.manifest ?? {};
  const sourceRoot = toPosixPath(manifest.runtime_assets?.source_root ?? `packs/core/${record.packId}`);
  const descriptorPath = resolve(record.manifestPath, "..", "pack.trust.yaml");
  const supportScope = manifest.support?.support_level_claim ?? null;
  const releaseChannel = manifest.release_channel ?? null;
  const maturity = manifest.catalog?.maturity ?? releaseChannel;
  const workflowMaturity = manifest.support?.workflow_maturity ?? null;
  const descriptorErrors = [
    ...(record.parseError ? [`manifest-parse:${record.parseError}`] : []),
    ...(record.validationErrors ?? []).map((error) => `manifest-validate:${error}`),
    ...(record.normalizationWarnings ?? []).map((warning) => `manifest-normalize:${warning}`),
  ].sort((left, right) => left.localeCompare(right));
  return {
    id: record.packId,
    catalog_scope: "core",
    catalog_status: "invalid",
    public_catalog: false,
    version: manifest.pack_version ?? null,
    phase: manifest.phase ?? null,
    status: manifest.status ?? null,
    pack_class: manifest.catalog?.pack_class ?? "core",
    category: manifest.category ?? null,
    workflow_class: manifest.workflow_class ?? null,
    display_name: manifest.display_name ?? manifest.pack?.display_name ?? record.packId,
    summary: manifest.summary ?? manifest.pack?.summary ?? null,
    release_channel: releaseChannel,
    maturity,
    workflow_maturity: workflowMaturity,
    effective_workflow_maturity: null,
    workflow_transition_from: manifest.support?.workflow_transition?.from ?? null,
    workflow_transition_reason: manifest.support?.workflow_transition?.reason ?? null,
    workflow_transition_legal: false,
    workflow_maturity_blocked: false,
    workflow_maturity_blockers: ["invalid-core-manifest"],
    workflow_promotion_ready: false,
    workflow_promotion_checklist_ready: false,
    workflow_demotion_triggers_active: [],
    workflow_promotion_checklist: manifest.support?.promotion_checklist ?? null,
    workflow_demotion_policy: manifest.support?.demotion_policy ?? null,
    workflow_evidence: manifest.support?.workflow_evidence ?? null,
    scoped_release_gate_status: null,
    support_scope: supportScope,
    support_metadata_complete: Boolean(releaseChannel && maturity && workflowMaturity && supportScope),
    docs_visibility: manifest.catalog?.docs_visibility ?? null,
    default_discovery: manifest.catalog?.default_discovery ?? true,
    default_recommendation: manifest.catalog?.default_recommendation ?? false,
    release_visibility: manifest.catalog?.release_visibility ?? null,
    deprecation_status: manifest.catalog?.deprecation_status ?? "active",
    canonical_entrypoint: manifest.canonical_entrypoint ?? manifest.pack?.canonical_entrypoint ?? null,
    pack_manifest: relativePosix(repoRoot, record.manifestPath),
    trust_descriptor: exists(descriptorPath) ? relativePosix(repoRoot, descriptorPath) : null,
    skill_file: resolvePackDocPath(sourceRoot, manifest.runtime_assets?.primary_skill),
    contract_file: resolvePackDocPath(sourceRoot, manifest.docs_refs?.contract),
    validation_checklist: resolvePackDocPath(sourceRoot, manifest.docs_refs?.validation_checklist),
    spec_file: exists(resolve(repoRoot, "packages", "core", "spec-core", "specs", `${record.packId}.spec.yaml`))
      ? `packages/core/spec-core/specs/${record.packId}.spec.yaml`
      : null,
    compatibility_matrix: SHARED_RUNTIME_SURFACE_MATRIX,
    trust_tier: manifest.support?.tier_claim ?? null,
    publisher_id: manifest.support?.publisher?.publisher_id ?? null,
    publisher_class: manifest.support?.publisher?.publisher_class ?? null,
    maintainer_owner: manifest.support?.maintainers?.owner ?? null,
    maintainer_contact: manifest.support?.maintainers?.contact ?? null,
    runtime_support: Object.fromEntries(
      SUPPORTED_RUNTIMES.map((runtime) => [
        runtime,
        {
          manifest_status: "unverified",
          declared_status: "unverified",
          resolved_status: "unverified",
          evidence_ref: null,
          evidence_kind: null,
          required_for_promotion: true,
          evidence_present: false,
          evidence_scope: "missing",
          promotion_evidence_ready: false,
          policy_action: "ask",
          reasons: ["invalid-core-manifest:excluded-from-operational-catalog"],
        },
      ]),
    ),
    promotion_ready: false,
    promotion_blockers: ["invalid-core-manifest"],
    descriptor_errors: descriptorErrors,
    descriptor_shim_errors: [],
    notes: [
      "Core manifest is discovered but invalid and therefore excluded from operational catalog consumers.",
    ],
  };
}

export function readAdvancedManifestRecord(repoRoot, manifestPath) {
  try {
    const manifest = readYamlFile(manifestPath);
    const packId =
      manifest?.pack?.id ??
      manifest?.pack_name ??
      basename(resolve(manifestPath, ".."));
    return {
      id: packId,
      catalog_scope: "advanced",
      catalog_status: "excluded",
      public_catalog: false,
      version: manifest?.pack_version ?? manifest?.schema_version ?? null,
      phase: manifest?.pack?.phase ?? null,
      status: manifest?.pack?.status ?? manifest?.status ?? null,
      category: manifest?.lane ?? manifest?.category ?? "advanced",
      workflow_class: manifest?.pack?.workflow_class ?? null,
      display_name: manifest?.pack?.display_name ?? packId,
      summary: manifest?.pack?.summary ?? null,
      release_channel: null,
      maturity: null,
      workflow_maturity: null,
      effective_workflow_maturity: null,
      workflow_transition_from: null,
      workflow_transition_reason: null,
      workflow_transition_legal: false,
      workflow_maturity_blocked: false,
      workflow_maturity_blockers: ["advanced-pack:excluded-from-core-catalog"],
      workflow_promotion_ready: false,
      workflow_promotion_checklist_ready: false,
      workflow_demotion_triggers_active: [],
      workflow_promotion_checklist: null,
      workflow_demotion_policy: null,
      workflow_evidence: null,
      scoped_release_gate_status: null,
      support_scope: "excluded-advanced-surface",
      support_metadata_complete: false,
      canonical_entrypoint: manifest?.canonical_entrypoint ?? null,
      pack_manifest: relativePosix(repoRoot, manifestPath),
      trust_descriptor: null,
      skill_file: exists(resolve(repoRoot, "packs", "advanced", basename(resolve(manifestPath, "..")), "SKILL.md"))
        ? `${toPosixPath(relativePosix(repoRoot, resolve(manifestPath, "..")))}${"/SKILL.md"}`
        : null,
      contract_file: typeof manifest?.docs_refs?.contract === "string"
        ? resolvePackDocPath(toPosixPath(relativePosix(repoRoot, resolve(manifestPath, ".."))), manifest.docs_refs.contract)
        : null,
      validation_checklist: null,
      spec_file: null,
      compatibility_matrix: null,
      trust_tier: null,
      publisher_id: null,
      publisher_class: null,
      runtime_support: Object.fromEntries(
        SUPPORTED_RUNTIMES.map((runtime) => [
          runtime,
          {
            manifest_status: "unverified",
            declared_status: "unverified",
            resolved_status: "unverified",
            evidence_ref: null,
            evidence_present: false,
            evidence_scope: "missing",
            promotion_evidence_ready: false,
            policy_action: "ask",
            reasons: ["advanced-pack:excluded-from-core-catalog"],
          },
        ]),
      ),
      promotion_ready: false,
      promotion_blockers: ["advanced-pack:excluded-from-core-catalog"],
      descriptor_errors: [],
      notes: [
        "Advanced packs are intentionally outside canonical core discovery/install surfaces.",
      ],
    };
  } catch (error) {
    return {
      id: basename(resolve(manifestPath, "..")),
      catalog_scope: "advanced",
      catalog_status: "invalid",
      public_catalog: false,
      version: null,
      phase: null,
      status: null,
      category: "advanced",
      workflow_class: null,
      display_name: basename(resolve(manifestPath, "..")),
      summary: null,
      release_channel: null,
      maturity: null,
      workflow_maturity: null,
      effective_workflow_maturity: null,
      workflow_transition_from: null,
      workflow_transition_reason: null,
      workflow_transition_legal: false,
      workflow_maturity_blocked: false,
      workflow_maturity_blockers: [`advanced-pack:parse-error:${error.message}`],
      workflow_promotion_ready: false,
      workflow_promotion_checklist_ready: false,
      workflow_demotion_triggers_active: [],
      workflow_promotion_checklist: null,
      workflow_demotion_policy: null,
      workflow_evidence: null,
      scoped_release_gate_status: null,
      support_scope: "excluded-advanced-surface",
      support_metadata_complete: false,
      canonical_entrypoint: null,
      pack_manifest: relativePosix(repoRoot, manifestPath),
      trust_descriptor: null,
      skill_file: null,
      contract_file: null,
      validation_checklist: null,
      spec_file: null,
      compatibility_matrix: null,
      trust_tier: null,
      publisher_id: null,
      publisher_class: null,
      runtime_support: Object.fromEntries(
        SUPPORTED_RUNTIMES.map((runtime) => [
          runtime,
          {
            manifest_status: "unverified",
            declared_status: "unverified",
            resolved_status: "unverified",
            evidence_ref: null,
            evidence_present: false,
            evidence_scope: "missing",
            promotion_evidence_ready: false,
            policy_action: "ask",
            reasons: [`advanced-pack:parse-error:${error.message}`],
          },
        ]),
      ),
      promotion_ready: false,
      promotion_blockers: [`advanced-pack:parse-error:${error.message}`],
      descriptor_errors: [],
      notes: ["Advanced manifest could not be parsed."],
    };
  }
}

export function loadPackCatalogRecords(
  repoRoot,
  { includeAdvanced = false } = {},
) {
  const publicSupport = loadPublicSupportSnapshot(repoRoot);
  const laneRecordIndex = buildLiveRuntimeLaneRecordIndex(repoRoot, publicSupport);
  const coreRecords = loadPackManifestRecords(repoRoot).map((record) =>
    record.isValid
      ? buildCoreCatalogRecord(repoRoot, record, { publicSupport, laneRecordIndex })
      : buildInvalidCoreCatalogRecord(repoRoot, record));
  const advancedRecords = includeAdvanced
    ? discoverAdvancedManifestPaths(repoRoot).map((manifestPath) =>
        readAdvancedManifestRecord(repoRoot, manifestPath))
    : [];
  return [...coreRecords, ...advancedRecords].sort((left, right) =>
    `${left.catalog_scope}\u0000${left.id}`.localeCompare(`${right.catalog_scope}\u0000${right.id}`),
  );
}

export function loadPublicSupportSnapshot(repoRoot = null, { version = null } = {}) {
  if (!repoRoot) {
    throw new Error("public-support-snapshot-requires-repo-root");
  }
  const snapshotPath = resolve(repoRoot, SHARED_RUNTIME_SURFACE_MATRIX);
  if (!exists(snapshotPath)) {
    throw new Error(`public-support-snapshot-missing:${relativePosix(repoRoot, snapshotPath)}`);
  }
  const parsed = readYamlFile(snapshotPath);
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`public-support-snapshot-invalid:${relativePosix(repoRoot, snapshotPath)}`);
  }
  if (!parsed.evidence_policy || typeof parsed.evidence_policy !== "object") {
    throw new Error(`public-support-snapshot-invalid:evidence_policy`);
  }
  if (parsed.evidence_policy.canonical_entrypoint !== "/skills") {
    throw new Error(`public-support-snapshot-invalid:evidence_policy.canonical_entrypoint`);
  }
  if (parsed.evidence_policy.registry_schema_ref !== LIVE_RUNTIME_LANE_RECORD_SCHEMA_REF) {
    throw new Error(`public-support-snapshot-invalid:evidence_policy.registry_schema_ref`);
  }
  validateEvidenceRefExists(
    repoRoot,
    parsed.evidence_policy.registry_schema_ref,
    "evidence_policy.registry_schema_ref",
  );
  validateRunbookPolicy(parsed.evidence_policy.runbook_policy, "evidence_policy.runbook_policy");
  if (!parsed.support_policy || typeof parsed.support_policy !== "object") {
    throw new Error(`public-support-snapshot-invalid:support_policy`);
  }
  if (!Array.isArray(parsed.runtime_lanes)) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes`);
  }
  if (!Array.isArray(parsed.known_issues)) {
    throw new Error(`public-support-snapshot-invalid:known_issues`);
  }
  if (!Array.isArray(parsed.release_gates)) {
    throw new Error(`public-support-snapshot-invalid:release_gates`);
  }
  for (const [index, lane] of parsed.runtime_lanes.entries()) {
    const evidenceSources = splitEvidenceRefs(lane?.evidence_source);
    if (evidenceSources.length === 0) {
      throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_source`);
    }
    for (const evidenceSource of evidenceSources) {
      validateEvidenceRefExists(repoRoot, evidenceSource, `runtime_lanes[${index}].evidence_source`);
    }
    validateRequiredEvidenceRefCollection(
      repoRoot,
      lane?.deterministic_evidence_refs,
      `runtime_lanes[${index}].deterministic_evidence_refs`,
    );
    validateRequiredEvidenceRefCollection(
      repoRoot,
      lane?.fake_evidence_refs,
      `runtime_lanes[${index}].fake_evidence_refs`,
    );
    validateRequiredEvidenceRefCollection(
      repoRoot,
      lane?.shim_evidence_refs,
      `runtime_lanes[${index}].shim_evidence_refs`,
    );
    validateEvidenceRefCollection(
      repoRoot,
      lane?.live_evidence_refs,
      `runtime_lanes[${index}].live_evidence_refs`,
    );
    validateEvidenceRefCollection(
      repoRoot,
      lane?.claim_guard_refs,
      `runtime_lanes[${index}].claim_guard_refs`,
    );
    validateEvidenceRefCollection(
      repoRoot,
      lane?.negative_evidence_refs,
      `runtime_lanes[${index}].negative_evidence_refs`,
    );
    validateLiveRuntimeLaneRecord(repoRoot, lane, index);
  }
  return {
    evidence_policy: clone(parsed.evidence_policy),
    version: version ?? parsed?.version ?? "0.4.0",
    support_policy: clone(parsed.support_policy),
    runtime_lanes: normalizeSnapshotCollection(parsed?.runtime_lanes),
    known_issues: normalizeSnapshotCollection(parsed?.known_issues),
    release_gates: normalizeSnapshotCollection(parsed?.release_gates),
  };
}

export function normalizePublicOsLane(os) {
  return PLATFORM_TO_OS_LANE[os] ?? null;
}

export function findPublicCompatibilityLane({
  repoRoot = null,
  runtime,
  target,
  os,
  snapshot = null,
}) {
  const osLane = normalizePublicOsLane(os);
  if (!osLane) {
    return null;
  }
  const publicSupport = snapshot ?? loadPublicSupportSnapshot(repoRoot);
  return (
    publicSupport.runtime_lanes.find(
      (lane) => lane.runtime_id === runtime && lane.target === target && lane.os_lane === osLane,
    ) ?? null
  );
}

export function hasRecordedLiveTestedRange(lane) {
  return Boolean(lane?.live_tested_range && lane.live_tested_range !== "none recorded");
}

export function publicSupportLevelToDoctorLaneStatus(supportLevel) {
  if (supportLevel === "prep") {
    return "prep";
  }
  if (supportLevel === "blocked" || supportLevel === "known-broken") {
    return "unsupported";
  }
  return "supported";
}

export function loadAuthoritativeCatalog({ repoRoot, version = null }: any = {}) {
  const packRecords = loadPackCatalogRecords(repoRoot, { includeAdvanced: true });
  const publicSupport = loadPublicSupportSnapshot(repoRoot, { version });
  return {
    kind: "pairslash-authoritative-catalog",
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    repo_root: repoRoot ? resolve(repoRoot) : null,
    summary: {
      pack_count: packRecords.length,
      core_operational_count: packRecords.filter((record) => record.catalog_scope === "core").length,
      excluded_count: packRecords.filter((record) => record.catalog_status === "excluded").length,
      public_support_lane_count: publicSupport.runtime_lanes.length,
    },
    pack_records: packRecords,
    public_support: publicSupport,
  };
}

export function selectDefaultCatalogPack(records) {
  const coreRecords = records
    .filter((record) =>
      record.catalog_scope === "core" &&
      record.catalog_status === "operational" &&
      record.default_discovery !== false &&
      record.workflow_maturity !== "deprecated" &&
      record.effective_workflow_maturity !== "deprecated" &&
      !["deprecated", "archived"].includes(record.deprecation_status ?? "active"),
    )
    .slice()
    .sort((left, right) => {
      const leftMaturityRank = workflowMaturityRank(left.effective_workflow_maturity);
      const rightMaturityRank = workflowMaturityRank(right.effective_workflow_maturity);
      if (leftMaturityRank !== rightMaturityRank) {
        return rightMaturityRank - leftMaturityRank;
      }
      if (left.workflow_maturity_blocked !== right.workflow_maturity_blocked) {
        return left.workflow_maturity_blocked ? 1 : -1;
      }
      if (left.default_recommendation !== right.default_recommendation) {
        return left.default_recommendation ? -1 : 1;
      }
      const leftReleaseRank = left.maturity === "stable" ? 0 : left.maturity === "preview" ? 1 : 2;
      const rightReleaseRank = right.maturity === "stable" ? 0 : right.maturity === "preview" ? 1 : 2;
      if (leftReleaseRank !== rightReleaseRank) {
        return leftReleaseRank - rightReleaseRank;
      }
      return left.id.localeCompare(right.id);
    });
  return coreRecords[0] ?? null;
}

export function buildPackCatalogIndex(
  repoRoot,
  {
    version = "0.4.0",
    lastUpdated = new Date().toISOString().slice(0, 10),
  } = {},
) {
  const records = loadPackCatalogRecords(repoRoot, { includeAdvanced: true });
  const coreRecords = records.filter((record) =>
    record.catalog_scope === "core" && record.catalog_status === "operational");
  const excludedRecords = records.filter((record) =>
    !(record.catalog_scope === "core" && record.catalog_status === "operational"));
  return {
    version,
    model: "pack-manifest-derived-index",
    generated_from: {
      core_manifest_root: "packs/core",
      compatibility_matrix: SHARED_RUNTIME_SURFACE_MATRIX,
    },
    last_updated: lastUpdated,
    packs: coreRecords.map((record) => ({
      id: record.id,
      version: record.version,
      phase: record.phase,
      status: record.status,
      pack_class: record.pack_class,
      category: record.category,
      release_channel: record.release_channel,
      workflow_maturity: record.workflow_maturity,
      effective_workflow_maturity: record.effective_workflow_maturity,
      workflow_transition_from: record.workflow_transition_from,
      workflow_transition_reason: record.workflow_transition_reason,
      workflow_transition_legal: record.workflow_transition_legal,
      workflow_maturity_blocked: record.workflow_maturity_blocked,
      workflow_maturity_blockers: record.workflow_maturity_blockers,
      workflow_promotion_ready: record.workflow_promotion_ready,
      workflow_promotion_checklist_ready: record.workflow_promotion_checklist_ready,
      workflow_demotion_triggers_active: record.workflow_demotion_triggers_active,
      workflow_promotion_checklist: record.workflow_promotion_checklist,
      workflow_demotion_policy: record.workflow_demotion_policy,
      workflow_evidence: record.workflow_evidence,
      scoped_release_gate_status: record.scoped_release_gate_status,
      support_scope: record.support_scope,
      trust_tier: record.trust_tier,
      docs_visibility: record.docs_visibility,
      default_discovery: record.default_discovery,
      default_recommendation: record.default_recommendation,
      release_visibility: record.release_visibility,
      deprecation_status: record.deprecation_status,
      metadata_file: record.pack_manifest,
      trust_descriptor: record.trust_descriptor,
      skill_file: record.skill_file,
      contract_file: record.contract_file,
      spec_file: record.spec_file,
      compatibility_matrix: record.compatibility_matrix,
      validation_checklist: record.validation_checklist,
      runtime_support: Object.fromEntries(
        SUPPORTED_RUNTIMES.map((runtime) => [
          runtime,
          {
            manifest_status: record.runtime_support[runtime].manifest_status,
            declared_status: record.runtime_support[runtime].declared_status,
            resolved_status: record.runtime_support[runtime].resolved_status,
            evidence_ref: record.runtime_support[runtime].evidence_ref,
            evidence_kind: record.runtime_support[runtime].evidence_kind,
            evidence_present: record.runtime_support[runtime].evidence_present,
            evidence_scope: record.runtime_support[runtime].evidence_scope,
            required_for_promotion: record.runtime_support[runtime].required_for_promotion,
            promotion_evidence_ready: record.runtime_support[runtime].promotion_evidence_ready,
          },
        ]),
      ),
      promotion_ready: record.promotion_ready,
      promotion_blockers: record.promotion_blockers,
    })),
    excluded_repo_manifests: excludedRecords.map((record) => ({
      id: record.id,
      catalog_scope: record.catalog_scope,
      catalog_status: record.catalog_status,
      status: record.status,
      metadata_file: record.pack_manifest,
      support_scope: record.support_scope,
      notes: record.notes ?? [],
    })),
  };
}

export function renderPackCatalogIndexYaml(repoRoot, options = {}) {
  return [
    "# Derived index of canonical core pack manifests.",
    "# Canonical pack semantics live in packs/core/*/pack.manifest.yaml.",
    stableYaml(buildPackCatalogIndex(repoRoot, options)).trimEnd(),
    "",
  ].join("\n");
}
