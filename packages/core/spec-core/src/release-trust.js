import { sign as signBuffer, verify as verifyBuffer } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import YAML from "yaml";

import {
  DETACHED_SIGNATURE_SCHEMA_VERSION,
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
} from "./constants.js";
import { validatePackTrustDescriptor } from "./validate.js";
import { exists, readFileNormalized, relativeFrom, sha256, stableJson, walkFiles, writeTextFile } from "./utils.js";

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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function normalizeAction(value, fallback) {
  return TRUST_POLICY_ACTIONS.includes(value) ? value : fallback;
}

function normalizeSourceClass(value, fallback) {
  return TRUST_SOURCE_CLASSES.includes(value) ? value : fallback;
}

function normalizeTrustTier(value, fallback = "unverified-external") {
  return PACK_TRUST_TIERS.includes(value) ? value : fallback;
}

function normalizeSupportLevel(value, fallback = "unsupported") {
  return PACK_SUPPORT_LEVELS.includes(value) ? value : fallback;
}

function normalizePublisherClass(value, fallback = "external") {
  return PACK_PUBLISHER_CLASSES.includes(value) ? value : fallback;
}

function normalizeRuntimeSupportStatus(value, fallback = "unverified") {
  return PACK_RUNTIME_SUPPORT_STATUSES.includes(value) ? value : fallback;
}

function normalizeSignatureStatus(value, fallback = "missing") {
  return PACK_SIGNATURE_STATUSES.includes(value) ? value : fallback;
}

const ACTION_PRECEDENCE = Object.freeze({
  allow: 0,
  ask: 1,
  deny: 2,
});

function mergeAction(current, candidate) {
  const normalizedCurrent = normalizeAction(current, "allow");
  const normalizedCandidate = normalizeAction(candidate, normalizedCurrent);
  return ACTION_PRECEDENCE[normalizedCandidate] > ACTION_PRECEDENCE[normalizedCurrent]
    ? normalizedCandidate
    : normalizedCurrent;
}

const SUPPORT_STATUS_RANK = Object.freeze({
  blocked: 0,
  unverified: 1,
  partial: 2,
  supported: 3,
});

function pickWeakerSupportStatus(left, right) {
  const normalizedLeft = normalizeRuntimeSupportStatus(left, "unverified");
  const normalizedRight = normalizeRuntimeSupportStatus(right, "unverified");
  return SUPPORT_STATUS_RANK[normalizedLeft] <= SUPPORT_STATUS_RANK[normalizedRight]
    ? normalizedLeft
    : normalizedRight;
}

function mergePolicy(base, override) {
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
    const byId = new Map(merged.publishers.map((publisher) => [publisher.id, publisher]));
    for (const publisher of override.publishers) {
      if (!publisher?.id) {
        continue;
      }
      const current = byId.get(publisher.id) ?? { id: publisher.id };
      byId.set(publisher.id, {
        ...current,
        ...publisher,
        source_class: normalizeSourceClass(
          publisher.source_class,
          current.source_class ?? "external-trusted",
        ),
      });
    }
    merged.publishers = [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
  }
  return merged;
}

function normalizeVersionPolicy(policy) {
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

function loadStructuredFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  if (filePath.endsWith(".json")) {
    return JSON.parse(text);
  }
  return YAML.parse(text);
}

function stripRefFragment(value) {
  if (typeof value !== "string") {
    return value;
  }
  const [pathPart] = value.split("#", 1);
  return pathPart;
}

function isLikelyRemoteRef(value) {
  return typeof value === "string" && /^[a-z]+:\/\//i.test(value);
}

export function resolvePackTrustDescriptorPath(manifestPath, manifest) {
  const manifestDir = dirname(resolve(manifestPath));
  if (typeof manifest?.trust_descriptor === "string" && manifest.trust_descriptor.trim() !== "") {
    return resolve(manifestDir, manifest.trust_descriptor);
  }
  const fallback = resolve(manifestDir, "pack.trust.yaml");
  return exists(fallback) ? fallback : null;
}

export function loadPackTrustDescriptorRecord({ manifestPath, manifest }) {
  const descriptorPath = resolvePackTrustDescriptorPath(manifestPath, manifest);
  if (!descriptorPath) {
    return {
      descriptorPath: null,
      descriptorDigest: null,
      descriptor: null,
      errors: ["trust-descriptor:missing"],
    };
  }
  if (!exists(descriptorPath)) {
    return {
      descriptorPath,
      descriptorDigest: null,
      descriptor: null,
      errors: [`trust-descriptor:not-found:${relativeFromRoot(dirname(descriptorPath), descriptorPath)}`],
    };
  }
  try {
    const descriptor = loadStructuredFile(descriptorPath);
    const errors = validatePackTrustDescriptor(descriptor, { manifest });
    return {
      descriptorPath,
      descriptorDigest: sha256(readFileNormalized(descriptorPath)),
      descriptor,
      errors,
    };
  } catch (error) {
    return {
      descriptorPath,
      descriptorDigest: null,
      descriptor: null,
      errors: [`trust-descriptor:invalid:${error.message}`],
    };
  }
}

function isWithin(rootPath, maybeChildPath) {
  const resolvedRoot = resolve(rootPath);
  const resolvedChild = resolve(maybeChildPath);
  return (
    resolvedChild === resolvedRoot ||
    resolvedChild.startsWith(`${resolvedRoot}\\`) ||
    resolvedChild.startsWith(`${resolvedRoot}/`)
  );
}

function findTrustArtifactsRoot(startPath) {
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

function relativeFromRoot(rootPath, filePath) {
  return relativeFrom(resolve(rootPath), resolve(filePath));
}

function parseSemver(version) {
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

function compareSemver(left, right) {
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

function deriveManifestRuntimeSupportStatus(manifest, runtime) {
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

function resolveEvidencePresence({ repoRoot, descriptorPath, evidenceRef }) {
  if (typeof evidenceRef !== "string" || evidenceRef.trim() === "") {
    return false;
  }
  if (isLikelyRemoteRef(evidenceRef)) {
    return true;
  }
  const relativeRef = stripRefFragment(evidenceRef);
  const candidatePaths = [
    resolve(dirname(descriptorPath), relativeRef),
    repoRoot ? resolve(repoRoot, relativeRef) : null,
  ].filter(Boolean);
  return candidatePaths.some((candidatePath) => exists(candidatePath));
}

function evaluateRuntimeSupportClaim({ repoRoot, manifest, runtime, descriptorRecord }) {
  const manifestStatus = deriveManifestRuntimeSupportStatus(manifest, runtime);
  const declaredStatus = normalizeRuntimeSupportStatus(
    descriptorRecord?.descriptor?.runtime_support?.[runtime]?.status,
    manifestStatus,
  );
  const evidenceRef = descriptorRecord?.descriptor?.runtime_support?.[runtime]?.evidence_ref ?? null;
  const evidencePresent = descriptorRecord?.descriptorPath
    ? resolveEvidencePresence({
        repoRoot,
        descriptorPath: descriptorRecord.descriptorPath,
        evidenceRef,
      })
    : false;
  const reasons = [];
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
    evidence_present: evidencePresent,
    policy_action: policyAction,
    reasons,
  };
}

function resolveTrustTier({
  sourceClass,
  descriptor,
  releaseVerification,
}) {
  const tierClaim = normalizeTrustTier(
    descriptor?.tier_claim,
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
  return sourceClass === "external-trusted" ? "verified-external" : "unverified-external";
}

function resolveSupportLevel({
  trustTier,
  supportLevelClaim,
  runtimeSupportStatus,
}) {
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

function resolveSignatureStatus({ sourceClass, releaseVerification }) {
  if (sourceClass === "local-source") {
    return "local-dev";
  }
  if (releaseVerification.verified) {
    return "verified";
  }
  if (
    releaseVerification.reasons?.some((reason) =>
      reason.includes("signature:invalid") ||
      reason.includes("pack-signature-invalid") ||
      reason.includes("release-manifest-signature:invalid"),
    )
  ) {
    return "invalid";
  }
  return "missing";
}

function resolveBasePolicyAction({ trustTier, sourceClass, trustPolicy }) {
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

function buildMemoryAuthoritySummary(manifest) {
  return {
    authority_mode: manifest.memory_permissions?.authority_mode ?? "read-only",
    global_project_memory: manifest.memory_permissions?.global_project_memory ?? "none",
    explicit_write_only: manifest.memory_permissions?.explicit_write_only === true,
  };
}

function hasCapabilityExpansion(currentCapabilities = [], candidateCapabilities = []) {
  const current = new Set(currentCapabilities);
  return candidateCapabilities.filter((capability) => !current.has(capability));
}

function buildTrustDeltaSnapshot(receipt) {
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

function summarizeTrustReceipt(receipt) {
  const versionSummary = receipt.version_policy?.summary ? `; ${receipt.version_policy.summary}` : "";
  return `${receipt.trust_tier ?? receipt.source_class} (${receipt.signature_status ?? receipt.verification_status}; ${receipt.support_level ?? "unsupported"})${versionSummary}`;
}

export function loadTrustPolicy(repoRoot) {
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

export function loadVersionPolicy(repoRoot) {
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

export function loadTrustKeyring(repoRoot, keyringPath) {
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
          .filter((key) => key?.key_id && key?.public_key_pem)
          .map((key) => ({
            key_id: key.key_id,
            public_key_pem: key.public_key_pem,
            status: key.status ?? "active",
          }))
      : [],
  };
}

export function evaluateVersionPolicy({ currentVersion = null, candidateVersion, policy }) {
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
}) {
  const packVersion = compiledPacks[0]?.version ?? manifest.pack_version ?? null;
  const packSourceRoot = resolve(repoRoot, manifest.runtime_assets?.source_root ?? manifest.assets?.pack_dir);
  const sourceFiles = walkFiles(packSourceRoot).map((absolutePath) => ({
    relative_path: relativeFromRoot(packSourceRoot, absolutePath),
    sha256: sha256(readFileNormalized(absolutePath)),
    size_bytes: Buffer.byteLength(readFileNormalized(absolutePath)),
  }));
  const runtimeArtifacts = compiledPacks
    .slice()
    .sort((left, right) => left.runtime.localeCompare(right.runtime))
    .map((compiledPack) => ({
      runtime: compiledPack.runtime,
      bundle_kind: compiledPack.bundle_kind,
      compiled_digest: compiledPack.digest,
      normalized_ir_digest: compiledPack.normalized_ir_digest,
      files: compiledPack.files.map((file) => ({
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

export function createDetachedSignature({ payload, keyId, privateKeyPem }) {
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

export function verifyDetachedSignature({ payload, signatureEnvelope, publicKeyPem }) {
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
}) {
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

function buildChecksums(trustDir) {
  const entries = walkFiles(trustDir)
    .filter((filePath) => !filePath.endsWith("checksums.json"))
    .map((filePath) => ({
      path: relativeFromRoot(trustDir, filePath),
      sha256: sha256(readFileNormalized(filePath)),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return {
    kind: "checksum-set",
    schema_version: "1.0.0",
    algorithm: "sha256",
    entries,
  };
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
}) {
  const packEntries = [];
  for (const artifact of packArtifacts.slice().sort((left, right) => left.pack_id.localeCompare(right.pack_id))) {
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
      runtimes: artifact.metadata.runtime_artifacts.map((runtimeArtifact) => ({
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

function resolvePublisherEntry(trustPolicy, publisherId) {
  return (
    trustPolicy.publishers.find((publisher) => publisher.id === publisherId) ?? null
  );
}

function verifyReleaseBundleForPack({
  repoRoot,
  manifestPath,
  compiledPack,
  trustPolicy,
}) {
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
    (key) => key.key_id === signatureEnvelope.key_id && key.status !== "revoked",
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

  const packEntry = releaseManifest.packs.find((entry) => entry.pack_id === compiledPack.pack_id);
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
  if (packEntry.signature_path) {
    const packSignaturePath = join(artifacts.trust_dir, packEntry.signature_path);
    if (!exists(packSignaturePath)) {
      return {
        verified: false,
        reasons: [`pack-signature-missing:${compiledPack.pack_id}`],
      };
    }
    const packSignature = JSON.parse(readFileSync(packSignaturePath, "utf8"));
    const packKey = keyring.keys.find(
      (key) => key.key_id === packSignature.key_id && key.status !== "revoked",
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
    (entry) => entry.runtime === compiledPack.runtime,
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
}) {
  const trustPolicy = loadTrustPolicy(repoRoot);
  const versionPolicy = loadVersionPolicy(repoRoot);
  const versionDecision = evaluateVersionPolicy({
    currentVersion,
    candidateVersion: compiledPack.version ?? manifest.pack_version,
    policy: versionPolicy,
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
  let reasons = [];

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
    sourceClass,
    descriptor: descriptorRecord.descriptor,
    releaseVerification,
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

  if (
    memoryAuthority.global_project_memory === "write" &&
    descriptorRecord.descriptor?.tier_claim !== "core-maintained"
  ) {
    reasons.push(`memory-authority-exceeds-tier:${manifest.pack.id}`);
    policyAction = mergeAction(policyAction, "deny");
  }
  if (
    capabilities.includes("memory_write_global") &&
    descriptorRecord.descriptor?.tier_claim !== "core-maintained"
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
    verification_status: TRUST_VERIFICATION_STATUSES.includes(verificationStatus)
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

export function buildTrustDelta({ state, candidateReceipts, selectedPackIds }) {
  const currentById = new Map(
    (state?.packs ?? []).map((pack) => [
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
    .sort((left, right) => left.localeCompare(right))
    .map((packId) => {
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
        ...capabilityExpansions.map((capability) => `capability-expanded:${capability}`),
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
  const blockingCount = packChanges.filter((change) => change.blocking).length;
  const changedCount = packChanges.filter((change) => change.changed).length;
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

export function verifyReleaseTrustBundle({ repoRoot, trustDir = resolve(repoRoot, RELEASE_TRUST_DIR) }) {
  const releaseManifestPath = join(trustDir, "release-manifest.json");
  const signaturePath = join(trustDir, "release-manifest.sig.json");
  if (!exists(releaseManifestPath)) {
    throw new Error(`missing release manifest at ${releaseManifestPath}`);
  }
  if (!exists(signaturePath)) {
    throw new Error(`missing release signature at ${signaturePath}`);
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
    (entry) => entry.key_id === signatureEnvelope.key_id && entry.status !== "revoked",
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
  const failures = [];
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
      (entry) => entry.key_id === packSignature.key_id && entry.status !== "revoked",
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
