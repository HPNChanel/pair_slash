import {
  isOneOf,
  SUPPORTED_RUNTIMES,
} from "../constants.ts";
import {
  exists,
  relativeFrom,
  walkFiles,
} from "../utils.ts";
import {
  readFileSync,
} from "node:fs";
import {
  basename,
  join,
  resolve,
} from "node:path";
import YAML from "yaml";

export const SHARED_RUNTIME_SURFACE_MATRIX = "docs/compatibility/runtime-surface-matrix.yaml";

export const SCOPED_RELEASE_VERDICT_PATH = "docs/releases/scoped-release-verdict.md";

export const LIVE_RUNTIME_EVIDENCE_ROOT = "docs/evidence/live-runtime";

export const LIVE_RUNTIME_LANE_RECORD_KIND = "live-runtime-lane-record";

export const LIVE_RUNTIME_LANE_RECORD_SCHEMA_VERSION = "1.0.0";

export const LIVE_RUNTIME_LANE_RECORD_SCHEMA_REF = `${LIVE_RUNTIME_EVIDENCE_ROOT}/schema.live-runtime-lane-record.yaml`;

export const ALLOWED_PUBLIC_SUPPORT_LEVELS = new Set(["stable-tested", "preview", "degraded", "prep", "blocked"]);

export const ALLOWED_LIVE_EVIDENCE_CLASSES = new Set([
  "deterministic_test",
  "fake_acceptance",
  "shim_acceptance",
  "live_smoke",
  "live_verification",
  "repeated_live_verification",
]);

export const ALLOWED_FRESHNESS_STATES = new Set(["none-recorded", "fresh", "stale", "expired"]);

export const ALLOWED_EVIDENCE_VERDICTS = new Set(["pass", "partial", "fail", "blocked", "unrecorded"]);

export const PLATFORM_TO_OS_LANE = Object.freeze({
  darwin: "macOS",
  linux: "Linux",
  win32: "Windows",
});

export const WORKFLOW_TRANSITION_MAP = Object.freeze({
  canary: new Set(["canary", "preview", "deprecated"]),
  preview: new Set(["preview", "canary", "beta", "deprecated"]),
  beta: new Set(["beta", "preview", "stable", "deprecated"]),
  stable: new Set(["stable", "beta", "deprecated"]),
  deprecated: new Set(["deprecated"]),
});

export const STABLE_WORKFLOW_LANE_SUPPORT_LEVELS = new Set(["stable-tested"]);

export const PREVIEW_WORKFLOW_LANE_SUPPORT_LEVELS = new Set(["preview", "stable-tested"]);

export function clone(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

export function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function toPosixPath(value: string) {
  return value.replace(/\\/g, "/");
}

export function relativePosix(repoRoot: string, filePath: string) {
  return toPosixPath(relativeFrom(resolve(repoRoot), resolve(filePath)));
}

export function readYamlFile(filePath: string) {
  return YAML.parse(readFileSync(filePath, "utf8"));
}

export function isLikelyRemoteRef(value: unknown) {
  return typeof value === "string" && /^[a-z]+:\/\//i.test(value);
}

export function discoverAdvancedManifestPaths(repoRoot: string) {
  const advancedRoot = resolve(repoRoot, "packs", "advanced");
  if (!exists(advancedRoot)) {
    return [];
  }
  return walkFiles(advancedRoot)
    .filter((filePath: string) => basename(filePath) === "pack.manifest.yaml")
    .sort((left: any, right: any) => left.localeCompare(right));
}

export function normalizeSnapshotCollection(value: unknown) {
  return Array.isArray(value) ? clone(value) : [];
}

export function splitEvidenceRefs(value: unknown) {
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(";")
    .map((entry: any) => entry.trim())
    .filter(Boolean);
}

export function normalizeEvidenceScope(evidenceRef: string) {
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

export function laneEvidenceDataRef(lane: any) {
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

export function validateEvidenceRefExists(repoRoot: string, evidenceRef: string, errorKey: any) {
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

export function validateEvidenceRefCollection(repoRoot: string, value: unknown, errorKey: any) {
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

export function validateRequiredEvidenceRefCollection(repoRoot: string, value: unknown, errorKey: any) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`public-support-snapshot-invalid:${errorKey}`);
  }
  validateEvidenceRefCollection(repoRoot, value, errorKey);
}

export function normalizeEvidenceRefCollectionForCompare(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry: any) => typeof entry === "string" && entry.trim() !== "")
    .map((entry: any) => entry.trim())
    .sort((left: any, right: any) => left.localeCompare(right));
}

export function normalizePackId(manifest: any) {
  return manifest?.pack_name ?? manifest?.pack?.id ?? null;
}

export function normalizeEvidenceRefDescriptor(value: unknown) {
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

export function buildLiveRuntimeLaneRecordIndex(repoRoot: string, publicSupport: any) {
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

export function workflowEvidenceScopeMatches(record: any, packId: string) {
  const packScope = Array.isArray(record?.pack_scope) ? record.pack_scope : [];
  const workflowScope = Array.isArray(record?.workflow_scope) ? record.workflow_scope : [];
  return !packId || packScope.includes(packId) || workflowScope.includes(packId);
}

export function countMatchingWorkflowVerificationRuns(record: any, packId: string) {
  return (record?.live_records ?? []).filter((liveRecord: any) =>
    liveRecord?.verdict === "pass" &&
    liveRecord?.freshness_state === "fresh" &&
    liveRecord?.entrypoint_path_used === "/skills" &&
    ["live_verification", "repeated_live_verification"].includes(liveRecord?.evidence_class) &&
    workflowEvidenceScopeMatches(liveRecord, packId)
  ).length;
}

export function readScopedReleaseGateStatus(repoRoot: string) {
  const verdictPath = resolve(repoRoot, SCOPED_RELEASE_VERDICT_PATH);
  if (!exists(verdictPath)) {
    return "UNKNOWN";
  }
  const match = readFileSync(verdictPath, "utf8").match(/Gate status:\s*([A-Z-]+)/i);
  return match?.[1]?.toUpperCase() ?? "UNKNOWN";
}

export function supportedWorkflowRuntimes(manifest: any) {
  const runtimes = Array.isArray(manifest?.supported_runtimes)
    ? manifest.supported_runtimes.filter((runtime: string) => isOneOf(runtime, SUPPORTED_RUNTIMES))
    : [];
  return runtimes.length > 0 ? runtimes : SUPPORTED_RUNTIMES.slice();
}

export function workflowSmokeCoverageRuntimes(manifest: any) {
  return new Set(
    Array.isArray(manifest?.smoke_checks)
      ? manifest.smoke_checks
        .map((check: any) => check?.runtime)
        .filter((runtime: string) => isOneOf(runtime, SUPPORTED_RUNTIMES))
      : [],
  );
}

export function validateStringArray(value: unknown, errorKey: any) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`public-support-snapshot-invalid:${errorKey}`);
  }
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new Error(`public-support-snapshot-invalid:${errorKey}`);
    }
  }
}

export function validateIsoTimestamp(value: unknown, errorKey: any) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`public-support-snapshot-invalid:${errorKey}`);
  }
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`public-support-snapshot-invalid:${errorKey}`);
  }
}

export function resolvePackDocPath(sourceRoot: any, relativePath: string) {
  return typeof relativePath === "string" && relativePath.trim() !== ""
    ? toPosixPath(join(sourceRoot, relativePath))
    : null;
}
