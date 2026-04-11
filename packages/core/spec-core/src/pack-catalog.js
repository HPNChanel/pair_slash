import { readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import YAML from "yaml";

import {
  SUPPORTED_RUNTIMES,
  WORKFLOW_MATURITY_LEVELS,
  WORKFLOW_MATURITY_STRENGTH_ORDER,
} from "./constants.js";
import { loadPackManifestRecords } from "./manifest.js";
import {
  evaluateRuntimeSupportClaim,
  loadPackTrustDescriptorRecord,
} from "./release-trust.js";
import { exists, relativeFrom, stableYaml, walkFiles } from "./utils.js";

const SHARED_RUNTIME_SURFACE_MATRIX = "docs/compatibility/runtime-surface-matrix.yaml";
const SCOPED_RELEASE_VERDICT_PATH = "docs/releases/scoped-release-verdict.md";
const LIVE_RUNTIME_EVIDENCE_ROOT = "docs/evidence/live-runtime";
const LIVE_RUNTIME_LANE_RECORD_KIND = "live-runtime-lane-record";
const LIVE_RUNTIME_LANE_RECORD_SCHEMA_VERSION = "1.0.0";
const LIVE_RUNTIME_LANE_RECORD_SCHEMA_REF = `${LIVE_RUNTIME_EVIDENCE_ROOT}/schema.live-runtime-lane-record.yaml`;
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
const ALLOWED_EVIDENCE_VERDICTS = new Set(["pass", "partial", "fail", "blocked", "unrecorded"]);
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
    fake_evidence_refs: ["packages/tools/compat-lab/src/acceptance.js"],
    shim_evidence_refs: ["packages/tools/compat-lab/src/runtime-fixtures.js"],
    live_evidence_refs: [
      "docs-private/compatibility/phase-0-acceptance.md",
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
    fake_evidence_refs: ["packages/tools/compat-lab/src/acceptance.js"],
    shim_evidence_refs: ["packages/tools/compat-lab/src/runtime-fixtures.js"],
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
    fake_evidence_refs: ["packages/tools/compat-lab/src/acceptance.js"],
    shim_evidence_refs: ["packages/tools/compat-lab/src/runtime-fixtures.js"],
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
    fake_evidence_refs: ["packages/tools/compat-lab/src/acceptance.js"],
    shim_evidence_refs: ["packages/tools/compat-lab/src/runtime-fixtures.js"],
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
    throw new Error(`public-support-snapshot-invalid:${errorKey}:${evidenceRef}`);
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

function validateRequiredEvidenceRefCollection(repoRoot, value, errorKey) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`public-support-snapshot-invalid:${errorKey}`);
  }
  validateEvidenceRefCollection(repoRoot, value, errorKey);
}

function normalizeEvidenceRefCollectionForCompare(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry) => typeof entry === "string" && entry.trim() !== "")
    .map((entry) => entry.trim())
    .sort((left, right) => left.localeCompare(right));
}

function normalizeWorkflowMaturity(level) {
  return WORKFLOW_MATURITY_LEVELS.includes(level) ? level : "canary";
}

function workflowMaturityRank(level) {
  return WORKFLOW_MATURITY_STRENGTH_ORDER[normalizeWorkflowMaturity(level)] ?? 0;
}

function pickWeakerWorkflowMaturity(left, right) {
  return workflowMaturityRank(left) <= workflowMaturityRank(right)
    ? normalizeWorkflowMaturity(left)
    : normalizeWorkflowMaturity(right);
}

const WORKFLOW_TRANSITION_MAP = Object.freeze({
  canary: new Set(["canary", "preview", "deprecated"]),
  preview: new Set(["preview", "canary", "beta", "deprecated"]),
  beta: new Set(["beta", "preview", "stable", "deprecated"]),
  stable: new Set(["stable", "beta", "deprecated"]),
  deprecated: new Set(["deprecated"]),
});

const STABLE_WORKFLOW_LANE_SUPPORT_LEVELS = new Set(["stable-tested"]);
const PREVIEW_WORKFLOW_LANE_SUPPORT_LEVELS = new Set(["preview", "stable-tested"]);

function readScopedReleaseGateStatus(repoRoot) {
  const verdictPath = resolve(repoRoot, SCOPED_RELEASE_VERDICT_PATH);
  if (!exists(verdictPath)) {
    return "UNKNOWN";
  }
  const match = readFileSync(verdictPath, "utf8").match(/Gate status:\s*([A-Z-]+)/i);
  return match?.[1]?.toUpperCase() ?? "UNKNOWN";
}

function supportedWorkflowRuntimes(manifest) {
  const runtimes = Array.isArray(manifest?.supported_runtimes)
    ? manifest.supported_runtimes.filter((runtime) => SUPPORTED_RUNTIMES.includes(runtime))
    : [];
  return runtimes.length > 0 ? runtimes : SUPPORTED_RUNTIMES.slice();
}

function workflowSmokeCoverageRuntimes(manifest) {
  return new Set(
    Array.isArray(manifest?.smoke_checks)
      ? manifest.smoke_checks
        .map((check) => check?.runtime)
        .filter((runtime) => SUPPORTED_RUNTIMES.includes(runtime))
      : [],
  );
}

function collectCanaryWorkflowMaturityBlockers(manifest) {
  const blockers = [];
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
  return blockers.sort((left, right) => left.localeCompare(right));
}

function findDefaultPromotionLanes(publicSupport, runtime) {
  const defaultTarget =
    publicSupport?.evidence_policy?.runbook_policy?.runtime_runbooks?.[runtime]?.default_target ?? null;
  return (publicSupport?.runtime_lanes ?? [])
    .filter((lane) =>
      lane.runtime_id === runtime &&
      lane.target === defaultTarget &&
      lane.release_gate === "required")
    .slice()
    .sort((left, right) => left.lane_id.localeCompare(right.lane_id));
}

function findClaimedOrDefaultLanes(manifest, publicSupport, runtime) {
  const claimedLaneIds = Array.isArray(manifest?.support?.promotion_checklist?.claimed_lanes?.[runtime])
    ? manifest.support.promotion_checklist.claimed_lanes[runtime]
    : [];
  const runtimeLanes = (publicSupport?.runtime_lanes ?? []).filter((lane) => lane.runtime_id === runtime);
  if (claimedLaneIds.length > 0) {
    return claimedLaneIds
      .map((laneId) => runtimeLanes.find((lane) => lane.lane_id === laneId) ?? null)
      .filter(Boolean)
      .sort((left, right) => left.lane_id.localeCompare(right.lane_id));
  }
  return findDefaultPromotionLanes(publicSupport, runtime);
}

function normalizePackId(manifest) {
  return manifest?.pack_name ?? manifest?.pack?.id ?? null;
}

function normalizeEvidenceRefDescriptor(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return { path: null, remote: false, fragment: null };
  }
  const [pathPart, fragment] = value.split("#", 2);
  return {
    path: toPosixPath(pathPart),
    remote: isLikelyRemoteRef(value),
    fragment: fragment ?? null,
  };
}

function buildLiveRuntimeLaneRecordIndex(repoRoot, publicSupport) {
  const byEvidenceRef = new Map();
  const byLaneId = new Map();
  for (const lane of publicSupport?.runtime_lanes ?? []) {
    const evidenceDataRef = laneEvidenceDataRef(lane);
    if (typeof evidenceDataRef !== "string" || evidenceDataRef.trim() === "") {
      continue;
    }
    const normalizedRef = toPosixPath(evidenceDataRef);
    const record = readYamlFile(resolve(repoRoot, normalizedRef));
    byEvidenceRef.set(normalizedRef, { lane, record });
    byLaneId.set(lane.lane_id, { lane, record, evidence_ref: normalizedRef });
  }
  return { byEvidenceRef, byLaneId };
}

function workflowEvidenceScopeMatches(record, packId) {
  const packScope = Array.isArray(record?.pack_scope) ? record.pack_scope : [];
  const workflowScope = Array.isArray(record?.workflow_scope) ? record.workflow_scope : [];
  return !packId || packScope.includes(packId) || workflowScope.includes(packId);
}

function countMatchingWorkflowVerificationRuns(record, packId) {
  return (record?.live_records ?? []).filter((liveRecord) =>
    liveRecord?.verdict === "pass" &&
    liveRecord?.freshness_state === "fresh" &&
    liveRecord?.entrypoint_path_used === "/skills" &&
    ["live_verification", "repeated_live_verification"].includes(liveRecord?.evidence_class) &&
    workflowEvidenceScopeMatches(liveRecord, packId)
  ).length;
}

function resolveWorkflowEvidenceAnalysis({ manifest, runtime, publicSupport, laneRecordIndex }) {
  const packId = normalizePackId(manifest);
  const lanes = findClaimedOrDefaultLanes(manifest, publicSupport, runtime);
  const laneIds = new Set(lanes.map((lane) => lane.lane_id));
  const refs = Array.isArray(manifest?.support?.workflow_evidence?.live_workflow_refs?.[runtime])
    ? manifest.support.workflow_evidence.live_workflow_refs[runtime]
    : [];
  const invalidBlockers = [];
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
      .reduce((sum, entry) => sum + entry.verification_run_count, 0),
  };
}

function collectPreviewWorkflowMaturityBlockers(manifest, runtimeSupport, publicSupport, laneRecordIndex) {
  const blockers = [];
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
    const validOperationalSafetyRefs = operationalSafetyRefs.filter((evidenceRef) => {
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
  return blockers.sort((left, right) => left.localeCompare(right));
}

function collectBetaWorkflowMaturityBlockers(manifest, publicSupport, laneRecordIndex) {
  const blockers = [];
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
  return [...new Set(blockers)].sort((left, right) => left.localeCompare(right));
}

function collectStableWorkflowMaturityBlockers(manifest, runtimeSupport, publicSupport, releaseGateStatus, laneRecordIndex) {
  const blockers = [];
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
    const operationalSafetyVerificationRuns = operationalSafetyRefs.reduce((sum, evidenceRef) => {
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
  return blockers.sort((left, right) => left.localeCompare(right));
}

function collectDeprecatedWorkflowMaturityBlockers(manifest) {
  const blockers = [];
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
  return blockers.sort((left, right) => left.localeCompare(right));
}

function deriveDemotionTriggersFromBlockers(blockers) {
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
  return [...triggerCodes].sort((left, right) => left.localeCompare(right));
}

function normalizeWorkflowTransitionFrom(manifest, assigned) {
  const transitionFrom = manifest?.support?.workflow_transition?.from;
  return WORKFLOW_MATURITY_LEVELS.includes(transitionFrom) ? transitionFrom : assigned;
}

function isWorkflowTransitionLegal(transitionFrom, assigned) {
  if (!WORKFLOW_MATURITY_LEVELS.includes(transitionFrom) || !WORKFLOW_MATURITY_LEVELS.includes(assigned)) {
    return false;
  }
  return WORKFLOW_TRANSITION_MAP[transitionFrom]?.has(assigned) ?? false;
}

function promotionChecklistReady(manifest) {
  const checklist = manifest?.support?.promotion_checklist;
  if (!isObject(checklist)) {
    return false;
  }
  return (
    checklist.required_for_label === manifest?.support?.workflow_maturity &&
    checklist.canonical_entrypoint_verified === true
  );
}

function resolveWorkflowMaturity({ repoRoot, manifest, runtimeSupport, publicSupport, laneRecordIndex }) {
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
  const dedupedBlockers = [...new Set(blockers)].sort((left, right) => left.localeCompare(right));
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

function validateEvidenceRefCollectionsMatch(laneRefs, recordRefs, errorKey) {
  const left = normalizeEvidenceRefCollectionForCompare(laneRefs);
  const right = normalizeEvidenceRefCollectionForCompare(recordRefs);
  if (stableYaml(left) !== stableYaml(right)) {
    throw new Error(`public-support-snapshot-invalid:${errorKey}`);
  }
}

function validateStringArray(value, errorKey) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`public-support-snapshot-invalid:${errorKey}`);
  }
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new Error(`public-support-snapshot-invalid:${errorKey}`);
    }
  }
}

function validateIsoTimestamp(value, errorKey) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`public-support-snapshot-invalid:${errorKey}`);
  }
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`public-support-snapshot-invalid:${errorKey}`);
  }
}

function validateRunbookPolicy(value, errorKey) {
  if (!isObject(value)) {
    throw new Error(`public-support-snapshot-invalid:${errorKey}`);
  }
  validateStringArray(value.smoke_boundary?.counts_as, `${errorKey}.smoke_boundary.counts_as`);
  validateStringArray(
    value.smoke_boundary?.never_sufficient_for,
    `${errorKey}.smoke_boundary.never_sufficient_for`,
  );
  validateStringArray(
    value.live_verification_boundary?.required_for_public_lane_claim,
    `${errorKey}.live_verification_boundary.required_for_public_lane_claim`,
  );
  validateStringArray(
    value.live_verification_boundary?.repeated_live_verification_requires,
    `${errorKey}.live_verification_boundary.repeated_live_verification_requires`,
  );
  validateStringArray(
    value.manual_vs_scripted_boundary?.scripted_steps_allowed,
    `${errorKey}.manual_vs_scripted_boundary.scripted_steps_allowed`,
  );
  validateStringArray(
    value.manual_vs_scripted_boundary?.manual_steps_required,
    `${errorKey}.manual_vs_scripted_boundary.manual_steps_required`,
  );
  validateStringArray(
    value.manual_vs_scripted_boundary?.forbidden_substitutions,
    `${errorKey}.manual_vs_scripted_boundary.forbidden_substitutions`,
  );
  validateStringArray(value.host_profile_required_fields, `${errorKey}.host_profile_required_fields`);
  validateStringArray(
    value.command_capture_requirements?.required_artifacts,
    `${errorKey}.command_capture_requirements.required_artifacts`,
  );
  if (!isObject(value.runtime_runbooks)) {
    throw new Error(`public-support-snapshot-invalid:${errorKey}.runtime_runbooks`);
  }
  for (const runtimeId of ["codex_cli", "copilot_cli"]) {
    const runbook = value.runtime_runbooks[runtimeId];
    if (!isObject(runbook)) {
      throw new Error(`public-support-snapshot-invalid:${errorKey}.runtime_runbooks.${runtimeId}`);
    }
    if (typeof runbook.default_target !== "string" || runbook.default_target.trim() === "") {
      throw new Error(`public-support-snapshot-invalid:${errorKey}.runtime_runbooks.${runtimeId}.default_target`);
    }
    validateStringArray(
      runbook.required_tool_presence,
      `${errorKey}.runtime_runbooks.${runtimeId}.required_tool_presence`,
    );
    validateStringArray(
      runbook.required_commands,
      `${errorKey}.runtime_runbooks.${runtimeId}.required_commands`,
    );
    validateStringArray(
      runbook.minimum_capabilities_for_preview_lane,
      `${errorKey}.runtime_runbooks.${runtimeId}.minimum_capabilities_for_preview_lane`,
    );
    if (!isObject(runbook.direct_invocation)) {
      throw new Error(`public-support-snapshot-invalid:${errorKey}.runtime_runbooks.${runtimeId}.direct_invocation`);
    }
    if (
      typeof runbook.direct_invocation.public_claim !== "string" ||
      runbook.direct_invocation.public_claim.trim() === ""
    ) {
      throw new Error(
        `public-support-snapshot-invalid:${errorKey}.runtime_runbooks.${runtimeId}.direct_invocation.public_claim`,
      );
    }
    if (typeof runbook.direct_invocation.promotion_requires_canonical_picker !== "boolean") {
      throw new Error(
        `public-support-snapshot-invalid:${errorKey}.runtime_runbooks.${runtimeId}.direct_invocation.promotion_requires_canonical_picker`,
      );
    }
    if (
      runtimeId === "codex_cli" &&
      runbook.direct_invocation.codex_exec_max_evidence_class !== "live_smoke"
    ) {
      throw new Error(
        `public-support-snapshot-invalid:${errorKey}.runtime_runbooks.${runtimeId}.direct_invocation.codex_exec_max_evidence_class`,
      );
    }
  }
  validateStringArray(value.windows_promotion_gate?.requires, `${errorKey}.windows_promotion_gate.requires`);
  if (value.windows_promotion_gate?.doctor_and_preview_never_enough !== true) {
    throw new Error(`public-support-snapshot-invalid:${errorKey}.windows_promotion_gate.doctor_and_preview_never_enough`);
  }
}

function validateLiveLaneRecordCollection(repoRoot, value, errorKey, lane = null) {
  if (!Array.isArray(value)) {
    throw new Error(`public-support-snapshot-invalid:${errorKey}`);
  }
  const isNegativeCollection = errorKey.endsWith("negative_live_records");
  for (const [index, record] of value.entries()) {
    if (!isObject(record)) {
      throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}]`);
    }
    for (const field of [
      "evidence_id",
      "captured_at",
      "owner_id",
      "host_profile_id",
      "runtime_id",
      "target",
      "os_lane",
      "entrypoint_path_used",
      "command",
      "summary",
      "verdict",
      "stale_at",
      "expire_at",
    ]) {
      if (typeof record[field] !== "string" || record[field].trim() === "") {
        throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].${field}`);
      }
    }
    if (lane) {
      if (record.runtime_id !== lane.runtime_id) {
        throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].runtime_id`);
      }
      if (record.target !== lane.target) {
        throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].target`);
      }
      if (record.os_lane !== lane.os_lane) {
        throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].os_lane`);
      }
      if (
        ["preview", "stable-tested"].includes(lane.support_level) &&
        record.entrypoint_path_used !== lane.canonical_entrypoint
      ) {
        throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].entrypoint_path_used`);
      }
    }
    validateIsoTimestamp(record.captured_at, `${errorKey}[${index}].captured_at`);
    validateIsoTimestamp(record.stale_at, `${errorKey}[${index}].stale_at`);
    validateIsoTimestamp(record.expire_at, `${errorKey}[${index}].expire_at`);
    if (Date.parse(record.stale_at) > Date.parse(record.expire_at)) {
      throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].stale_expiry_order`);
    }
    validateStringArray(record.pack_scope, `${errorKey}[${index}].pack_scope`);
    validateStringArray(record.workflow_scope, `${errorKey}[${index}].workflow_scope`);
    validateStringArray(record.capability_scope, `${errorKey}[${index}].capability_scope`);
    validateEvidenceRefCollection(repoRoot, record.artifact_paths, `${errorKey}[${index}].artifact_paths`);
    const evidenceClassField = "evidence_class" in record ? "evidence_class" : null;
    if (evidenceClassField && !ALLOWED_LIVE_EVIDENCE_CLASSES.has(record.evidence_class)) {
      throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].evidence_class`);
    }
    if (!ALLOWED_EVIDENCE_VERDICTS.has(record.verdict)) {
      throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].verdict`);
    }
    if (!ALLOWED_FRESHNESS_STATES.has(record.freshness_state)) {
      throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].freshness_state`);
    }
    if (isNegativeCollection) {
      if (typeof record.failure_type !== "string" || record.failure_type.trim() === "") {
        throw new Error(`public-support-snapshot-invalid:${errorKey}[${index}].failure_type`);
      }
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
  if (record.registry_schema_ref !== LIVE_RUNTIME_LANE_RECORD_SCHEMA_REF) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.registry_schema_ref`);
  }
  validateEvidenceRefExists(
    repoRoot,
    record.registry_schema_ref,
    `runtime_lanes[${index}].evidence_record.registry_schema_ref`,
  );
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
  validateStringArray(record.pack_scope, `runtime_lanes[${index}].evidence_record.pack_scope`);
  validateStringArray(record.workflow_scope, `runtime_lanes[${index}].evidence_record.workflow_scope`);
  validateStringArray(record.capability_scope, `runtime_lanes[${index}].evidence_record.capability_scope`);
  if (!Number.isInteger(record.stale_after_days) || record.stale_after_days < 0) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.stale_after_days`);
  }
  if (!Number.isInteger(record.expire_after_days) || record.expire_after_days < record.stale_after_days) {
    throw new Error(`public-support-snapshot-invalid:runtime_lanes[${index}].evidence_record.expire_after_days`);
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
  validateEvidenceRefCollectionsMatch(
    lane.deterministic_evidence_refs,
    record.deterministic_evidence_refs,
    `runtime_lanes[${index}].deterministic_evidence_refs`,
  );
  validateEvidenceRefCollectionsMatch(
    lane.fake_evidence_refs,
    record.fake_acceptance_evidence_refs,
    `runtime_lanes[${index}].fake_evidence_refs`,
  );
  validateEvidenceRefCollectionsMatch(
    lane.shim_evidence_refs,
    record.shim_acceptance_evidence_refs,
    `runtime_lanes[${index}].shim_evidence_refs`,
  );
  validateEvidenceRefCollectionsMatch(
    lane.live_evidence_refs,
    record.live_evidence_refs,
    `runtime_lanes[${index}].live_evidence_refs`,
  );
  validateEvidenceRefCollectionsMatch(
    lane.negative_evidence_refs,
    record.negative_evidence_refs,
    `runtime_lanes[${index}].negative_evidence_refs`,
  );
  validateEvidenceRefCollectionsMatch(
    lane.claim_guard_refs,
    record.claim_guard_refs,
    `runtime_lanes[${index}].claim_guard_refs`,
  );
  validateLiveLaneRecordCollection(
    repoRoot,
    record.live_records ?? [],
    `runtime_lanes[${index}].evidence_record.live_records`,
    lane,
  );
  validateLiveLaneRecordCollection(
    repoRoot,
    record.negative_live_records ?? [],
    `runtime_lanes[${index}].evidence_record.negative_live_records`,
    lane,
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

function buildCoreCatalogRecord(repoRoot, record, { publicSupport, laneRecordIndex }) {
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

export function loadAuthoritativeCatalog({ repoRoot, version = null } = {}) {
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
