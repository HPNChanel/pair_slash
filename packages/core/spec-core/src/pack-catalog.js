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
const LIVE_RUNTIME_EVIDENCE_ROOT = "docs/evidence/live-runtime";
const LIVE_RUNTIME_LANE_RECORD_KIND = "live-runtime-lane-record";
const LIVE_RUNTIME_LANE_RECORD_SCHEMA_VERSION = "1.0.0";
const ALLOWED_PUBLIC_SUPPORT_LEVELS = new Set(["stable-tested", "preview", "degraded", "prep", "blocked"]);
const ALLOWED_LIVE_EVIDENCE_CLASSES = new Set([
  "deterministic_test",
  "fake_acceptance",
  "shim_acceptance",
  "live_smoke",
  "live_verification",
  "repeated_live_verification",
]);
const ALLOWED_FRESHNESS_STATES = new Set(["none-recorded", "fresh", "stale", "expired"]);

export const DEFAULT_PUBLIC_SUPPORT_POLICY = Object.freeze({
  blocked:
    "Fresh negative live evidence blocks the exact lane or documented surface until superseded by newer live verification.",
  degraded:
    "Real runtime evidence exists, but the canonical /skills path is missing, partial, or caveated for the documented lane.",
  prep:
    "Deterministic coverage and optional live smoke may exist, but canonical /skills verification is not yet recorded for the documented lane.",
  preview:
    "One fresh canonical live verification exists for the exact lane, but repeated live verification is not recorded yet.",
  stable_tested:
    "Repeated fresh canonical live verification exists for the exact runtime, target, OS, and lane scope.",
});

export const DEFAULT_PUBLIC_COMPATIBILITY_LANES = Object.freeze([
  {
    actual_evidence_class: "live_smoke",
    canonical_entrypoint: "/skills",
    runtime: "Codex CLI",
    runtime_id: "codex_cli",
    target: "repo",
    os_lane: "macOS",
    lane_id: "codex-cli-repo-macos",
    support_level: "degraded",
    recommended_version: "0.116.0",
    live_tested_range: "none recorded",
    deterministic_lab_baseline: "0.116.0",
    support_semantics:
      "Real Codex CLI behavior was observed on macOS repo scope, but only through codex exec/direct invocation and not through a checked-in canonical /skills picker capture. Keep this lane degraded.",
    release_gate: "required",
    evidence_source: `${LIVE_RUNTIME_EVIDENCE_ROOT}/codex-cli-repo-macos.md`,
    evidence_data_ref: `${LIVE_RUNTIME_EVIDENCE_ROOT}/codex-cli-repo-macos.yaml`,
    evidence_summary:
      "Archived direct-invocation live smoke exists for Codex CLI 0.116.0 on macOS repo scope, but canonical /skills evidence is still unrecorded.",
    freshness_state: "fresh",
    host_profile_count: 1,
    last_verified_at: "2026-03-21",
    owner_id: "runtime-truth",
    required_evidence_class: "live_verification",
    deterministic_evidence_refs: [
      "docs/runtime-mapping/pilot-acceptance.md",
      "packages/tools/compat-lab/tests/acceptance.test.js",
      "packages/tools/compat-lab/tests/matrix.test.js",
    ],
    shim_evidence_refs: [
      "packages/tools/compat-lab/src/runtime-fixtures.js",
      "packages/tools/compat-lab/src/acceptance.js",
    ],
    live_evidence_refs: [
      "docs/compatibility/phase-0-acceptance.md",
      ".pairslash/project-memory/60-architecture-decisions/phase-0-codex-cli-verification-on-v0-116-0.yaml",
    ],
    negative_evidence_refs: [
      ".pairslash/project-memory/70-known-good-patterns/codex-exec-as-non-interactive-skill-testing-surface.yaml",
    ],
    claim_guard_refs: [
      "docs/compatibility/runtime-verification.md",
      "docs/releases/public-claim-policy.md",
    ],
    surface_verdicts: {
      canonical_picker: "unrecorded",
      direct_invocation: "pass",
      gh_availability: "not_applicable",
      install_apply: "unrecorded",
      preview_install: "unrecorded",
      runtime_available: "pass",
    },
  },
  {
    actual_evidence_class: null,
    canonical_entrypoint: "/skills",
    runtime: "GitHub Copilot CLI",
    runtime_id: "copilot_cli",
    target: "user",
    os_lane: "Linux",
    lane_id: "copilot-cli-user-linux",
    support_level: "prep",
    recommended_version: "2.50.x",
    live_tested_range: "none recorded",
    deterministic_lab_baseline: "2.50.0",
    support_semantics:
      "Deterministic coverage exists, but no checked-in canonical /skills verification or live install record exists for the Linux user lane. Keep this lane prep-only.",
    release_gate: "required",
    evidence_source: `${LIVE_RUNTIME_EVIDENCE_ROOT}/copilot-cli-user-linux.md`,
    evidence_data_ref: `${LIVE_RUNTIME_EVIDENCE_ROOT}/copilot-cli-user-linux.yaml`,
    evidence_summary:
      "Deterministic installability coverage exists, but no checked-in Linux user /skills verification or live install record is present.",
    freshness_state: "none-recorded",
    host_profile_count: 0,
    last_verified_at: null,
    owner_id: "runtime-truth",
    required_evidence_class: "live_verification",
    deterministic_evidence_refs: [
      "docs/runtime-mapping/pilot-acceptance.md",
      "packages/tools/compat-lab/tests/acceptance.test.js",
      "packages/tools/compat-lab/tests/matrix.test.js",
    ],
    shim_evidence_refs: [
      "packages/tools/compat-lab/src/runtime-fixtures.js",
      "packages/tools/compat-lab/src/acceptance.js",
    ],
    live_evidence_refs: [],
    negative_evidence_refs: [],
    claim_guard_refs: [
      "docs/compatibility/runtime-verification.md",
      "docs/releases/public-claim-policy.md",
    ],
    surface_verdicts: {
      canonical_picker: "unrecorded",
      direct_invocation: "blocked",
      gh_availability: "unrecorded",
      install_apply: "unrecorded",
      preview_install: "unrecorded",
      runtime_available: "unrecorded",
    },
  },
  {
    actual_evidence_class: "live_smoke",
    canonical_entrypoint: "/skills",
    runtime: "Codex CLI",
    runtime_id: "codex_cli",
    target: "repo",
    os_lane: "Windows",
    lane_id: "codex-cli-repo-windows",
    support_level: "prep",
    recommended_version: "0.118.0",
    live_tested_range: "none recorded",
    deterministic_lab_baseline: "0.116.0",
    support_semantics:
      "Real Windows doctor and preview smoke are recorded, but install apply and canonical /skills verification remain unrecorded. Keep this lane prep-only.",
    release_gate: "nightly-only",
    evidence_source: `${LIVE_RUNTIME_EVIDENCE_ROOT}/codex-cli-repo-windows.md`,
    evidence_data_ref: `${LIVE_RUNTIME_EVIDENCE_ROOT}/codex-cli-repo-windows.yaml`,
    evidence_summary:
      "Real Windows doctor and preview smoke were recorded on 2026-04-05, but install apply and canonical /skills evidence remain unrecorded.",
    freshness_state: "fresh",
    host_profile_count: 1,
    last_verified_at: "2026-04-05T12:28:24.545Z",
    owner_id: "runtime-truth",
    required_evidence_class: "live_verification",
    deterministic_evidence_refs: [
      "docs/runtime-mapping/pilot-acceptance.md",
      "packages/tools/compat-lab/tests/acceptance.test.js",
      "packages/tools/compat-lab/tests/matrix.test.js",
    ],
    shim_evidence_refs: [
      "packages/tools/compat-lab/src/runtime-fixtures.js",
      "packages/tools/compat-lab/src/acceptance.js",
    ],
    live_evidence_refs: [`${LIVE_RUNTIME_EVIDENCE_ROOT}/codex-cli-repo-windows.md`],
    negative_evidence_refs: [],
    claim_guard_refs: [
      "docs/compatibility/runtime-verification.md",
      "docs/releases/public-claim-policy.md",
    ],
    surface_verdicts: {
      canonical_picker: "unrecorded",
      direct_invocation: "not_recorded",
      gh_availability: "not_applicable",
      install_apply: "unrecorded",
      preview_install: "pass",
      runtime_available: "pass",
    },
  },
  {
    actual_evidence_class: "live_smoke",
    canonical_entrypoint: "/skills",
    runtime: "GitHub Copilot CLI",
    runtime_id: "copilot_cli",
    target: "user",
    os_lane: "Windows",
    lane_id: "copilot-cli-user-windows",
    support_level: "prep",
    recommended_version: "2.50.x",
    live_tested_range: "none recorded",
    deterministic_lab_baseline: "2.50.0",
    support_semantics:
      "A real Windows host probe was captured, but gh was unavailable locally and no canonical /skills or install proof exists. Keep this lane prep-only.",
    release_gate: "nightly-only",
    evidence_source: `${LIVE_RUNTIME_EVIDENCE_ROOT}/copilot-cli-user-windows.md`,
    evidence_data_ref: `${LIVE_RUNTIME_EVIDENCE_ROOT}/copilot-cli-user-windows.yaml`,
    evidence_summary:
      "A real Windows host probe was recorded on 2026-04-05, but gh was unavailable locally and preview blocked explicitly.",
    freshness_state: "fresh",
    host_profile_count: 1,
    last_verified_at: "2026-04-05T12:28:23.177Z",
    owner_id: "runtime-truth",
    required_evidence_class: "live_verification",
    deterministic_evidence_refs: [
      "docs/runtime-mapping/pilot-acceptance.md",
      "packages/tools/compat-lab/tests/acceptance.test.js",
      "packages/tools/compat-lab/tests/matrix.test.js",
    ],
    shim_evidence_refs: [
      "packages/tools/compat-lab/src/runtime-fixtures.js",
      "packages/tools/compat-lab/src/acceptance.js",
    ],
    live_evidence_refs: [`${LIVE_RUNTIME_EVIDENCE_ROOT}/copilot-cli-user-windows.md`],
    negative_evidence_refs: [`${LIVE_RUNTIME_EVIDENCE_ROOT}/copilot-cli-user-windows.md`],
    claim_guard_refs: [
      "docs/compatibility/runtime-verification.md",
      "docs/releases/public-claim-policy.md",
    ],
    surface_verdicts: {
      canonical_picker: "unrecorded",
      direct_invocation: "blocked",
      gh_availability: "fail",
      install_apply: "blocked",
      preview_install: "fail",
      runtime_available: "fail",
    },
  },
]);

export const DEFAULT_PUBLIC_KNOWN_ISSUES = Object.freeze([
  {
    id: "K1",
    surface: "Copilot direct invocation with -p/--prompt",
    status: "blocked",
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

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function isLikelyRemoteRef(value) {
  return typeof value === "string" && /^[a-z]+:\/\//i.test(value);
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

function splitEvidenceRefs(value) {
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);
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

function laneEvidenceDataRef(lane) {
  if (typeof lane?.evidence_data_ref === "string" && lane.evidence_data_ref.trim() !== "") {
    return lane.evidence_data_ref;
  }
  if (typeof lane?.evidence_source !== "string") {
    return null;
  }
  return lane.evidence_source.endsWith(".md")
    ? `${lane.evidence_source.slice(0, -3)}.yaml`
    : null;
}

function validateEvidenceRefExists(repoRoot, evidenceRef, errorKey) {
  if (typeof evidenceRef !== "string" || evidenceRef.trim() === "") {
    throw new Error(`public-support-snapshot-invalid:${errorKey}`);
  }
  if (isLikelyRemoteRef(evidenceRef)) {
    return;
  }
  const [pathPart] = evidenceRef.split("#", 1);
  if (!exists(resolve(repoRoot, pathPart))) {
    throw new Error(`public-support-snapshot-invalid:${errorKey}:${pathPart}`);
  }
}

function validateEvidenceRefCollection(repoRoot, value, errorKey) {
  if (value == null) {
    return;
  }
  if (!Array.isArray(value)) {
    throw new Error(`public-support-snapshot-invalid:${errorKey}`);
  }
  for (const evidenceRef of value) {
    if (typeof evidenceRef !== "string" || evidenceRef.trim() === "") {
      throw new Error(`public-support-snapshot-invalid:${errorKey}`);
    }
    validateEvidenceRefExists(repoRoot, evidenceRef, errorKey);
  }
}

function validateLiveLaneRecordCollection(repoRoot, value, errorKey) {
  if (!Array.isArray(value)) {
    throw new Error(`public-support-snapshot-invalid:${errorKey}`);
  }
  for (const [index, record] of value.entries()) {
    if (!isObject(record)) {
      throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}]`);
    }
    for (const field of ["evidence_id", "captured_at", "owner_id", "host_profile_id", "summary"]) {
      if (typeof record[field] !== "string" || record[field].trim() === "") {
        throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].${field}`);
      }
    }
    const evidenceClassField = "evidence_class" in record ? "evidence_class" : null;
    if (evidenceClassField && !ALLOWED_LIVE_EVIDENCE_CLASSES.has(record.evidence_class)) {
      throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].evidence_class`);
    }
    if (!ALLOWED_FRESHNESS_STATES.has(record.freshness_state)) {
      throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].freshness_state`);
    }
    if ("command_capture_refs" in record) {
      validateEvidenceRefCollection(repoRoot, record.command_capture_refs, `${errorKey}[${index}].command_capture_refs`);
    }
    if ("refs" in record) {
      validateEvidenceRefCollection(repoRoot, record.refs, `${errorKey}[${index}].refs`);
    }
  }
}

function validateLiveRuntimeLaneRecord(repoRoot, lane, index) {
  const evidenceDataRef = laneEvidenceDataRef(lane);
  if (typeof evidenceDataRef !== "string" || evidenceDataRef.trim() === "") {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_data_ref`);
  }
  validateEvidenceRefExists(repoRoot, evidenceDataRef, `runtime_lanes[${index}].evidence_data_ref`);
  const record = readYamlFile(resolve(repoRoot, evidenceDataRef));
  if (!isObject(record)) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record`);
  }
  if (record.kind !== LIVE_RUNTIME_LANE_RECORD_KIND) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.kind`);
  }
  if (record.schema_version !== LIVE_RUNTIME_LANE_RECORD_SCHEMA_VERSION) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.schema_version`);
  }
  const expectedLaneId = lane?.lane_id;
  if (typeof expectedLaneId !== "string" || expectedLaneId.trim() === "") {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].lane_id`);
  }
  if (record.lane_id !== expectedLaneId) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.lane_id`);
  }
  if (record.runtime_id !== lane.runtime_id) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.runtime_id`);
  }
  if (record.target !== lane.target) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.target`);
  }
  if (record.os_lane !== lane.os_lane) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.os_lane`);
  }
  if (record.canonical_entrypoint !== "/skills" || lane.canonical_entrypoint !== "/skills") {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].canonical_entrypoint`);
  }
  if (!ALLOWED_PUBLIC_SUPPORT_LEVELS.has(lane.support_level)) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].support_level`);
  }
  if (record.current_public_support_level !== lane.support_level) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.current_public_support_level`);
  }
  if (!ALLOWED_LIVE_EVIDENCE_CLASSES.has(record.required_evidence_class)) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.required_evidence_class`);
  }
  if (lane.required_evidence_class !== record.required_evidence_class) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].required_evidence_class`);
  }
  if (
    record.best_live_evidence_class !== null &&
    !ALLOWED_LIVE_EVIDENCE_CLASSES.has(record.best_live_evidence_class)
  ) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.best_live_evidence_class`);
  }
  if (lane.actual_evidence_class !== record.best_live_evidence_class) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].actual_evidence_class`);
  }
  if (!ALLOWED_FRESHNESS_STATES.has(record.freshness_state) || lane.freshness_state !== record.freshness_state) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].freshness_state`);
  }
  if (!Number.isInteger(record.host_profile_count) || record.host_profile_count < 0) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.host_profile_count`);
  }
  if (lane.host_profile_count !== record.host_profile_count) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].host_profile_count`);
  }
  if (lane.owner_id !== record.owner_id) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].owner_id`);
  }
  if (!isObject(record.surface_verdicts) || !isObject(lane.surface_verdicts)) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].surface_verdicts`);
  }
  if (stableYaml(record.surface_verdicts) !== stableYaml(lane.surface_verdicts)) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].surface_verdicts`);
  }
  if (typeof record.caveat_summary !== "string" || record.caveat_summary.trim() === "") {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.caveat_summary`);
  }
  validateEvidenceRefCollection(
    repoRoot,
    record.deterministic_evidence_refs,
    `runtime_lanes[${index}].evidence_record.deterministic_evidence_refs`,
  );
  validateEvidenceRefCollection(
    repoRoot,
    record.fake_acceptance_evidence_refs,
    `runtime_lanes[${index}].evidence_record.fake_acceptance_evidence_refs`,
  );
  validateEvidenceRefCollection(
    repoRoot,
    record.shim_acceptance_evidence_refs,
    `runtime_lanes[${index}].evidence_record.shim_acceptance_evidence_refs`,
  );
  validateEvidenceRefCollection(
    repoRoot,
    record.live_evidence_refs,
    `runtime_lanes[${index}].evidence_record.live_evidence_refs`,
  );
  validateEvidenceRefCollection(
    repoRoot,
    record.negative_evidence_refs,
    `runtime_lanes[${index}].evidence_record.negative_evidence_refs`,
  );
  validateEvidenceRefCollection(
    repoRoot,
    record.claim_guard_refs,
    `runtime_lanes[${index}].evidence_record.claim_guard_refs`,
  );
  validateLiveLaneRecordCollection(repoRoot, record.live_records ?? [], `runtime_lanes[${index}].evidence_record.live_records`);
  validateLiveLaneRecordCollection(
    repoRoot,
    record.negative_live_records ?? [],
    `runtime_lanes[${index}].evidence_record.negative_live_records`,
  );
  if (
    lane.support_level === "stable-tested" &&
    (record.best_live_evidence_class !== "repeated_live_verification" ||
      record.host_profile_count < 2 ||
      record.freshness_state !== "fresh")
  ) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].stable_tested_policy`);
  }
  if (
    lane.support_level === "preview" &&
    (!["live_verification", "repeated_live_verification"].includes(record.best_live_evidence_class) ||
      record.surface_verdicts.canonical_picker !== "pass" ||
      record.freshness_state !== "fresh")
  ) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].preview_policy`);
  }
  if (
    lane.support_level === "degraded" &&
    !["live_smoke", "live_verification", "repeated_live_verification"].includes(record.best_live_evidence_class)
  ) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].degraded_policy`);
  }
  if (
    lane.support_level === "prep" &&
    ["live_verification", "repeated_live_verification"].includes(record.best_live_evidence_class)
  ) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].prep_policy`);
  }
  if (lane.support_level === "blocked" && (record.negative_live_records?.length ?? 0) === 0) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].blocked_policy`);
  }
  return record;
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
  if (!parsed.evidence_policy || typeof parsed.evidence_policy !== "object") {
    throw new Error(`public-support-snapshot-invalid:evidence_policy`);
  }
  if (parsed.evidence_policy.canonical_entrypoint !== "/skills") {
    throw new Error(`public-support-snapshot-invalid:evidence_policy.canonical_entrypoint`);
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
  for (const [index, lane] of parsed.runtime_lanes.entries()) {
    const evidenceSources = splitEvidenceRefs(lane?.evidence_source);
    if (evidenceSources.length === 0) {
      throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_source`);
    }
    for (const evidenceSource of evidenceSources) {
      validateEvidenceRefExists(repoRoot, evidenceSource, `runtime_lanes[${index}].evidence_source`);
    }
    validateEvidenceRefCollection(
      repoRoot,
      lane?.deterministic_evidence_refs,
      `runtime_lanes[${index}].deterministic_evidence_refs`,
    );
    validateEvidenceRefCollection(
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
