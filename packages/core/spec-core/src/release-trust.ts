import { sign as signBuffer, verify as verifyBuffer } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import YAML from "yaml";

import {
  DETACHED_SIGNATURE_SCHEMA_VERSION,
  isOneOf,
  PACK_METADATA_ENVELOPE_SCHEMA_VERSION,
  PACK_PUBLISHER_CLASSES,
  PACK_RUNTIME_SUPPORT_STATUSES,
  PACK_SIGNATURE_STATUSES,
  PACK_SUPPORT_LEVELS,
  PACK_TRUST_DESCRIPTOR_SCHEMA_VERSION,
  PACK_TRUST_TIERS,
  RELEASE_MANIFEST_SCHEMA_VERSION,
  RELEASE_TRUST_DIR,
  SUPPORTED_RUNTIMES,
  TRUST_POLICY_ACTIONS,
  TRUST_POLICY_SCHEMA_VERSION,
  TRUST_RECEIPT_SCHEMA_VERSION,
  TRUST_SOURCE_CLASSES,
  TRUST_VERIFICATION_STATUSES,
  VERSION_POLICY_SCHEMA_VERSION,
} from "./constants.ts";
import { validatePackTrustDescriptor } from "./validate.ts";
import { exists, readFileNormalized, relativeFrom, sha256, stableJson, walkFiles, writeTextFile } from "./utils.ts";

const LIVE_RUNTIME_EVIDENCE_ROOT = "docs/evidence/live-runtime";
const LIVE_RUNTIME_LANE_RECORD_KIND = "live-runtime-lane-record";
const LIVE_RUNTIME_LANE_RECORD_SCHEMA_VERSION = "1.0.0";
const SHARED_RUNTIME_SURFACE_MATRIX = "docs/compatibility/runtime-surface-matrix.yaml";
const COMMITTED_TRUST_POLICY_PATH = "trust/trust-policy.yaml";

const DEFAULT_TRUST_POLICY = Object.freeze({
  kind: "trust-policy",
  schema_version: TRUST_POLICY_SCHEMA_VERSION,
  defaults: {
    "first-party-release": "allow",
    "local-source": "allow",
    "external-trusted": "ask",
    "external-unverified": "deny",
  },
  publishers: [
    {
      id: "pairslash",
      source_class: "first-party-release",
      keyring_path: "trust/first-party-keys.json",
    },
  ],
});

const DEFAULT_VERSION_POLICY = Object.freeze({
  kind: "version-policy",
  schema_version: VERSION_POLICY_SCHEMA_VERSION,
  downgrade: "deny",
  allow_unparsed_versions: true,
  stable_lane: "same-major",
  zero_major_lane: "same-minor",
});

const PACK_TRUST_AUTHORITY_SCHEMA_VERSION = "1.0.0";
const HIGH_RISK_CAPABILITIES = Object.freeze(
  ["memory_write_global", "repo_write", "shell_exec", "test_exec", "mcp_client"].sort((left: any, right: any) =>
    left.localeCompare(right),
  ),
);

function clone(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueSorted(values: any): any[] {
  return [...new Set(values.filter(Boolean))].sort((left: any, right: any) => left.localeCompare(right));
}

function normalizeAction(value: unknown, fallback: any) {
  return isOneOf(value, TRUST_POLICY_ACTIONS) ? value : fallback;
}

function normalizeSourceClass(value: unknown, fallback: any) {
  return isOneOf(value, TRUST_SOURCE_CLASSES) ? value : fallback;
}

function normalizeTrustTier(value: unknown, fallback: any = "unverified-external") {
  return isOneOf(value, PACK_TRUST_TIERS) ? value : fallback;
}

function normalizeSupportLevel(value: unknown, fallback: any = "unsupported") {
  return isOneOf(value, PACK_SUPPORT_LEVELS) ? value : fallback;
}

function normalizePublisherClass(value: unknown, fallback: any = "external") {
  return isOneOf(value, PACK_PUBLISHER_CLASSES) ? value : fallback;
}

function normalizeRuntimeSupportStatus(value: unknown, fallback: any = "unverified") {
  return isOneOf(value, PACK_RUNTIME_SUPPORT_STATUSES) ? value : fallback;
}

function normalizeSignatureStatus(value: unknown, fallback: any = "missing") {
  return isOneOf(value, PACK_SIGNATURE_STATUSES) ? value : fallback;
}

const ACTION_PRECEDENCE: Record<string, number> = Object.freeze({
  allow: 0,
  ask: 1,
  deny: 2,
});

function mergeAction(current: any, candidate: any) {
  const normalizedCurrent = normalizeAction(current, "allow");
  const normalizedCandidate = normalizeAction(candidate, normalizedCurrent);
  return ACTION_PRECEDENCE[normalizedCandidate] > ACTION_PRECEDENCE[normalizedCurrent]
    ? normalizedCandidate
    : normalizedCurrent;
}

const SUPPORT_STATUS_RANK: Record<string, number> = Object.freeze({
  blocked: 0,
  unverified: 1,
  partial: 2,
  supported: 3,
});

function pickWeakerSupportStatus(left: any, right: any) {
  const normalizedLeft = normalizeRuntimeSupportStatus(left, "unverified");
  const normalizedRight = normalizeRuntimeSupportStatus(right, "unverified");
  return SUPPORT_STATUS_RANK[normalizedLeft] <= SUPPORT_STATUS_RANK[normalizedRight]
    ? normalizedLeft
    : normalizedRight;
}

function mergePolicy(base: any, override: any) {
  const merged = clone(base);
  if (override?.defaults && typeof override.defaults === "object") {
    for (const sourceClass of TRUST_SOURCE_CLASSES) {
      merged.defaults[sourceClass] = normalizeAction(
        override.defaults[sourceClass],
        merged.defaults[sourceClass],
      );
    }
  }
  if (Array.isArray(override?.publishers)) {
    const byId = new Map(merged.publishers.map((publisher: any) => [publisher.id, publisher]));
    for (const publisher of override.publishers) {
      if (!publisher?.id) {
        continue;
      }
      const current: any = byId.get(publisher.id) ?? { id: publisher.id };
      byId.set(publisher.id, {
        ...current,
        ...publisher,
        source_class: normalizeSourceClass(
          publisher.source_class,
          current.source_class ?? "external-trusted",
        ),
      });
    }
    merged.publishers = [...byId.values()].sort((left: any, right: any) => left.id.localeCompare(right.id));
  }
  return merged;
}

function normalizeVersionPolicy(policy: any) {
  const merged = {
    ...clone(DEFAULT_VERSION_POLICY),
    ...(policy ?? {}),
  };
  merged.downgrade = merged.downgrade === "allow" ? "allow" : "deny";
  merged.allow_unparsed_versions = merged.allow_unparsed_versions !== false;
  merged.stable_lane = merged.stable_lane === "same-minor" ? "same-minor" : "same-major";
  merged.zero_major_lane = merged.zero_major_lane === "same-major" ? "same-major" : "same-minor";
  return merged;
}

function loadStructuredFile(filePath: string) {
  const text = readFileSync(filePath, "utf8");
  if (filePath.endsWith(".json")) {
    return JSON.parse(text);
  }
  return YAML.parse(text);
}

function normalizePackTrustAuthority(authority: any) {
  const candidate = isObject(authority) ? authority : {};
  return {
    kind: candidate.kind ?? "pack-trust-authority",
    schema_version: candidate.schema_version ?? PACK_TRUST_AUTHORITY_SCHEMA_VERSION,
    core_maintained_packs: uniqueSorted(
      Array.isArray(candidate.core_maintained_packs) ? candidate.core_maintained_packs : [],
    ),
    high_risk_capabilities: Object.fromEntries(
    HIGH_RISK_CAPABILITIES.map((capability: any) => [
      capability,
      {
        allowed_packs: uniqueSorted(
          Array.isArray(candidate.high_risk_capabilities?.[capability]?.allowed_packs)
            ? candidate.high_risk_capabilities?.[capability]?.allowed_packs
            : [],
        ),
      },
    ]),
    ),
  };
}

function createEmptyPackTrustAuthority() {
  return {
    kind: "pack-trust-authority",
    schema_version: PACK_TRUST_AUTHORITY_SCHEMA_VERSION,
    core_maintained_packs: [],
    high_risk_capabilities: Object.fromEntries(
      HIGH_RISK_CAPABILITIES.map((capability: any) => [capability, { allowed_packs: [] }]),
    ),
  };
}

function isObject(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stripRefFragment(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }
  const [pathPart] = value.split("#", 1);
  return pathPart;
}

function isLikelyRemoteRef(value: unknown) {
  return typeof value === "string" && /^[a-z]+:\/\//i.test(value);
}

function toPosixPath(value: string) {
  return value.replace(/\\/g, "/");
}

function isSharedRuntimeMatrixRef(value: unknown) {
  if (typeof value !== "string" || value.trim() === "" || isLikelyRemoteRef(value)) {
    return false;
  }
  const [pathPart] = value.split("#", 2);
  return toPosixPath(pathPart) === SHARED_RUNTIME_SURFACE_MATRIX;
}

function buildManifestSupportDescriptor(manifest: any) {
  if (!manifest?.support) {
    return null;
  }
  return {
    kind: "pack-trust-descriptor",
    schema_version: PACK_TRUST_DESCRIPTOR_SCHEMA_VERSION,
    pack_name: manifest.pack?.id ?? manifest.pack_name ?? null,
    pack_version: manifest.pack_version ?? null,
    publisher: clone(manifest.support.publisher ?? {}),
    tier_claim: manifest.support.tier_claim ?? null,
    support_level_claim: manifest.support.support_level_claim ?? null,
    signature: clone(manifest.support.signature ?? {}),
    runtime_support: Object.fromEntries(
      SUPPORTED_RUNTIMES.map((runtime: string) => [
        runtime,
        clone(manifest.support.runtime_support?.[runtime] ?? {}),
      ]),
    ),
    policy_requirements: clone(manifest.support.policy_requirements ?? {}),
  };
}

function compareDescriptorToManifestSupport(descriptor: any, manifestDescriptor: any) {
  if (!descriptor || !manifestDescriptor) {
    return [];
  }
  const mismatches: any[] = [];
  for (const field of [
    "pack_name",
    "pack_version",
    "tier_claim",
    "support_level_claim",
  ]) {
    if ((descriptor?.[field] ?? null) !== (manifestDescriptor?.[field] ?? null)) {
      mismatches.push(`trust-descriptor:drift:${field}`);
    }
  }
  for (const field of ["publisher_id", "display_name", "publisher_class", "contact"]) {
    if ((descriptor?.publisher?.[field] ?? null) !== (manifestDescriptor?.publisher?.[field] ?? null)) {
      mismatches.push(`trust-descriptor:drift:publisher.${field}`);
    }
  }
  for (const field of ["required", "allow_local_unsigned"]) {
    if ((descriptor?.signature?.[field] ?? null) !== (manifestDescriptor?.signature?.[field] ?? null)) {
      mismatches.push(`trust-descriptor:drift:signature.${field}`);
    }
  }
  for (const runtime of SUPPORTED_RUNTIMES) {
    for (const field of ["status", "evidence_ref"]) {
      if (
        (descriptor?.runtime_support?.[runtime]?.[field] ?? null) !==
        (manifestDescriptor?.runtime_support?.[runtime]?.[field] ?? null)
      ) {
        mismatches.push(`trust-descriptor:drift:${runtime}.${field}`);
      }
    }
  }
  return mismatches;
}

export function resolvePackTrustDescriptorPath(manifestPath: string, manifest: any) {
  const manifestDir = dirname(resolve(manifestPath));
  if (typeof manifest?.trust_descriptor === "string" && manifest.trust_descriptor.trim() !== "") {
    return resolve(manifestDir, manifest.trust_descriptor);
  }
  const fallback = resolve(manifestDir, "pack.trust.yaml");
  return exists(fallback) ? fallback : null;
}

export function loadPackTrustDescriptorRecord({ manifestPath, manifest }: { manifestPath: string; manifest?: any }) {
  const manifestDescriptor = buildManifestSupportDescriptor(manifest);
  const descriptorPath = resolvePackTrustDescriptorPath(manifestPath, manifest);
  if (manifestDescriptor) {
    if (!descriptorPath) {
      return {
        descriptorSource: "manifest",
        descriptorPath: null,
        evidenceBasePath: manifestPath,
        descriptorDigest: null,
        descriptor: manifestDescriptor,
        errors: [],
        shimErrors: [],
      };
    }
    if (!exists(descriptorPath)) {
      return {
        descriptorSource: "manifest",
        descriptorPath,
        evidenceBasePath: manifestPath,
        descriptorDigest: null,
        descriptor: manifestDescriptor,
        errors: [],
        shimErrors: [`trust-descriptor:not-found:${relativeFromRoot(dirname(descriptorPath), descriptorPath)}`],
      };
    }
    try {
      const shimDescriptor = loadStructuredFile(descriptorPath);
      const shimErrors = [
        ...validatePackTrustDescriptor(shimDescriptor, { manifest }),
        ...compareDescriptorToManifestSupport(shimDescriptor, manifestDescriptor),
      ];
      return {
        descriptorSource: "manifest",
        descriptorPath,
        evidenceBasePath: manifestPath,
        descriptorDigest: sha256(readFileNormalized(descriptorPath)),
        descriptor: manifestDescriptor,
        errors: [],
        shimErrors,
      };
    } catch (error) {
      return {
        descriptorSource: "manifest",
        descriptorPath,
        evidenceBasePath: manifestPath,
        descriptorDigest: null,
        descriptor: manifestDescriptor,
        errors: [],
        shimErrors: [`trust-descriptor:invalid:${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }
  if (!descriptorPath) {
    return {
      descriptorSource: "descriptor",
      descriptorPath: null,
      evidenceBasePath: null,
      descriptorDigest: null,
      descriptor: null,
      errors: ["trust-descriptor:missing"],
      shimErrors: [],
    };
  }
  if (!exists(descriptorPath)) {
    return {
      descriptorSource: "descriptor",
      descriptorPath,
      evidenceBasePath: descriptorPath,
      descriptorDigest: null,
      descriptor: null,
      errors: [`trust-descriptor:not-found:${relativeFromRoot(dirname(descriptorPath), descriptorPath)}`],
      shimErrors: [],
    };
  }
  try {
    const descriptor = loadStructuredFile(descriptorPath);
    const errors = validatePackTrustDescriptor(descriptor, { manifest });
    return {
      descriptorSource: "descriptor",
      descriptorPath,
      evidenceBasePath: descriptorPath,
      descriptorDigest: sha256(readFileNormalized(descriptorPath)),
      descriptor,
      errors,
      shimErrors: [],
    };
  } catch (error) {
    return {
      descriptorSource: "descriptor",
      descriptorPath,
      evidenceBasePath: descriptorPath,
      descriptorDigest: null,
      descriptor: null,
      errors: [`trust-descriptor:invalid:${error instanceof Error ? error.message : String(error)}`],
      shimErrors: [],
    };
  }
}

function isWithin(rootPath: any, maybeChildPath: any) {
  const resolvedRoot = resolve(rootPath);
  const resolvedChild = resolve(maybeChildPath);
  return (
    resolvedChild === resolvedRoot ||
    resolvedChild.startsWith(`${resolvedRoot}\\`) ||
    resolvedChild.startsWith(`${resolvedRoot}/`)
  );
}

function findTrustArtifactsRoot(startPath: any) {
  let current = resolve(startPath);
  while (true) {
    const candidate = join(current, RELEASE_TRUST_DIR, "release-manifest.json");
    if (exists(candidate)) {
      return {
        bundle_root: current,
        trust_dir: join(current, RELEASE_TRUST_DIR),
      };
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function relativeFromRoot(rootPath: any, filePath: string) {
  return relativeFrom(resolve(rootPath), resolve(filePath));
}

function parseSemver(version: string) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/.exec(version ?? "");
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareSemver(left: any, right: any) {
  for (const field of ["major", "minor", "patch"]) {
    if (left[field] < right[field]) {
      return -1;
    }
    if (left[field] > right[field]) {
      return 1;
    }
  }
  return 0;
}

export function deriveManifestRuntimeSupportStatus(manifest: any, runtime: string) {
  const compatibility = manifest?.runtime_bindings?.[runtime]?.compatibility ?? {};
  const canonicalStatus = compatibility.canonical_picker ?? "unverified";
  const directStatus = compatibility.direct_invocation ?? "unverified";
  if (canonicalStatus === "blocked") {
    return "blocked";
  }
  if (canonicalStatus === "supported" && directStatus === "supported") {
    return "supported";
  }
  if (canonicalStatus === "unverified" && directStatus === "unverified") {
    return "unverified";
  }
  return "partial";
}

export function resolveRuntimeEvidencePresence({ repoRoot, descriptorPath, evidenceRef }: { repoRoot?: string; descriptorPath?: any; evidenceRef?: string }) {
  if (typeof evidenceRef !== "string" || evidenceRef.trim() === "") {
    return false;
  }
  if (isLikelyRemoteRef(evidenceRef)) {
    return false;
  }
  const relativeRef = stripRefFragment(evidenceRef) as string;
  const resolvedRepoRoot = repoRoot ? resolve(repoRoot) : null;
  const candidatePaths = [
    descriptorPath ? resolve(dirname(descriptorPath), relativeRef) : null,
    resolvedRepoRoot ? resolve(resolvedRepoRoot, relativeRef) : null,
  ].filter(Boolean);
  return candidatePaths.some((candidatePath: any) => {
    if (!exists(candidatePath)) {
      return false;
    }
    if (resolvedRepoRoot && !isWithin(resolvedRepoRoot, candidatePath)) {
      return false;
    }
    return true;
  });
}

export function evaluateRuntimeSupportClaim({ repoRoot, manifest, runtime, descriptorRecord }: { repoRoot?: string; manifest?: any; runtime: string; descriptorRecord?: any }) {
  const manifestStatus = deriveManifestRuntimeSupportStatus(manifest, runtime);
  const manifestRuntimeSupport = manifest?.support?.runtime_support?.[runtime] ?? {};
  const declaredStatus = normalizeRuntimeSupportStatus(
    manifestRuntimeSupport?.status,
    manifestStatus,
  );
  const evidenceRef = manifestRuntimeSupport?.evidence_ref ?? null;
  const evidenceKind = manifestRuntimeSupport?.evidence_kind ?? "lane-matrix";
  const requiredForPromotion =
    manifestRuntimeSupport?.required_for_promotion ?? true;
  const evidenceBasePath = descriptorRecord?.evidenceBasePath ?? descriptorRecord?.descriptorPath ?? null;
  let evidencePresent = evidenceBasePath
    ? resolveRuntimeEvidencePresence({
        repoRoot,
        descriptorPath: evidenceBasePath,
        evidenceRef,
      })
    : false;
  if (evidencePresent && evidenceKind === "lane-matrix" && !isSharedRuntimeMatrixRef(evidenceRef)) {
    evidencePresent = false;
  }
  if (
    evidencePresent &&
    evidenceKind === "pack-runtime-live" &&
    repoRoot
  ) {
    const liveRuntimeRef = stripRefFragment(evidenceRef) as string;
    const candidatePaths = [
      evidenceBasePath ? resolve(dirname(evidenceBasePath), liveRuntimeRef) : null,
      resolve(repoRoot, liveRuntimeRef),
    ].filter(Boolean);
    const resolvedLaneRecordPath = candidatePaths.find((candidatePath: any) =>
      exists(candidatePath) && isWithin(resolve(repoRoot), candidatePath));
    if (!resolvedLaneRecordPath) {
      evidencePresent = false;
    } else {
      const relativeLaneRecordPath = toPosixPath(relativeFrom(resolve(repoRoot), resolvedLaneRecordPath));
      try {
        const liveRuntimeRecord = loadStructuredFile(resolvedLaneRecordPath);
        const packId = manifest?.pack_name ?? manifest?.pack?.id ?? null;
        const packScope = Array.isArray(liveRuntimeRecord?.pack_scope) ? liveRuntimeRecord.pack_scope : [];
        const workflowScope = Array.isArray(liveRuntimeRecord?.workflow_scope) ? liveRuntimeRecord.workflow_scope : [];
        evidencePresent = Boolean(
          relativeLaneRecordPath.startsWith(`${LIVE_RUNTIME_EVIDENCE_ROOT}/`) &&
          relativeLaneRecordPath.endsWith(".yaml") &&
          liveRuntimeRecord?.kind === LIVE_RUNTIME_LANE_RECORD_KIND &&
          liveRuntimeRecord?.schema_version === LIVE_RUNTIME_LANE_RECORD_SCHEMA_VERSION &&
          liveRuntimeRecord?.runtime_id === runtime &&
          liveRuntimeRecord?.canonical_entrypoint === "/skills" &&
          (!packId || packScope.includes(packId) || workflowScope.includes(packId))
        );
      } catch {
        evidencePresent = false;
      }
    }
  }
  const reasons: string[] = [];
  let policyAction = "allow";
  if (manifestStatus === "blocked" && declaredStatus !== "blocked") {
    reasons.push(`runtime-claim-blocked:${runtime}`);
    policyAction = "deny";
  } else if (manifestStatus === "unverified" && declaredStatus === "supported") {
    reasons.push(`runtime-claim-exceeds-evidence:${runtime}`);
    policyAction = mergeAction(policyAction, "ask");
  }
  if (
    ["supported", "partial"].includes(declaredStatus) &&
    !evidencePresent
  ) {
    reasons.push(`runtime-evidence-missing:${runtime}`);
    policyAction = mergeAction(policyAction, "ask");
  }
  const resolvedStatus = !evidencePresent && ["supported", "partial"].includes(declaredStatus)
    ? pickWeakerSupportStatus(manifestStatus, "unverified")
    : pickWeakerSupportStatus(manifestStatus, declaredStatus);
  return {
    runtime,
    manifest_status: manifestStatus,
    declared_status: declaredStatus,
    resolved_status: resolvedStatus,
    evidence_ref: evidenceRef,
    evidence_kind: evidenceKind,
    required_for_promotion: requiredForPromotion,
    evidence_present: evidencePresent,
    policy_action: policyAction,
    reasons,
  };
}

function resolveTrustTier({
  packId,
  sourceClass,
  descriptor,
  releaseVerification,
  authorityDecision,
}: { packId?: string; sourceClass?: any; descriptor?: any; releaseVerification?: any; authorityDecision?: any }) {
  const tierClaim = normalizeTrustTier(
    authorityDecision?.authorized_tier ?? descriptor?.tier_claim,
    sourceClass === "first-party-release"
      ? "first-party-official"
      : sourceClass === "external-trusted"
        ? "verified-external"
        : "unverified-external",
  );
  if (sourceClass === "local-source") {
    return "local-dev";
  }
  if (sourceClass === "external-unverified") {
    return "unverified-external";
  }
  if (releaseVerification.verified) {
    return tierClaim;
  }
  if (
    sourceClass === "first-party-release" &&
    authorityDecision?.authorized_tier === "core-maintained" &&
    packId
  ) {
    return "first-party-official";
  }
  return sourceClass === "external-trusted" ? "verified-external" : "unverified-external";
}

function resolveSupportLevel({
  trustTier,
  supportLevelClaim,
  runtimeSupportStatus,
}: { trustTier?: any; supportLevelClaim?: any; runtimeSupportStatus?: any }) {
  if (trustTier === "unverified-external" || runtimeSupportStatus === "blocked") {
    return "unsupported";
  }
  if (trustTier === "local-dev") {
    return "local-dev";
  }
  if (runtimeSupportStatus === "supported") {
    return normalizeSupportLevel(supportLevelClaim, "official-preview");
  }
  if (trustTier === "verified-external") {
    return "publisher-verified";
  }
  return "official-preview";
}

function resolveSignatureStatus({ sourceClass, releaseVerification }: { sourceClass?: any; releaseVerification?: any }) {
  if (sourceClass === "local-source") {
    return "local-dev";
  }
  if (releaseVerification.verified) {
    return "verified";
  }
  if (
    releaseVerification.reasons?.some((reason: any) =>
      reason.includes("signature:invalid") ||
      reason.includes("pack-signature-invalid") ||
      reason.includes("release-manifest-signature:invalid"),
    )
  ) {
    return "invalid";
  }
  return "missing";
}

function resolveBasePolicyAction({ trustTier, sourceClass, trustPolicy }: { trustTier?: any; sourceClass?: any; trustPolicy?: any }) {
  if (trustTier === "core-maintained") {
    return "allow";
  }
  if (["first-party-official", "verified-external", "local-dev"].includes(trustTier)) {
    return "ask";
  }
  return normalizeAction(
    trustPolicy.defaults[sourceClass],
    trustTier === "unverified-external" ? "deny" : "ask",
  );
}

function buildMemoryAuthoritySummary(manifest: any) {
  return {
    authority_mode: manifest.memory_permissions?.authority_mode ?? "read-only",
    global_project_memory: manifest.memory_permissions?.global_project_memory ?? "none",
    explicit_write_only: manifest.memory_permissions?.explicit_write_only === true,
  };
}

function hasCapabilityExpansion(currentCapabilities: any[] = [], candidateCapabilities: any[] = []) {
  const current = new Set(currentCapabilities);
  return candidateCapabilities.filter((capability: any) => !current.has(capability));
}

function buildTrustDeltaSnapshot(receipt: any) {
  if (!receipt) {
    return null;
  }
  return {
    source_class: receipt.source_class,
    verification_status: receipt.verification_status,
    trust_tier: receipt.trust_tier ?? null,
    policy_action: receipt.policy_action,
    version: receipt.version,
    release_id: receipt.release_id,
    signature_status: receipt.signature_status ?? null,
    support_level: receipt.support_level ?? null,
    runtime_support_status: receipt.runtime_support?.resolved_status ?? null,
    capabilities: receipt.capabilities ?? [],
    memory_authority: receipt.memory_authority ?? null,
  };
}

function summarizeTrustReceipt(receipt: any) {
  const versionSummary = receipt.version_policy?.summary ? `; ${receipt.version_policy.summary}` : "";
  return `${receipt.trust_tier ?? receipt.source_class} (${receipt.signature_status ?? receipt.verification_status}; ${receipt.support_level ?? "unsupported"})${versionSummary}`;
}

export function loadTrustPolicy(repoRoot: string) {
  let policy = clone(DEFAULT_TRUST_POLICY);
  for (const relativePath of ["trust/trust-policy.yaml", ".pairslash/trust/trust-policy.yaml"]) {
    const filePath = resolve(repoRoot, relativePath);
    if (!exists(filePath)) {
      continue;
    }
    policy = mergePolicy(policy, loadStructuredFile(filePath));
  }
  return policy;
}

export function loadVersionPolicy(repoRoot: string) {
  let policy = clone(DEFAULT_VERSION_POLICY);
  for (const relativePath of ["trust/version-policy.yaml", ".pairslash/trust/version-policy.yaml"]) {
    const filePath = resolve(repoRoot, relativePath);
    if (!exists(filePath)) {
      continue;
    }
    policy = normalizeVersionPolicy(loadStructuredFile(filePath));
  }
  return normalizeVersionPolicy(policy);
}

export function loadPackTrustAuthority(repoRoot: string) {
  for (const relativePath of ["trust/pack-authority.yaml", ".pairslash/trust/pack-authority.yaml"]) {
    const filePath = resolve(repoRoot, relativePath);
    if (!exists(filePath)) {
      continue;
    }
    return normalizePackTrustAuthority(loadStructuredFile(filePath));
  }
  throw new Error("pack trust authority file not found (expected trust/pack-authority.yaml)");
}

export function evaluatePackTrustAuthority({
  repoRoot,
  packId,
  manifest,
  descriptor = null,
}: any = {}) {
  let authority: any = createEmptyPackTrustAuthority();
  const errors: string[] = [];
  try {
    authority = loadPackTrustAuthority(repoRoot);
  } catch (error) {
    errors.push(`trust-authority:load-failed:${error instanceof Error ? error.message : String(error)}`);
  }
  const memoryAuthority = buildMemoryAuthoritySummary(manifest);
  const capabilities = uniqueSorted(manifest?.capabilities ?? []);
  const publisherId =
    descriptor?.publisher?.publisher_id ??
    manifest?.support?.publisher?.publisher_id ??
    null;
  const requestedTier = normalizeTrustTier(
    descriptor?.tier_claim ?? manifest?.support?.tier_claim,
    publisherId === "pairslash" ? "first-party-official" : "verified-external",
  );
  let authorizedTier = requestedTier;

  if (publisherId === "pairslash") {
    if (requestedTier === "core-maintained" && !authority.core_maintained_packs.includes(packId)) {
      errors.push(`trust-authority:core-maintained-not-authorized:${packId}`);
      authorizedTier = "first-party-official";
    }
    if (requestedTier !== "core-maintained" && authority.core_maintained_packs.includes(packId)) {
      errors.push(`trust-authority:core-maintained-claim-missing:${packId}`);
    }
  } else if (requestedTier === "core-maintained") {
    errors.push(`trust-authority:non-pairslash-core-tier:${packId}`);
    authorizedTier = "verified-external";
  }

  if (
    memoryAuthority.global_project_memory === "write" &&
    !authority.high_risk_capabilities.memory_write_global.allowed_packs.includes(packId)
  ) {
    errors.push(`trust-authority:memory-write-not-authorized:${packId}`);
  }

  for (const capability of capabilities.filter((entry: any) => HIGH_RISK_CAPABILITIES.includes(entry))) {
    const allowedPacks = authority.high_risk_capabilities[capability]?.allowed_packs ?? [];
    if (!allowedPacks.includes(packId)) {
      errors.push(`trust-authority:capability-not-authorized:${packId}:${capability}`);
    }
  }

  return {
    authority,
    requested_tier: requestedTier,
    authorized_tier: authorizedTier,
    errors: uniqueSorted(errors),
  };
}

export function loadTrustKeyring(repoRoot: string, keyringPath: any) {
  const resolvedPath = resolve(repoRoot, keyringPath);
  if (!exists(resolvedPath)) {
    return {
      kind: "trust-keyring",
      schema_version: TRUST_POLICY_SCHEMA_VERSION,
      publisher: null,
      keys: [],
    };
  }
  const parsed = loadStructuredFile(resolvedPath);
  return {
    kind: parsed?.kind ?? "trust-keyring",
    schema_version: parsed?.schema_version ?? TRUST_POLICY_SCHEMA_VERSION,
    publisher: parsed?.publisher ?? null,
    keys: Array.isArray(parsed?.keys)
      ? parsed.keys
          .filter((key: any) => key?.key_id && key?.public_key_pem)
          .map((key: any) => ({
            key_id: key.key_id,
            public_key_pem: key.public_key_pem,
            status: key.status ?? "active",
            algorithm: key.algorithm ?? "ed25519",
            created_at: key.created_at ?? null,
          }))
      : [],
  };
}

export function validateReleaseTrustBootstrap({ repoRoot, publisherId = "pairslash" }: { repoRoot: string; publisherId?: any }) {
  const failures: any[] = [];
  if (!exists(resolve(repoRoot, COMMITTED_TRUST_POLICY_PATH))) {
    failures.push(`trust-policy:missing:${COMMITTED_TRUST_POLICY_PATH}`);
  }

  let trustPolicy = null;
  try {
    trustPolicy = loadTrustPolicy(repoRoot);
  } catch (error) {
    return {
      kind: "release-trust-bootstrap-validation",
      publisher: publisherId,
      keyring_path: null,
      active_key_count: 0,
      authority_loaded: false,
      ok: false,
      failures: [`trust-policy:invalid:${error instanceof Error ? error.message : String(error)}`],
    };
  }

  const publisherEntry = resolvePublisherEntry(trustPolicy, publisherId);
  if (!publisherEntry) {
    failures.push(`trust-policy:publisher-missing:${publisherId}`);
  }
  const publisherSourceClass = normalizeSourceClass(
    publisherEntry?.source_class,
    "external-trusted",
  );
  if (publisherEntry && publisherSourceClass !== "first-party-release") {
    failures.push(
      `trust-policy:publisher-source-class-not-first-party-release:${publisherId}:${publisherSourceClass}`,
    );
  }

  const keyringPath = publisherEntry?.keyring_path ?? null;
  if (!keyringPath) {
    failures.push(`trust-policy:keyring-path-missing:${publisherId}`);
  }

  let keyring: any = { keys: [] };
  if (keyringPath) {
    try {
      keyring = loadTrustKeyring(repoRoot, keyringPath);
      if (!keyring.publisher) {
        failures.push(`trust-keyring:publisher-missing:${keyringPath}`);
      } else if (keyring.publisher !== publisherId) {
        failures.push(`trust-keyring:publisher-mismatch:${keyringPath}:${keyring.publisher}`);
      }
    } catch (error) {
      failures.push(`trust-keyring:invalid:${keyringPath}:${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const activeKeys = (keyring.keys ?? []).filter((key: any) => key.status !== "revoked");
  if (activeKeys.length === 0) {
    failures.push(`trust-keyring:no-active-keys:${publisherId}`);
  }

  let authorityLoaded = false;
  try {
    const authority = loadPackTrustAuthority(repoRoot);
    authorityLoaded = true;
    if (!Array.isArray(authority.core_maintained_packs) || authority.core_maintained_packs.length === 0) {
      failures.push("pack-authority:core-maintained-empty");
    }
    for (const capability of HIGH_RISK_CAPABILITIES) {
      if (!Array.isArray(authority.high_risk_capabilities?.[capability]?.allowed_packs)) {
        failures.push(`pack-authority:invalid-capability-list:${capability}`);
      }
    }
  } catch (error) {
    failures.push(`pack-authority:invalid:${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    kind: "release-trust-bootstrap-validation",
    publisher: publisherId,
    keyring_path: keyringPath,
    active_key_count: activeKeys.length,
    authority_loaded: authorityLoaded,
    ok: failures.length === 0,
    failures: uniqueSorted(failures),
  };
}

export function evaluateVersionPolicy({ currentVersion = null, candidateVersion, policy }: { currentVersion?: any; candidateVersion?: any; policy?: any }) {
  const effectivePolicy = normalizeVersionPolicy(policy);
  if (!currentVersion) {
    return {
      status: "install",
      blocking: false,
      summary: "initial install",
      rule_id: "initial-install",
    };
  }
  const current = parseSemver(currentVersion);
  const candidate = parseSemver(candidateVersion);
  if (!current || !candidate) {
    return {
      status: effectivePolicy.allow_unparsed_versions ? "warn" : "blocked",
      blocking: !effectivePolicy.allow_unparsed_versions,
      summary: "version policy could not parse one or both versions",
      rule_id: "unparsed-version",
    };
  }
  const comparison = compareSemver(candidate, current);
  if (comparison < 0 && effectivePolicy.downgrade !== "allow") {
    return {
      status: "blocked",
      blocking: true,
      summary: `downgrade blocked from ${currentVersion} to ${candidateVersion}`,
      rule_id: "downgrade-denied",
    };
  }
  const requiredLane = current.major === 0 || candidate.major === 0
    ? effectivePolicy.zero_major_lane
    : effectivePolicy.stable_lane;
  if (requiredLane === "same-minor" && (current.major !== candidate.major || current.minor !== candidate.minor)) {
    return {
      status: "blocked",
      blocking: true,
      summary: `zero-major upgrades must stay on the same minor line (${currentVersion} -> ${candidateVersion})`,
      rule_id: "same-minor",
    };
  }
  if (requiredLane === "same-major" && current.major !== candidate.major) {
    return {
      status: "blocked",
      blocking: true,
      summary: `upgrades must stay within the same major version (${currentVersion} -> ${candidateVersion})`,
      rule_id: "same-major",
    };
  }
  return {
    status: "allowed",
    blocking: false,
    summary: `version transition allowed (${currentVersion} -> ${candidateVersion})`,
    rule_id: requiredLane,
  };
}

export function buildPackMetadataEnvelope({
  repoRoot,
  manifestPath,
  manifest,
  compiledPacks,
  publisher = "pairslash",
}: { repoRoot: string; manifestPath: string; manifest?: any; compiledPacks?: any; publisher?: string }) {
  const packVersion = compiledPacks[0]?.version ?? manifest.pack_version ?? null;
  const packSourceRoot = resolve(repoRoot, manifest.runtime_assets?.source_root ?? manifest.assets?.pack_dir);
  const sourceFiles = walkFiles(packSourceRoot).map((absolutePath: any) => ({
    relative_path: relativeFromRoot(packSourceRoot, absolutePath),
    sha256: sha256(readFileNormalized(absolutePath)),
    size_bytes: Buffer.byteLength(readFileNormalized(absolutePath)),
  }));
  const runtimeArtifacts = compiledPacks
    .slice()
    .sort((left: any, right: any) => left.runtime.localeCompare(right.runtime))
    .map((compiledPack: any) => ({
      runtime: compiledPack.runtime,
      bundle_kind: compiledPack.bundle_kind,
      compiled_digest: compiledPack.digest,
      normalized_ir_digest: compiledPack.normalized_ir_digest,
      files: compiledPack.files.map((file: any) => ({
        relative_path: file.relative_path,
        sha256: file.sha256,
        size_bytes: file.size,
        asset_kind: file.asset_kind,
        install_surface: file.install_surface,
      })),
    }));
  return {
    kind: "pack-metadata-envelope",
    schema_version: PACK_METADATA_ENVELOPE_SCHEMA_VERSION,
    publisher,
    pack_id: manifest.pack.id,
    version: packVersion,
    canonical_entrypoint: manifest.pack.canonical_entrypoint,
    manifest_path: relativeFromRoot(repoRoot, manifestPath),
    manifest_digest: compiledPacks[0]?.manifest_digest ?? sha256(readFileNormalized(manifestPath)),
    source_root: relativeFromRoot(repoRoot, packSourceRoot),
    source_files: sourceFiles,
    runtime_artifacts: runtimeArtifacts,
  };
}

export function createDetachedSignature({ payload, keyId, privateKeyPem }: { payload?: any; keyId?: string; privateKeyPem?: any }) {
  const payloadText = stableJson(payload);
  const signature = signBuffer(null, Buffer.from(payloadText, "utf8"), privateKeyPem);
  return {
    kind: "detached-signature",
    schema_version: DETACHED_SIGNATURE_SCHEMA_VERSION,
    algorithm: "ed25519",
    key_id: keyId,
    payload_sha256: sha256(payloadText),
    signature_base64: signature.toString("base64"),
  };
}

export function verifyDetachedSignature({ payload, signatureEnvelope, publicKeyPem }: { payload?: any; signatureEnvelope?: any; publicKeyPem?: any }) {
  if (
    signatureEnvelope?.kind !== "detached-signature" ||
    signatureEnvelope?.schema_version !== DETACHED_SIGNATURE_SCHEMA_VERSION ||
    signatureEnvelope?.algorithm !== "ed25519"
  ) {
    return false;
  }
  const payloadText = stableJson(payload);
  if (signatureEnvelope.payload_sha256 !== sha256(payloadText)) {
    return false;
  }
  return verifyBuffer(
    null,
    Buffer.from(payloadText, "utf8"),
    publicKeyPem,
    Buffer.from(signatureEnvelope.signature_base64, "base64"),
  );
}

function buildReleaseManifest({
  releaseId,
  publisher,
  sourceCommit,
  packEntries,
}: { releaseId?: string; publisher?: string; sourceCommit?: any; packEntries?: any }) {
  return {
    kind: "release-manifest",
    schema_version: RELEASE_MANIFEST_SCHEMA_VERSION,
    product: "pairslash",
    publisher,
    release_id: releaseId,
    source_commit: sourceCommit ?? null,
    pack_count: packEntries.length,
    packs: packEntries,
  };
}

function buildChecksums(trustDir: any) {
  const entries = walkFiles(trustDir)
    .filter((filePath: string) => !filePath.endsWith("checksums.json"))
    .map((filePath: string) => ({
      path: relativeFromRoot(trustDir, filePath),
      sha256: sha256(readFileNormalized(filePath)),
    }))
    .sort((left: any, right: any) => left.path.localeCompare(right.path));
  return {
    kind: "checksum-set",
    schema_version: "1.0.0",
    algorithm: "sha256",
    entries,
  };
}

function isSafeChecksumPath(pathValue: any) {
  if (typeof pathValue !== "string" || pathValue.length === 0) {
    return false;
  }
  if (pathValue.trim() !== pathValue) {
    return false;
  }
  if (
    pathValue.startsWith("/") ||
    pathValue.startsWith("./") ||
    pathValue.startsWith("../") ||
    pathValue.includes("/../") ||
    pathValue.includes("/./") ||
    pathValue.includes("\\")
  ) {
    return false;
  }
  return true;
}

function collectSignatureArtifacts(trustDir: any) {
  return walkFiles(trustDir)
    .filter((filePath: string) => filePath.endsWith(".sig.json"))
    .map((filePath: string) => relativeFromRoot(trustDir, filePath))
    .sort((left: any, right: any) => left.localeCompare(right));
}

function clearReleaseTrustOutputDir(outDir: any) {
  rmSync(join(outDir, "packs"), { recursive: true, force: true });
  rmSync(join(outDir, "release-manifest.json"), { force: true });
  rmSync(join(outDir, "release-manifest.sig.json"), { force: true });
  rmSync(join(outDir, "checksums.json"), { force: true });
}

function validateTrustBundleChecksums(trustDir: any) {
  const checksumsPath = join(trustDir, "checksums.json");
  if (!exists(checksumsPath)) {
    return ["missing checksum set"];
  }
  const parsed = JSON.parse(readFileSync(checksumsPath, "utf8"));
  if (
    parsed?.kind !== "checksum-set" ||
    parsed?.schema_version !== "1.0.0" ||
    parsed?.algorithm !== "sha256" ||
    !Array.isArray(parsed?.entries)
  ) {
    return ["invalid checksum set"];
  }
  const entryFailures: any[] = [];
  const seenPaths = new Set();
  const actualEntries: any[] = [];
  for (const entry of parsed.entries) {
    if (typeof entry?.path !== "string" || typeof entry?.sha256 !== "string") {
      entryFailures.push("invalid checksum entry");
      continue;
    }
    if (!isSafeChecksumPath(entry.path)) {
      entryFailures.push(`invalid checksum entry path ${entry.path}`);
      continue;
    }
    if (seenPaths.has(entry.path)) {
      entryFailures.push(`duplicate checksum entry for ${entry.path}`);
      continue;
    }
    seenPaths.add(entry.path);
    actualEntries.push({
      path: entry.path,
      sha256: entry.sha256,
    });
  }
  if (entryFailures.length > 0) {
    return uniqueSorted(entryFailures);
  }

  const expectedEntries = buildChecksums(trustDir).entries;
  actualEntries.sort((left: any, right: any) => left.path.localeCompare(right.path));
  const expectedByPath = new Map(expectedEntries.map((entry: any) => [entry.path, entry.sha256]));
  const actualByPath = new Map(actualEntries.map((entry: any) => [entry.path, entry.sha256]));
  const failures: any[] = [];

  for (const entry of expectedEntries) {
    if (!actualByPath.has(entry.path)) {
      failures.push(`checksum entry missing for ${entry.path}`);
      continue;
    }
    if (actualByPath.get(entry.path) !== entry.sha256) {
      failures.push(`checksum digest mismatch for ${entry.path}`);
    }
  }
  for (const entry of actualEntries) {
    if (!expectedByPath.has(entry.path)) {
      failures.push(`unexpected checksum entry ${entry.path}`);
    }
  }
  return failures;
}

export function writeReleaseTrustBundle({
  repoRoot,
  releaseId,
  packArtifacts,
  publisher = "pairslash",
  privateKeyPem = null,
  keyId = null,
  outDir = resolve(repoRoot, RELEASE_TRUST_DIR),
  sourceCommit = null,
}: { repoRoot: string; releaseId?: string; packArtifacts?: any; publisher?: string; privateKeyPem?: any; keyId?: string | null; outDir?: any; sourceCommit?: any }) {
  clearReleaseTrustOutputDir(outDir);
  const packEntries: any[] = [];
  for (const artifact of packArtifacts.slice().sort((left: any, right: any) => left.pack_id.localeCompare(right.pack_id))) {
    const packDir = join(outDir, "packs", artifact.pack_id);
    const metadataPath = join(packDir, "pack-metadata.json");
    writeTextFile(metadataPath, stableJson(artifact.metadata));
    let signaturePath = null;
    if (privateKeyPem && keyId) {
      const signature = createDetachedSignature({
        payload: artifact.metadata,
        keyId,
        privateKeyPem,
      });
      signaturePath = join(packDir, "pack-metadata.sig.json");
      writeTextFile(signaturePath, stableJson(signature));
    }
    packEntries.push({
      pack_id: artifact.pack_id,
      version: artifact.metadata.version,
      manifest_digest: artifact.metadata.manifest_digest,
      metadata_path: relativeFromRoot(outDir, metadataPath),
      metadata_sha256: sha256(stableJson(artifact.metadata)),
      signature_path: signaturePath ? relativeFromRoot(outDir, signaturePath) : null,
      runtimes: artifact.metadata.runtime_artifacts.map((runtimeArtifact: any) => ({
        runtime: runtimeArtifact.runtime,
        compiled_digest: runtimeArtifact.compiled_digest,
        normalized_ir_digest: runtimeArtifact.normalized_ir_digest,
      })),
    });
  }
  const releaseManifest = buildReleaseManifest({
    releaseId,
    publisher,
    sourceCommit,
    packEntries,
  });
  const releaseManifestPath = join(outDir, "release-manifest.json");
  writeTextFile(releaseManifestPath, stableJson(releaseManifest));
  if (privateKeyPem && keyId) {
    const signature = createDetachedSignature({
      payload: releaseManifest,
      keyId,
      privateKeyPem,
    });
    writeTextFile(join(outDir, "release-manifest.sig.json"), stableJson(signature));
  }
  const checksums = buildChecksums(outDir);
  writeTextFile(join(outDir, "checksums.json"), stableJson(checksums));
  return {
    kind: "release-trust-bundle",
    trust_dir: outDir,
    release_manifest: releaseManifest,
    signed: Boolean(privateKeyPem && keyId),
  };
}

function resolvePublisherEntry(trustPolicy: any, publisherId: any) {
  return (
    trustPolicy.publishers.find((publisher: any) => publisher.id === publisherId) ?? null
  );
}

function verifyReleaseBundleForPack({
  repoRoot,
  manifestPath,
  compiledPack,
  trustPolicy,
}: { repoRoot: string; manifestPath: string; compiledPack?: any; trustPolicy?: any }) {
  const artifacts = findTrustArtifactsRoot(dirname(manifestPath));
  if (!artifacts) {
    return {
      verified: false,
      reasons: ["release-trust-bundle:not-found"],
    };
  }

  const releaseManifestPath = join(artifacts.trust_dir, "release-manifest.json");
  const signaturePath = join(artifacts.trust_dir, "release-manifest.sig.json");
  if (!exists(signaturePath)) {
    return {
      verified: false,
      reasons: ["release-trust-bundle:unsigned"],
    };
  }
  const checksumFailures = validateTrustBundleChecksums(artifacts.trust_dir);
  if (checksumFailures.length > 0) {
    return {
      verified: false,
      reasons: checksumFailures.map((failure: any) => `release-checksum-invalid:${failure}`),
    };
  }

  const releaseManifest = JSON.parse(readFileSync(releaseManifestPath, "utf8"));
  const signatureEnvelope = JSON.parse(readFileSync(signaturePath, "utf8"));
  const publisherEntry = resolvePublisherEntry(trustPolicy, releaseManifest.publisher);
  if (!publisherEntry) {
    return {
      verified: false,
      reasons: [`publisher-untrusted:${releaseManifest.publisher}`],
    };
  }
  const keyring = loadTrustKeyring(repoRoot, publisherEntry.keyring_path);
  const matchingKey = keyring.keys.find(
    (key: any) => key.key_id === signatureEnvelope.key_id && key.status !== "revoked",
  );
  if (!matchingKey) {
    return {
      verified: false,
      reasons: [`release-key-missing:${signatureEnvelope.key_id ?? "unknown"}`],
    };
  }
  if (
    !verifyDetachedSignature({
      payload: releaseManifest,
      signatureEnvelope,
      publicKeyPem: matchingKey.public_key_pem,
    })
  ) {
    return {
      verified: false,
      reasons: ["release-manifest-signature:invalid"],
    };
  }

  const packEntry = releaseManifest.packs.find((entry: any) => entry.pack_id === compiledPack.pack_id);
  if (!packEntry) {
    return {
      verified: false,
      reasons: [`release-pack-missing:${compiledPack.pack_id}`],
    };
  }
  const packMetadataPath = join(artifacts.trust_dir, packEntry.metadata_path);
  if (!exists(packMetadataPath)) {
    return {
      verified: false,
      reasons: [`pack-metadata-missing:${compiledPack.pack_id}`],
    };
  }
  const packMetadata = JSON.parse(readFileSync(packMetadataPath, "utf8"));
  if (!packEntry.signature_path) {
    return {
      verified: false,
      reasons: [`pack-signature-missing:${compiledPack.pack_id}`],
    };
  }
  const packSignaturePath = join(artifacts.trust_dir, packEntry.signature_path);
  if (!exists(packSignaturePath)) {
    return {
      verified: false,
      reasons: [`pack-signature-missing:${compiledPack.pack_id}`],
    };
  }
  const packSignature = JSON.parse(readFileSync(packSignaturePath, "utf8"));
  const packKey = keyring.keys.find(
    (key: any) => key.key_id === packSignature.key_id && key.status !== "revoked",
  );
  if (
    !packKey ||
    !verifyDetachedSignature({
      payload: packMetadata,
      signatureEnvelope: packSignature,
      publicKeyPem: packKey.public_key_pem,
    })
  ) {
    return {
      verified: false,
      reasons: [`pack-signature-invalid:${compiledPack.pack_id}`],
    };
  }
  if (packMetadata.manifest_digest !== compiledPack.manifest_digest) {
    return {
      verified: false,
      reasons: [`manifest-digest-mismatch:${compiledPack.pack_id}`],
    };
  }
  const expectedManifestPath = relativeFromRoot(artifacts.bundle_root, manifestPath);
  if (packMetadata.manifest_path !== expectedManifestPath) {
    return {
      verified: false,
      reasons: [`manifest-path-mismatch:${compiledPack.pack_id}`],
    };
  }
  const runtimeArtifact = packMetadata.runtime_artifacts.find(
    (entry: any) => entry.runtime === compiledPack.runtime,
  );
  if (!runtimeArtifact) {
    return {
      verified: false,
      reasons: [`runtime-artifact-missing:${compiledPack.pack_id}:${compiledPack.runtime}`],
    };
  }
  if (runtimeArtifact.compiled_digest !== compiledPack.digest) {
    return {
      verified: false,
      reasons: [`compiled-digest-mismatch:${compiledPack.pack_id}:${compiledPack.runtime}`],
    };
  }
  if (runtimeArtifact.normalized_ir_digest !== compiledPack.normalized_ir_digest) {
    return {
      verified: false,
      reasons: [`normalized-ir-digest-mismatch:${compiledPack.pack_id}:${compiledPack.runtime}`],
    };
  }

  return {
    verified: true,
    trust_dir: artifacts.trust_dir,
    publisher: releaseManifest.publisher,
    release_id: releaseManifest.release_id,
    key_id: signatureEnvelope.key_id,
    source_class: normalizeSourceClass(publisherEntry.source_class, "external-trusted"),
    reasons: [
      `release-verified:${releaseManifest.release_id}`,
      `publisher:${releaseManifest.publisher}`,
    ],
  };
}

export function assessPackTrust({
  repoRoot,
  manifestPath,
  manifest,
  compiledPack,
  currentVersion = null,
}: { repoRoot: string; manifestPath: string; manifest?: any; compiledPack?: any; currentVersion?: any }) {
  const trustPolicy = loadTrustPolicy(repoRoot);
  const versionPolicy = loadVersionPolicy(repoRoot);
  const versionDecision = evaluateVersionPolicy({
    currentVersion,
    candidateVersion: compiledPack.version ?? manifest.pack_version,
    policy: versionPolicy,
  });
  const authorityDecision = evaluatePackTrustAuthority({
    repoRoot,
    packId: manifest.pack.id,
    manifest,
  });
  const descriptorRecord = loadPackTrustDescriptorRecord({
    manifestPath,
    manifest,
  });
  const releaseVerification = verifyReleaseBundleForPack({
    repoRoot,
    manifestPath,
    compiledPack,
    trustPolicy,
  });

  let sourceClass;
  let verificationStatus;
  let publisher = descriptorRecord.descriptor?.publisher?.publisher_id ?? null;
  let releaseId = null;
  let keyId = null;
  let trustBundleDir = null;
  let reasons: string[] = [];

  if (releaseVerification.verified) {
    sourceClass = releaseVerification.source_class;
    verificationStatus = "verified";
    publisher = releaseVerification.publisher;
    releaseId = releaseVerification.release_id;
    keyId = releaseVerification.key_id;
    trustBundleDir = releaseVerification.trust_dir;
    reasons = [...releaseVerification.reasons];
  } else if (isWithin(repoRoot, manifestPath)) {
    sourceClass = "local-source";
    verificationStatus = "local";
    publisher = publisher ?? "local";
    reasons = [
      "local-source:manifest-under-current-repo",
      ...releaseVerification.reasons,
    ];
  } else {
    sourceClass = "external-unverified";
    verificationStatus = "unverified";
    reasons = [
      "external-source:manifest-outside-current-repo",
      ...releaseVerification.reasons,
    ];
  }

  const trustTier = resolveTrustTier({
    packId: manifest.pack.id,
    sourceClass,
    descriptor: descriptorRecord.descriptor,
    releaseVerification,
    authorityDecision,
  });
  const signatureStatus = resolveSignatureStatus({
    sourceClass,
    releaseVerification,
  });
  const runtimeSupport = evaluateRuntimeSupportClaim({
    repoRoot,
    manifest,
    runtime: compiledPack.runtime,
    descriptorRecord,
  });
  const capabilities = uniqueSorted(manifest.capabilities ?? []);
  const memoryAuthority = buildMemoryAuthoritySummary(manifest);
  const publisherClass = normalizePublisherClass(
    descriptorRecord.descriptor?.publisher?.publisher_class,
    publisher === "pairslash" ? "first-party" : "external",
  );
  const supportLevel = resolveSupportLevel({
    trustTier,
    supportLevelClaim: descriptorRecord.descriptor?.support_level_claim,
    runtimeSupportStatus: runtimeSupport.resolved_status,
  });

  let policyAction = resolveBasePolicyAction({
    trustTier,
    sourceClass,
    trustPolicy,
  });
  policyAction = mergeAction(policyAction, runtimeSupport.policy_action);
  reasons.push(...runtimeSupport.reasons);

  if (descriptorRecord.errors.length > 0) {
    reasons.push(...descriptorRecord.errors);
    if (descriptorRecord.descriptor) {
      policyAction = mergeAction(policyAction, sourceClass === "local-source" ? "ask" : "deny");
    }
  }
  if (authorityDecision.errors.length > 0) {
    reasons.push(...authorityDecision.errors);
    policyAction = mergeAction(policyAction, "deny");
  }

  if (
    memoryAuthority.global_project_memory === "write" &&
    authorityDecision.authorized_tier !== "core-maintained"
  ) {
    reasons.push(`memory-authority-exceeds-tier:${manifest.pack.id}`);
    policyAction = mergeAction(policyAction, "deny");
  }
  if (
    capabilities.includes("memory_write_global") &&
    authorityDecision.authorized_tier !== "core-maintained"
  ) {
    reasons.push(`capability-exceeds-tier:${manifest.pack.id}:memory_write_global`);
    policyAction = mergeAction(policyAction, "deny");
  }

  const receipt = {
    kind: "trust-receipt",
    schema_version: TRUST_RECEIPT_SCHEMA_VERSION,
    pack_id: manifest.pack.id,
    version: compiledPack.version ?? manifest.pack_version,
    manifest_path: isWithin(repoRoot, manifestPath)
      ? relativeFromRoot(repoRoot, manifestPath)
      : resolve(manifestPath),
    manifest_digest: compiledPack.manifest_digest,
    compiled_digest: compiledPack.digest,
    source_class: normalizeSourceClass(sourceClass, "external-unverified"),
    verification_status: isOneOf(verificationStatus, TRUST_VERIFICATION_STATUSES)
      ? verificationStatus
      : "unverified",
    trust_tier: normalizeTrustTier(trustTier, "unverified-external"),
    tier_claim: descriptorRecord.descriptor?.tier_claim ?? null,
    policy_action: policyAction,
    publisher,
    publisher_class: publisherClass,
    release_id: releaseId,
    key_id: keyId,
    trust_bundle_dir: trustBundleDir,
    signature_status: normalizeSignatureStatus(signatureStatus, "missing"),
    support_level: normalizeSupportLevel(supportLevel, "unsupported"),
    support_level_claim: descriptorRecord.descriptor?.support_level_claim ?? null,
    descriptor_path: descriptorRecord.descriptorPath
      ? isWithin(repoRoot, descriptorRecord.descriptorPath)
        ? relativeFromRoot(repoRoot, descriptorRecord.descriptorPath)
        : descriptorRecord.descriptorPath
      : null,
    descriptor_digest: descriptorRecord.descriptorDigest,
    runtime_support: runtimeSupport,
    capabilities,
    memory_authority: memoryAuthority,
    version_policy: versionDecision,
    reasons: uniqueSorted(reasons),
    summary: "",
  };
  receipt.summary = summarizeTrustReceipt(receipt);
  return receipt;
}

export function buildTrustDelta({ state, candidateReceipts, selectedPackIds }: { state?: any; candidateReceipts?: any; selectedPackIds?: any }) {
  const currentById = new Map<string, any>(
    (state?.packs ?? []).map((pack: any) => [
      pack.id,
      pack.trust_receipt ?? {
        kind: "trust-receipt",
        schema_version: TRUST_RECEIPT_SCHEMA_VERSION,
        pack_id: pack.id,
        version: pack.version,
        source_class: "local-source",
        verification_status: "legacy",
        trust_tier: "local-dev",
        policy_action: "allow",
        publisher: null,
        publisher_class: null,
        release_id: null,
        key_id: null,
        trust_bundle_dir: null,
        manifest_path: null,
        manifest_digest: pack.manifest_digest,
        compiled_digest: null,
        signature_status: "missing",
        support_level: "local-dev",
        support_level_claim: null,
        descriptor_path: null,
        descriptor_digest: null,
        runtime_support: {
          runtime: null,
          manifest_status: "unverified",
          declared_status: "unverified",
          resolved_status: "unverified",
          evidence_ref: null,
          evidence_present: false,
          policy_action: "ask",
          reasons: ["legacy-state:missing-runtime-support"],
        },
        capabilities: [],
        memory_authority: {
          authority_mode: "read-only",
          global_project_memory: "none",
          explicit_write_only: true,
        },
        version_policy: {
          status: "legacy",
          blocking: false,
          summary: "legacy install state without trust receipt",
          rule_id: "legacy-state",
        },
        reasons: ["legacy-state:missing-trust-receipt"],
        summary: "legacy install state without trust receipt",
      },
    ]),
  );
  const packChanges = selectedPackIds
    .slice()
    .sort((left: any, right: any) => left.localeCompare(right))
    .map((packId: string) => {
      const current = currentById.get(packId) ?? null;
      const candidate = candidateReceipts.get(packId) ?? null;
      const capabilityExpansions = current && candidate
        ? hasCapabilityExpansion(current.capabilities ?? [], candidate.capabilities ?? [])
        : [];
      const memoryEscalated = Boolean(
        current &&
          candidate &&
          current.memory_authority?.global_project_memory !== "write" &&
          candidate.memory_authority?.global_project_memory === "write"
      );
      const trustDowngrade =
        Boolean(current && candidate) &&
        current.trust_tier !== candidate.trust_tier &&
        ["local-dev", "unverified-external"].includes(candidate.trust_tier);
      const blockingReasons = [
        ...(candidate?.reasons ?? []),
        ...capabilityExpansions.map((capability: any) => `capability-expanded:${capability}`),
        ...(memoryEscalated ? ["memory-authority-escalated:global-project-memory"] : []),
        ...(trustDowngrade ? [`trust-tier-downgrade:${current.trust_tier}->${candidate?.trust_tier}`] : []),
      ];
      return {
        pack_id: packId,
        current: buildTrustDeltaSnapshot(current),
        candidate: buildTrustDeltaSnapshot(candidate),
        changed:
          !current ||
          !candidate ||
          current.source_class !== candidate.source_class ||
          current.verification_status !== candidate.verification_status ||
          current.trust_tier !== candidate.trust_tier ||
          current.policy_action !== candidate.policy_action ||
          current.version !== candidate.version ||
          current.release_id !== candidate.release_id ||
          current.signature_status !== candidate.signature_status ||
          current.support_level !== candidate.support_level ||
          current.runtime_support?.resolved_status !== candidate.runtime_support?.resolved_status ||
          capabilityExpansions.length > 0 ||
          memoryEscalated,
        blocking: Boolean(
          candidate &&
            (
              candidate.policy_action === "deny" ||
              candidate.version_policy?.blocking ||
              capabilityExpansions.length > 0 ||
              memoryEscalated ||
              trustDowngrade
            ),
        ),
        reasons: uniqueSorted(blockingReasons),
        capability_expansions: capabilityExpansions,
        memory_escalated: memoryEscalated,
        trust_downgrade: trustDowngrade,
      };
    });
  const blockingCount = packChanges.filter((change: any) => change.blocking).length;
  const changedCount = packChanges.filter((change: any) => change.changed).length;
  return {
    machine_readable: true,
    overall_status: blockingCount > 0 ? "blocked" : changedCount > 0 ? "changed" : "stable",
    blocking_count: blockingCount,
    changed_count: changedCount,
    summary:
      blockingCount > 0
        ? `${blockingCount} pack(s) have blocking trust or version policy changes`
        : changedCount > 0
          ? `${changedCount} pack(s) change trust posture in this preview`
          : "no trust posture change detected",
    pack_changes: packChanges,
  };
}

export function verifyReleaseTrustBundle({ repoRoot, trustDir = resolve(repoRoot, RELEASE_TRUST_DIR) }: { repoRoot: string; trustDir?: any }) {
  const releaseManifestPath = join(trustDir, "release-manifest.json");
  const signaturePath = join(trustDir, "release-manifest.sig.json");
  if (!exists(releaseManifestPath)) {
    throw new Error(`missing release manifest at ${releaseManifestPath}`);
  }
  if (!exists(signaturePath)) {
    throw new Error(`missing release signature at ${signaturePath}`);
  }
  const checksumFailures = validateTrustBundleChecksums(trustDir);
  if (checksumFailures.length > 0) {
    throw new Error(checksumFailures.join("; "));
  }
  const releaseManifest = JSON.parse(readFileSync(releaseManifestPath, "utf8"));
  const signatureEnvelope = JSON.parse(readFileSync(signaturePath, "utf8"));
  const trustPolicy = loadTrustPolicy(repoRoot);
  const publisherEntry = resolvePublisherEntry(trustPolicy, releaseManifest.publisher);
  if (!publisherEntry) {
    throw new Error(`publisher ${releaseManifest.publisher} is not trusted locally`);
  }
  const keyring = loadTrustKeyring(repoRoot, publisherEntry.keyring_path);
  const key = keyring.keys.find(
    (entry: any) => entry.key_id === signatureEnvelope.key_id && entry.status !== "revoked",
  );
  if (!key) {
    throw new Error(`missing public key ${signatureEnvelope.key_id}`);
  }
  if (
    !verifyDetachedSignature({
      payload: releaseManifest,
      signatureEnvelope,
      publicKeyPem: key.public_key_pem,
    })
  ) {
    throw new Error("release manifest signature is invalid");
  }
  const failures: any[] = [];
  for (const packEntry of releaseManifest.packs ?? []) {
    const metadataPath = join(trustDir, packEntry.metadata_path);
    if (!exists(metadataPath)) {
      failures.push(`missing pack metadata ${packEntry.metadata_path}`);
      continue;
    }
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
    if (packEntry.metadata_sha256 !== sha256(stableJson(metadata))) {
      failures.push(`pack metadata digest mismatch for ${packEntry.pack_id}`);
    }
    if (!packEntry.signature_path) {
      failures.push(`pack metadata signature missing for ${packEntry.pack_id}`);
      continue;
    }
    const packSignaturePath = join(trustDir, packEntry.signature_path);
    if (!exists(packSignaturePath)) {
      failures.push(`pack metadata signature file missing for ${packEntry.pack_id}`);
      continue;
    }
    const packSignature = JSON.parse(readFileSync(packSignaturePath, "utf8"));
    const packKey = keyring.keys.find(
      (entry: any) => entry.key_id === packSignature.key_id && entry.status !== "revoked",
    );
    if (
      !packKey ||
      !verifyDetachedSignature({
        payload: metadata,
        signatureEnvelope: packSignature,
        publicKeyPem: packKey.public_key_pem,
      })
    ) {
      failures.push(`pack metadata signature invalid for ${packEntry.pack_id}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
  return {
    kind: "release-trust-verification",
    release_id: releaseManifest.release_id,
    publisher: releaseManifest.publisher,
    pack_count: releaseManifest.pack_count,
    verified: true,
  };
}

export function verifyReleaseTrustBundleStructure({
  repoRoot,
  trustDir = resolve(repoRoot, RELEASE_TRUST_DIR),
}: { repoRoot: string; trustDir?: any }) {
  const releaseManifestPath = join(trustDir, "release-manifest.json");
  if (!exists(releaseManifestPath)) {
    throw new Error(`missing release manifest at ${releaseManifestPath}`);
  }
  const checksumFailures = validateTrustBundleChecksums(trustDir);
  if (checksumFailures.length > 0) {
    throw new Error(checksumFailures.join("; "));
  }
  const releaseManifest = JSON.parse(readFileSync(releaseManifestPath, "utf8"));
  const failures: any[] = [];
  const releaseSignaturePath = join(trustDir, "release-manifest.sig.json");
  const packEntries = releaseManifest.packs ?? [];
  const packSignatureStates = packEntries.map((entry: any) => Boolean(entry.signature_path));
  if (packSignatureStates.some((state: any) => state !== packSignatureStates[0])) {
    failures.push("pack signature state is inconsistent across release-manifest entries");
  }
  const signed = packSignatureStates.length === 0 ? exists(releaseSignaturePath) : packSignatureStates[0];
  if (signed && !exists(releaseSignaturePath)) {
    failures.push("missing release signature artifact release-manifest.sig.json");
  }
  if (!signed && exists(releaseSignaturePath)) {
    failures.push("unexpected release signature artifact release-manifest.sig.json");
  }
  const expectedSignatureArtifacts = new Set<any>();
  if (signed) {
    expectedSignatureArtifacts.add("release-manifest.sig.json");
  }

  for (const packEntry of packEntries) {
    const metadataPath = join(trustDir, packEntry.metadata_path);
    if (!exists(metadataPath)) {
      failures.push(`missing pack metadata ${packEntry.metadata_path}`);
      continue;
    }
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
    if (packEntry.metadata_sha256 !== sha256(stableJson(metadata))) {
      failures.push(`pack metadata digest mismatch for ${packEntry.pack_id}`);
    }
    if (signed) {
      if (!packEntry.signature_path) {
        failures.push(`pack metadata signature missing for ${packEntry.pack_id}`);
      } else {
        expectedSignatureArtifacts.add(packEntry.signature_path);
        if (!exists(join(trustDir, packEntry.signature_path))) {
          failures.push(`pack metadata signature file missing for ${packEntry.pack_id}`);
        }
      }
    } else if (packEntry.signature_path) {
      failures.push(`pack metadata signature unexpected for unsigned bundle ${packEntry.pack_id}`);
    }
  }
  const actualSignatureArtifacts = collectSignatureArtifacts(trustDir);
  const actualSignatureArtifactSet = new Set(actualSignatureArtifacts);
  for (const artifactPath of actualSignatureArtifacts) {
    if (!expectedSignatureArtifacts.has(artifactPath)) {
      failures.push(`unexpected release signature artifact ${artifactPath}`);
    }
  }
  for (const artifactPath of expectedSignatureArtifacts) {
    if (!actualSignatureArtifactSet.has(artifactPath)) {
      failures.push(`missing release signature artifact ${artifactPath}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
  return {
    kind: "release-trust-structure-verification",
    release_id: releaseManifest.release_id,
    publisher: releaseManifest.publisher,
    pack_count: releaseManifest.pack_count,
    signed,
    verified: true,
  };
}
