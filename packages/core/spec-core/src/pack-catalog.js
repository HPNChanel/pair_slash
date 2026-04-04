import { readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import YAML from "yaml";

import { SUPPORTED_RUNTIMES } from "./constants.js";
import { loadPackManifestRecords } from "./manifest.js";
import {
  evaluateRuntimeSupportClaim,
  loadPackTrustDescriptorRecord,
} from "./release-trust.js";
import { exists, relativeFrom, stableYaml, walkFiles } from "./utils.js";

const SHARED_RUNTIME_SURFACE_MATRIX = "docs/compatibility/runtime-surface-matrix.yaml";

export const DEFAULT_PUBLIC_SUPPORT_POLICY = Object.freeze({
  stable_tested:
    "Deterministic compat-lab gates are green and a matching live runtime lane has recorded evidence.",
  degraded:
    "Deterministic compat-lab gates are green, but support is reduced by missing or partial live evidence or by documented caveats.",
  prep:
    "Doctor and preview are expected to work, but install claims are not yet recorded as live evidence.",
  known_broken:
    "PairSlash has an explicit known issue or blocked surface. No silent fallback is allowed.",
});

export const DEFAULT_PUBLIC_COMPATIBILITY_LANES = Object.freeze([
  {
    runtime: "Codex CLI",
    runtime_id: "codex_cli",
    target: "repo",
    os_lane: "macOS",
    support_level: "stable-tested",
    recommended_version: "0.116.0",
    live_tested_range: "0.116.0",
    deterministic_lab_baseline: "0.116.0",
    support_semantics:
      "Canonical release lane. Use this lane when you need the strongest PairSlash support claim.",
    release_gate: "required",
    evidence_source:
      "docs/compatibility/compatibility-matrix.md; docs/compatibility/runtime-verification.md; docs/runtime-mapping/pilot-acceptance.md",
  },
  {
    runtime: "GitHub Copilot CLI",
    runtime_id: "copilot_cli",
    target: "user",
    os_lane: "Linux",
    support_level: "degraded",
    recommended_version: "2.50.x",
    live_tested_range: "none recorded",
    deterministic_lab_baseline: "2.50.0",
    support_semantics:
      "Deterministically covered in compat-lab, but live runtime evidence is not yet bounded enough for stable-tested claims.",
    release_gate: "required",
    evidence_source:
      "docs/compatibility/compatibility-matrix.md; docs/compatibility/runtime-verification.md; docs/runtime-mapping/pilot-acceptance.md",
  },
  {
    runtime: "Codex CLI",
    runtime_id: "codex_cli",
    target: "repo",
    os_lane: "Windows",
    support_level: "prep",
    recommended_version: "0.116.0",
    live_tested_range: "none recorded",
    deterministic_lab_baseline: "0.116.0",
    support_semantics:
      "Doctor and preview are expected; install evidence remains prep-only until manual live verification is recorded.",
    release_gate: "nightly-only",
    evidence_source:
      "docs/compatibility/compatibility-matrix.md; docs/compatibility/runtime-verification.md; docs/runtime-mapping/pilot-acceptance.md",
  },
  {
    runtime: "GitHub Copilot CLI",
    runtime_id: "copilot_cli",
    target: "user",
    os_lane: "Windows",
    support_level: "prep",
    recommended_version: "2.50.x",
    live_tested_range: "none recorded",
    deterministic_lab_baseline: "2.50.0",
    support_semantics:
      "Doctor and preview are expected; install evidence remains prep-only until manual live verification is recorded.",
    release_gate: "nightly-only",
    evidence_source:
      "docs/compatibility/compatibility-matrix.md; docs/compatibility/runtime-verification.md; docs/runtime-mapping/pilot-acceptance.md",
  },
]);

export const DEFAULT_PUBLIC_KNOWN_ISSUES = Object.freeze([
  {
    id: "K1",
    surface: "Copilot direct invocation with -p/--prompt",
    status: "known-broken",
    affected_lanes: "GitHub Copilot CLI",
    details: "Use /skills as the canonical entrypoint. Prompt-mode direct invocation remains blocked.",
  },
  {
    id: "K2",
    surface: "Windows live install evidence",
    status: "prep",
    affected_lanes: "Codex CLI repo, GitHub Copilot CLI user",
    details: "Compat-lab covers doctor and preview; stable-tested claims require manual live install evidence.",
  },
  {
    id: "K3",
    surface: "Codex read-only sandbox complex PowerShell",
    status: "degraded",
    affected_lanes: "Codex CLI",
    details: "Prefer simple single-statement PowerShell commands in verification and troubleshooting steps.",
  },
]);

export const DEFAULT_PUBLIC_RELEASE_GATES = Object.freeze([
  {
    id: "quick-pr",
    trigger: "pull_request and push",
    checks: ["lint", "unit", "compat goldens", "matrix sync"],
    required_for_release: true,
    notes: "Fast deterministic gate that blocks obvious compiler/installer/docs regressions.",
  },
  {
    id: "cross-os-acceptance",
    trigger: "pull_request and push",
    checks: ["macOS Codex acceptance", "Linux Copilot acceptance", "Windows prep acceptance"],
    required_for_release: true,
    notes: "Cross-OS installability and doctor coverage with fake runtimes and deterministic lanes.",
  },
  {
    id: "nightly-smoke",
    trigger: "nightly schedule or workflow_dispatch",
    checks: ["fixture smoke matrix", "behavior evals", "artifact regeneration check"],
    required_for_release: true,
    notes: "Deeper regression control without forcing the full cost into every PR.",
  },
  {
    id: "release-readiness",
    trigger: "manual pre-release gate",
    checks: ["full JS suite", "compat-lab suite", "public docs present", "generated artifacts up to date"],
    required_for_release: true,
    notes: "Release promotion must not proceed unless this gate is green.",
  },
]);

const PLATFORM_TO_OS_LANE = Object.freeze({
  darwin: "macOS",
  linux: "Linux",
  win32: "Windows",
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toPosixPath(value) {
  return value.replace(/\\/g, "/");
}

function relativePosix(repoRoot, filePath) {
  return toPosixPath(relativeFrom(resolve(repoRoot), resolve(filePath)));
}

function readYamlFile(filePath) {
  return YAML.parse(readFileSync(filePath, "utf8"));
}

function discoverAdvancedManifestPaths(repoRoot) {
  const advancedRoot = resolve(repoRoot, "packs", "advanced");
  if (!exists(advancedRoot)) {
    return [];
  }
  return walkFiles(advancedRoot)
    .filter((filePath) => basename(filePath) === "pack.manifest.yaml")
    .sort((left, right) => left.localeCompare(right));
}

function normalizeSnapshotCollection(value) {
  return Array.isArray(value) ? clone(value) : [];
}

function normalizeEvidenceScope(evidenceRef) {
  if (typeof evidenceRef !== "string" || evidenceRef.trim() === "") {
    return "missing";
  }
  if (/^[a-z]+:\/\//i.test(evidenceRef)) {
    return "remote";
  }
  const [pathPart, fragment] = evidenceRef.split("#", 2);
  const normalizedPath = toPosixPath(pathPart);
  if (normalizedPath === SHARED_RUNTIME_SURFACE_MATRIX) {
    return fragment ? "shared-matrix-fragment" : "shared-matrix";
  }
  return "local-file";
}

function isPromotionEvidenceReady(claim) {
  return Boolean(
    claim?.evidence_present &&
      (claim?.required_for_promotion === false || claim?.evidence_kind === "pack-runtime-live"),
  );
}

function buildCatalogRuntimeSupport({
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

function buildPromotionBlockers(runtimeSupport) {
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

function resolvePackDocPath(sourceRoot, relativePath) {
  return typeof relativePath === "string" && relativePath.trim() !== ""
    ? toPosixPath(join(sourceRoot, relativePath))
    : null;
}

function buildCoreCatalogRecord(repoRoot, record) {
  const descriptorRecord = loadPackTrustDescriptorRecord({
    manifestPath: record.manifestPath,
    manifest: record.manifest,
  });
  const runtimeSupport = buildCatalogRuntimeSupport({
    repoRoot,
    manifest: record.manifest,
    descriptorRecord,
  });
  const sourceRoot = toPosixPath(record.manifest.runtime_assets?.source_root ?? `packs/core/${record.packId}`);
  const supportScope = record.manifest.support?.support_level_claim ?? descriptorRecord.descriptor?.support_level_claim ?? null;
  const maturity = record.manifest.catalog?.maturity ?? record.manifest.release_channel ?? null;
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
    release_channel: maturity,
    maturity,
    support_scope: supportScope,
    support_metadata_complete: Boolean(maturity && supportScope),
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
    trust_tier: record.manifest.support?.tier_claim ?? descriptorRecord.descriptor?.tier_claim ?? null,
    publisher_id: record.manifest.support?.publisher?.publisher_id ?? descriptorRecord.descriptor?.publisher?.publisher_id ?? null,
    publisher_class: record.manifest.support?.publisher?.publisher_class ?? descriptorRecord.descriptor?.publisher?.publisher_class ?? null,
    maintainer_owner: record.manifest.support?.maintainers?.owner ?? null,
    maintainer_contact: record.manifest.support?.maintainers?.contact ?? null,
    runtime_support: runtimeSupport,
    promotion_ready: buildPromotionBlockers(runtimeSupport).length === 0,
    promotion_blockers: buildPromotionBlockers(runtimeSupport),
    descriptor_errors: [...(descriptorRecord.errors ?? [])].sort((left, right) => left.localeCompare(right)),
    descriptor_shim_errors: [...(descriptorRecord.shimErrors ?? [])].sort((left, right) => left.localeCompare(right)),
  };
}

function buildInvalidCoreCatalogRecord(repoRoot, record) {
  const manifest = record.manifest ?? {};
  const sourceRoot = toPosixPath(manifest.runtime_assets?.source_root ?? `packs/core/${record.packId}`);
  const descriptorPath = resolve(record.manifestPath, "..", "pack.trust.yaml");
  const supportScope = manifest.support?.support_level_claim ?? null;
  const maturity = manifest.catalog?.maturity ?? manifest.release_channel ?? null;
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
    release_channel: maturity,
    maturity,
    support_scope: supportScope,
    support_metadata_complete: Boolean(maturity && supportScope),
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

function readAdvancedManifestRecord(repoRoot, manifestPath) {
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
  { includeAdvanced = true } = {},
) {
  const coreRecords = loadPackManifestRecords(repoRoot).map((record) =>
    record.isValid
      ? buildCoreCatalogRecord(repoRoot, record)
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
  return {
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
  if (supportLevel === "known-broken") {
    return "unsupported";
  }
  return "supported";
}

export function loadAuthoritativeCatalog({ repoRoot, version = null } = {}) {
  const packRecords = loadPackCatalogRecords(repoRoot);
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
      record.default_discovery !== false,
    )
    .slice()
    .sort((left, right) =>
      [
        left.default_recommendation ? "0" : "1",
        left.maturity === "stable" ? "0" : left.maturity === "preview" ? "1" : "2",
        left.id,
      ]
        .join("\u0000")
        .localeCompare(
          [
            right.default_recommendation ? "0" : "1",
            right.maturity === "stable" ? "0" : right.maturity === "preview" ? "1" : "2",
            right.id,
          ].join("\u0000"),
        ),
    );
  return coreRecords[0] ?? null;
}

export function buildPackCatalogIndex(
  repoRoot,
  {
    version = "0.4.0",
    lastUpdated = new Date().toISOString().slice(0, 10),
  } = {},
) {
  const records = loadPackCatalogRecords(repoRoot);
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
