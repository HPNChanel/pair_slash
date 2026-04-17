import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { compileCodexPack } from "@pairslash/compiler-codex";
import { compileCopilotPack } from "@pairslash/compiler-copilot";
import {
  assessPackTrust,
  buildPackMetadataEnvelope,
  loadPackManifest,
  readFileNormalized,
  sha256,
  validateReleaseTrustBootstrap,
  verifyReleaseTrustBundle,
  verifyReleaseTrustBundleStructure,
  writeReleaseTrustBundle,
} from "@pairslash/spec-core";

import { createTempRepo, updatePackManifest } from "../../../../tests/phase4-helpers.js";

test("release trust bundle signs, verifies, and upgrades pack trust to first-party release", () => {
  const fixture = createTempRepo();
  try {
    mkdirSync(join(fixture.tempRoot, "trust"), { recursive: true });
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    writeFileSync(
      join(fixture.tempRoot, "trust", "first-party-keys.json"),
      JSON.stringify(
        {
          kind: "trust-keyring",
          schema_version: "1.0.0",
          publisher: "pairslash",
          keys: [
            {
              key_id: "test-release-key",
              status: "active",
              public_key_pem: publicKey.export({ format: "pem", type: "spki" }),
            },
          ],
        },
        null,
        2,
      ),
    );

    const manifestPath = join(
      fixture.tempRoot,
      "packs",
      "core",
      "pairslash-plan",
      "pack.manifest.yaml",
    );
    const manifest = loadPackManifest(manifestPath);
    const codexCompiled = compileCodexPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const copilotCompiled = compileCopilotPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const metadata = buildPackMetadataEnvelope({
      repoRoot: fixture.tempRoot,
      manifestPath,
      manifest,
      compiledPacks: [codexCompiled, copilotCompiled],
    });

    writeReleaseTrustBundle({
      repoRoot: fixture.tempRoot,
      releaseId: "0.4.0-test",
      packArtifacts: [
        {
          pack_id: "pairslash-plan",
          metadata,
        },
      ],
      privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }),
      keyId: "test-release-key",
    });

    const verification = verifyReleaseTrustBundle({
      repoRoot: fixture.tempRoot,
    });
    assert.equal(verification.verified, true);

    const trustReceipt = assessPackTrust({
      repoRoot: fixture.tempRoot,
      manifestPath,
      manifest,
      compiledPack: codexCompiled,
    });
    assert.equal(trustReceipt.source_class, "first-party-release");
    assert.equal(trustReceipt.verification_status, "verified");
    assert.equal(trustReceipt.policy_action, "allow");
    assert.equal(trustReceipt.trust_tier, "core-maintained");
    assert.equal(trustReceipt.signature_status, "verified");
    assert.equal(trustReceipt.support_level, "core-supported");
    assert.equal(trustReceipt.release_id, "0.4.0-test");
  } finally {
    fixture.cleanup();
  }
});

test("structural release-trust verification succeeds for an unsigned bundle", () => {
  const fixture = createTempRepo();
  try {
    const manifestPath = join(
      fixture.tempRoot,
      "packs",
      "core",
      "pairslash-plan",
      "pack.manifest.yaml",
    );
    const manifest = loadPackManifest(manifestPath);
    const codexCompiled = compileCodexPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const copilotCompiled = compileCopilotPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const metadata = buildPackMetadataEnvelope({
      repoRoot: fixture.tempRoot,
      manifestPath,
      manifest,
      compiledPacks: [codexCompiled, copilotCompiled],
    });

    writeReleaseTrustBundle({
      repoRoot: fixture.tempRoot,
      releaseId: "0.4.0-structural",
      packArtifacts: [
        {
          pack_id: "pairslash-plan",
          metadata,
        },
      ],
    });

    const verification = verifyReleaseTrustBundleStructure({
      repoRoot: fixture.tempRoot,
    });
    assert.equal(verification.verified, true);
    assert.equal(verification.signed, false);
  } finally {
    fixture.cleanup();
  }
});

test("structural release-trust verification fails when unexpected signature artifact is present", () => {
  const fixture = createTempRepo();
  try {
    mkdirSync(join(fixture.tempRoot, "trust"), { recursive: true });
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    writeFileSync(
      join(fixture.tempRoot, "trust", "first-party-keys.json"),
      JSON.stringify(
        {
          kind: "trust-keyring",
          schema_version: "1.0.0",
          publisher: "pairslash",
          keys: [
            {
              key_id: "test-release-key",
              status: "active",
              public_key_pem: publicKey.export({ format: "pem", type: "spki" }),
            },
          ],
        },
        null,
        2,
      ),
    );

    const manifestPath = join(
      fixture.tempRoot,
      "packs",
      "core",
      "pairslash-plan",
      "pack.manifest.yaml",
    );
    const manifest = loadPackManifest(manifestPath);
    const codexCompiled = compileCodexPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const copilotCompiled = compileCopilotPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const metadata = buildPackMetadataEnvelope({
      repoRoot: fixture.tempRoot,
      manifestPath,
      manifest,
      compiledPacks: [codexCompiled, copilotCompiled],
    });

    const trustDir = join(fixture.tempRoot, "dist", "release-trust");
    writeReleaseTrustBundle({
      repoRoot: fixture.tempRoot,
      releaseId: "0.4.0-signed-first",
      packArtifacts: [
        {
          pack_id: "pairslash-plan",
          metadata,
        },
      ],
      privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }),
      keyId: "test-release-key",
      outDir: trustDir,
    });
    const staleReleaseSignature = readFileSync(join(trustDir, "release-manifest.sig.json"), "utf8");

    writeReleaseTrustBundle({
      repoRoot: fixture.tempRoot,
      releaseId: "0.4.0-unsigned-second",
      packArtifacts: [
        {
          pack_id: "pairslash-plan",
          metadata,
        },
      ],
      outDir: trustDir,
    });

    const staleSignaturePath = join(trustDir, "release-manifest.sig.json");
    writeFileSync(staleSignaturePath, staleReleaseSignature);
    const checksumsPath = join(trustDir, "checksums.json");
    const checksums = JSON.parse(readFileSync(checksumsPath, "utf8"));
    checksums.entries = (checksums.entries ?? []).filter(
      (entry) => entry.path !== "release-manifest.sig.json",
    );
    checksums.entries.push({
      path: "release-manifest.sig.json",
      sha256: sha256(readFileNormalized(staleSignaturePath)),
    });
    writeFileSync(checksumsPath, JSON.stringify(checksums, null, 2));

    assert.throws(
      () => verifyReleaseTrustBundleStructure({ repoRoot: fixture.tempRoot, trustDir }),
      /unexpected release signature artifact release-manifest\.sig\.json/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("release trust bootstrap requires at least one active first-party key", () => {
  const fixture = createTempRepo();
  try {
    const keyringPath = join(fixture.tempRoot, "trust", "first-party-keys.json");
    const keyring = JSON.parse(readFileSync(keyringPath, "utf8"));
    keyring.keys = (keyring.keys ?? []).map((key) => ({
      ...key,
      status: "revoked",
    }));
    writeFileSync(keyringPath, JSON.stringify(keyring, null, 2));

    const validation = validateReleaseTrustBootstrap({ repoRoot: fixture.tempRoot });
    assert.equal(validation.ok, false);
    assert.match(validation.failures.join("; "), /trust-keyring:no-active-keys:pairslash/);
  } finally {
    fixture.cleanup();
  }
});

test("release trust bootstrap requires committed trust policy file", () => {
  const fixture = createTempRepo();
  try {
    rmSync(join(fixture.tempRoot, "trust", "trust-policy.yaml"), { force: true });

    const validation = validateReleaseTrustBootstrap({ repoRoot: fixture.tempRoot });
    assert.equal(validation.ok, false);
    assert.match(validation.failures.join("; "), /trust-policy:missing:trust\/trust-policy\.yaml/);
  } finally {
    fixture.cleanup();
  }
});

test("release trust bootstrap requires a first-party publisher mapping", () => {
  const fixture = createTempRepo();
  try {
    const trustPolicyPath = join(fixture.tempRoot, "trust", "trust-policy.yaml");
    const updatedPolicy = readFileSync(trustPolicyPath, "utf8").replace(
      "source_class: first-party-release",
      "source_class: external-trusted",
    );
    writeFileSync(trustPolicyPath, updatedPolicy);

    const validation = validateReleaseTrustBootstrap({ repoRoot: fixture.tempRoot });
    assert.equal(validation.ok, false);
    assert.match(
      validation.failures.join("; "),
      /trust-policy:publisher-source-class-not-first-party-release:pairslash:external-trusted/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("release trust bootstrap requires the keyring publisher to match pairslash", () => {
  const fixture = createTempRepo();
  try {
    const keyringPath = join(fixture.tempRoot, "trust", "first-party-keys.json");
    const keyring = JSON.parse(readFileSync(keyringPath, "utf8"));
    keyring.publisher = "other-publisher";
    writeFileSync(keyringPath, JSON.stringify(keyring, null, 2));

    const validation = validateReleaseTrustBootstrap({ repoRoot: fixture.tempRoot });
    assert.equal(validation.ok, false);
    assert.match(
      validation.failures.join("; "),
      /trust-keyring:publisher-mismatch:trust\/first-party-keys\.json:other-publisher/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("release trust bootstrap requires committed pack authority file", () => {
  const fixture = createTempRepo();
  try {
    rmSync(join(fixture.tempRoot, "trust", "pack-authority.yaml"), { force: true });

    const validation = validateReleaseTrustBootstrap({ repoRoot: fixture.tempRoot });
    assert.equal(validation.ok, false);
    assert.match(
      validation.failures.join("; "),
      /pack-authority:invalid:pack trust authority file not found/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("structural release-trust verification fails when checksum set is missing", () => {
  const fixture = createTempRepo();
  try {
    const manifestPath = join(
      fixture.tempRoot,
      "packs",
      "core",
      "pairslash-plan",
      "pack.manifest.yaml",
    );
    const manifest = loadPackManifest(manifestPath);
    const codexCompiled = compileCodexPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const copilotCompiled = compileCopilotPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const metadata = buildPackMetadataEnvelope({
      repoRoot: fixture.tempRoot,
      manifestPath,
      manifest,
      compiledPacks: [codexCompiled, copilotCompiled],
    });

    writeReleaseTrustBundle({
      repoRoot: fixture.tempRoot,
      releaseId: "0.4.0-missing-checksums",
      packArtifacts: [
        {
          pack_id: "pairslash-plan",
          metadata,
        },
      ],
    });

    rmSync(join(fixture.tempRoot, "dist", "release-trust", "checksums.json"), { force: true });
    assert.throws(
      () => verifyReleaseTrustBundleStructure({ repoRoot: fixture.tempRoot }),
      /missing checksum set/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("release trust verification fails when checksum set contains duplicate entry paths", () => {
  const fixture = createTempRepo();
  try {
    mkdirSync(join(fixture.tempRoot, "trust"), { recursive: true });
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    writeFileSync(
      join(fixture.tempRoot, "trust", "first-party-keys.json"),
      JSON.stringify(
        {
          kind: "trust-keyring",
          schema_version: "1.0.0",
          publisher: "pairslash",
          keys: [
            {
              key_id: "test-release-key",
              status: "active",
              public_key_pem: publicKey.export({ format: "pem", type: "spki" }),
            },
          ],
        },
        null,
        2,
      ),
    );

    const manifestPath = join(
      fixture.tempRoot,
      "packs",
      "core",
      "pairslash-plan",
      "pack.manifest.yaml",
    );
    const manifest = loadPackManifest(manifestPath);
    const codexCompiled = compileCodexPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const copilotCompiled = compileCopilotPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const metadata = buildPackMetadataEnvelope({
      repoRoot: fixture.tempRoot,
      manifestPath,
      manifest,
      compiledPacks: [codexCompiled, copilotCompiled],
    });

    writeReleaseTrustBundle({
      repoRoot: fixture.tempRoot,
      releaseId: "0.4.0-checksum-duplicate",
      packArtifacts: [
        {
          pack_id: "pairslash-plan",
          metadata,
        },
      ],
      privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }),
      keyId: "test-release-key",
    });

    const checksumsPath = join(fixture.tempRoot, "dist", "release-trust", "checksums.json");
    const checksums = JSON.parse(readFileSync(checksumsPath, "utf8"));
    const duplicate = checksums.entries.find((entry) => entry.path === "release-manifest.json");
    checksums.entries.push(duplicate);
    writeFileSync(checksumsPath, JSON.stringify(checksums, null, 2));

    assert.throws(
      () => verifyReleaseTrustBundle({ repoRoot: fixture.tempRoot }),
      /duplicate checksum entry for release-manifest\.json/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("release trust verification fails when checksum set includes traversal path", () => {
  const fixture = createTempRepo();
  try {
    mkdirSync(join(fixture.tempRoot, "trust"), { recursive: true });
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    writeFileSync(
      join(fixture.tempRoot, "trust", "first-party-keys.json"),
      JSON.stringify(
        {
          kind: "trust-keyring",
          schema_version: "1.0.0",
          publisher: "pairslash",
          keys: [
            {
              key_id: "test-release-key",
              status: "active",
              public_key_pem: publicKey.export({ format: "pem", type: "spki" }),
            },
          ],
        },
        null,
        2,
      ),
    );

    const manifestPath = join(
      fixture.tempRoot,
      "packs",
      "core",
      "pairslash-plan",
      "pack.manifest.yaml",
    );
    const manifest = loadPackManifest(manifestPath);
    const codexCompiled = compileCodexPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const copilotCompiled = compileCopilotPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const metadata = buildPackMetadataEnvelope({
      repoRoot: fixture.tempRoot,
      manifestPath,
      manifest,
      compiledPacks: [codexCompiled, copilotCompiled],
    });

    writeReleaseTrustBundle({
      repoRoot: fixture.tempRoot,
      releaseId: "0.4.0-checksum-path-tamper",
      packArtifacts: [
        {
          pack_id: "pairslash-plan",
          metadata,
        },
      ],
      privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }),
      keyId: "test-release-key",
    });

    const checksumsPath = join(fixture.tempRoot, "dist", "release-trust", "checksums.json");
    const checksums = JSON.parse(readFileSync(checksumsPath, "utf8"));
    checksums.entries.push({
      path: "../escape.json",
      sha256: "0".repeat(64),
    });
    writeFileSync(checksumsPath, JSON.stringify(checksums, null, 2));

    assert.throws(
      () => verifyReleaseTrustBundle({ repoRoot: fixture.tempRoot }),
      /invalid checksum entry path \.\.\/escape\.json/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("signed release-trust verification fails when release signature is missing", () => {
  const fixture = createTempRepo();
  try {
    mkdirSync(join(fixture.tempRoot, "trust"), { recursive: true });
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    writeFileSync(
      join(fixture.tempRoot, "trust", "first-party-keys.json"),
      JSON.stringify(
        {
          kind: "trust-keyring",
          schema_version: "1.0.0",
          publisher: "pairslash",
          keys: [
            {
              key_id: "test-release-key",
              status: "active",
              public_key_pem: publicKey.export({ format: "pem", type: "spki" }),
            },
          ],
        },
        null,
        2,
      ),
    );

    const manifestPath = join(
      fixture.tempRoot,
      "packs",
      "core",
      "pairslash-plan",
      "pack.manifest.yaml",
    );
    const manifest = loadPackManifest(manifestPath);
    const codexCompiled = compileCodexPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const copilotCompiled = compileCopilotPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const metadata = buildPackMetadataEnvelope({
      repoRoot: fixture.tempRoot,
      manifestPath,
      manifest,
      compiledPacks: [codexCompiled, copilotCompiled],
    });

    writeReleaseTrustBundle({
      repoRoot: fixture.tempRoot,
      releaseId: "0.4.0-missing-release-signature",
      packArtifacts: [
        {
          pack_id: "pairslash-plan",
          metadata,
        },
      ],
      privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }),
      keyId: "test-release-key",
    });

    rmSync(join(fixture.tempRoot, "dist", "release-trust", "release-manifest.sig.json"), { force: true });
    assert.throws(
      () => verifyReleaseTrustBundle({ repoRoot: fixture.tempRoot }),
      /missing release signature/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("release trust verification fails when release signature payload is tampered", () => {
  const fixture = createTempRepo();
  try {
    mkdirSync(join(fixture.tempRoot, "trust"), { recursive: true });
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    writeFileSync(
      join(fixture.tempRoot, "trust", "first-party-keys.json"),
      JSON.stringify(
        {
          kind: "trust-keyring",
          schema_version: "1.0.0",
          publisher: "pairslash",
          keys: [
            {
              key_id: "test-release-key",
              status: "active",
              public_key_pem: publicKey.export({ format: "pem", type: "spki" }),
            },
          ],
        },
        null,
        2,
      ),
    );

    const manifestPath = join(
      fixture.tempRoot,
      "packs",
      "core",
      "pairslash-plan",
      "pack.manifest.yaml",
    );
    const manifest = loadPackManifest(manifestPath);
    const codexCompiled = compileCodexPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const copilotCompiled = compileCopilotPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const metadata = buildPackMetadataEnvelope({
      repoRoot: fixture.tempRoot,
      manifestPath,
      manifest,
      compiledPacks: [codexCompiled, copilotCompiled],
    });

    const trustDir = join(fixture.tempRoot, "dist", "release-trust");
    writeReleaseTrustBundle({
      repoRoot: fixture.tempRoot,
      releaseId: "0.4.0-signature-tamper",
      packArtifacts: [
        {
          pack_id: "pairslash-plan",
          metadata,
        },
      ],
      privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }),
      keyId: "test-release-key",
      outDir: trustDir,
    });

    const signaturePath = join(trustDir, "release-manifest.sig.json");
    const signatureEnvelope = JSON.parse(readFileSync(signaturePath, "utf8"));
    signatureEnvelope.payload_sha256 = "0".repeat(64);
    writeFileSync(signaturePath, JSON.stringify(signatureEnvelope, null, 2));

    const checksumsPath = join(trustDir, "checksums.json");
    const checksums = JSON.parse(readFileSync(checksumsPath, "utf8"));
    checksums.entries = (checksums.entries ?? []).map((entry) =>
      entry.path === "release-manifest.sig.json"
        ? {
            ...entry,
            sha256: sha256(readFileNormalized(signaturePath)),
          }
        : entry,
    );
    writeFileSync(checksumsPath, JSON.stringify(checksums, null, 2));

    assert.throws(
      () => verifyReleaseTrustBundle({ repoRoot: fixture.tempRoot, trustDir }),
      /release manifest signature is invalid/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("assessPackTrust refuses signed posture when pack metadata signature is missing", () => {
  const fixture = createTempRepo();
  try {
    mkdirSync(join(fixture.tempRoot, "trust"), { recursive: true });
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    writeFileSync(
      join(fixture.tempRoot, "trust", "first-party-keys.json"),
      JSON.stringify(
        {
          kind: "trust-keyring",
          schema_version: "1.0.0",
          publisher: "pairslash",
          keys: [
            {
              key_id: "test-release-key",
              status: "active",
              public_key_pem: publicKey.export({ format: "pem", type: "spki" }),
            },
          ],
        },
        null,
        2,
      ),
    );

    const manifestPath = join(
      fixture.tempRoot,
      "packs",
      "core",
      "pairslash-plan",
      "pack.manifest.yaml",
    );
    const manifest = loadPackManifest(manifestPath);
    const codexCompiled = compileCodexPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const copilotCompiled = compileCopilotPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const metadata = buildPackMetadataEnvelope({
      repoRoot: fixture.tempRoot,
      manifestPath,
      manifest,
      compiledPacks: [codexCompiled, copilotCompiled],
    });

    writeReleaseTrustBundle({
      repoRoot: fixture.tempRoot,
      releaseId: "0.4.0-missing-pack-signature",
      packArtifacts: [
        {
          pack_id: "pairslash-plan",
          metadata,
        },
      ],
      privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }),
      keyId: "test-release-key",
    });

    rmSync(
      join(
        fixture.tempRoot,
        "dist",
        "release-trust",
        "packs",
        "pairslash-plan",
        "pack-metadata.sig.json",
      ),
      { force: true },
    );
    const checksumsPath = join(fixture.tempRoot, "dist", "release-trust", "checksums.json");
    const checksums = JSON.parse(readFileSync(checksumsPath, "utf8"));
    checksums.entries = (checksums.entries ?? []).filter(
      (entry) => entry.path !== "packs/pairslash-plan/pack-metadata.sig.json",
    );
    writeFileSync(checksumsPath, JSON.stringify(checksums, null, 2));

    const trustReceipt = assessPackTrust({
      repoRoot: fixture.tempRoot,
      manifestPath,
      manifest,
      compiledPack: codexCompiled,
    });
    assert.equal(trustReceipt.verification_status, "local");
    assert.equal(trustReceipt.source_class, "local-source");
    assert.match(trustReceipt.reasons.join("; "), /pack-signature-missing:pairslash-plan/);
  } finally {
    fixture.cleanup();
  }
});

test("release trust verification fails when key id is not present in trusted keyring", () => {
  const fixture = createTempRepo();
  try {
    mkdirSync(join(fixture.tempRoot, "trust"), { recursive: true });
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    writeFileSync(
      join(fixture.tempRoot, "trust", "first-party-keys.json"),
      JSON.stringify(
        {
          kind: "trust-keyring",
          schema_version: "1.0.0",
          publisher: "pairslash",
          keys: [
            {
              key_id: "test-release-key",
              status: "active",
              public_key_pem: publicKey.export({ format: "pem", type: "spki" }),
            },
          ],
        },
        null,
        2,
      ),
    );

    const manifestPath = join(
      fixture.tempRoot,
      "packs",
      "core",
      "pairslash-plan",
      "pack.manifest.yaml",
    );
    const manifest = loadPackManifest(manifestPath);
    const codexCompiled = compileCodexPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const copilotCompiled = compileCopilotPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const metadata = buildPackMetadataEnvelope({
      repoRoot: fixture.tempRoot,
      manifestPath,
      manifest,
      compiledPacks: [codexCompiled, copilotCompiled],
    });

    writeReleaseTrustBundle({
      repoRoot: fixture.tempRoot,
      releaseId: "0.4.0-unknown-key",
      packArtifacts: [
        {
          pack_id: "pairslash-plan",
          metadata,
        },
      ],
      privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }),
      keyId: "unknown-release-key",
    });

    assert.throws(
      () => verifyReleaseTrustBundle({ repoRoot: fixture.tempRoot }),
      /missing public key unknown-release-key/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("release trust verification fails when checksum set drifts", () => {
  const fixture = createTempRepo();
  try {
    mkdirSync(join(fixture.tempRoot, "trust"), { recursive: true });
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    writeFileSync(
      join(fixture.tempRoot, "trust", "first-party-keys.json"),
      JSON.stringify(
        {
          kind: "trust-keyring",
          schema_version: "1.0.0",
          publisher: "pairslash",
          keys: [
            {
              key_id: "test-release-key",
              status: "active",
              public_key_pem: publicKey.export({ format: "pem", type: "spki" }),
            },
          ],
        },
        null,
        2,
      ),
    );

    const manifestPath = join(
      fixture.tempRoot,
      "packs",
      "core",
      "pairslash-plan",
      "pack.manifest.yaml",
    );
    const manifest = loadPackManifest(manifestPath);
    const codexCompiled = compileCodexPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const copilotCompiled = compileCopilotPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const metadata = buildPackMetadataEnvelope({
      repoRoot: fixture.tempRoot,
      manifestPath,
      manifest,
      compiledPacks: [codexCompiled, copilotCompiled],
    });

    writeReleaseTrustBundle({
      repoRoot: fixture.tempRoot,
      releaseId: "0.4.0-checksum-drift",
      packArtifacts: [
        {
          pack_id: "pairslash-plan",
          metadata,
        },
      ],
      privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }),
      keyId: "test-release-key",
    });

    const metadataPath = join(
      fixture.tempRoot,
      "dist",
      "release-trust",
      "packs",
      "pairslash-plan",
      "pack-metadata.json",
    );
    writeFileSync(metadataPath, `${readFileSync(metadataPath, "utf8")}\n`);

    assert.throws(
      () => verifyReleaseTrustBundle({ repoRoot: fixture.tempRoot }),
      /checksum digest mismatch/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("release trust verification fails when the signing key is revoked", () => {
  const fixture = createTempRepo();
  try {
    mkdirSync(join(fixture.tempRoot, "trust"), { recursive: true });
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    writeFileSync(
      join(fixture.tempRoot, "trust", "first-party-keys.json"),
      JSON.stringify(
        {
          kind: "trust-keyring",
          schema_version: "1.0.0",
          publisher: "pairslash",
          keys: [
            {
              key_id: "test-release-key",
              status: "revoked",
              public_key_pem: publicKey.export({ format: "pem", type: "spki" }),
            },
          ],
        },
        null,
        2,
      ),
    );

    const manifestPath = join(
      fixture.tempRoot,
      "packs",
      "core",
      "pairslash-plan",
      "pack.manifest.yaml",
    );
    const manifest = loadPackManifest(manifestPath);
    const codexCompiled = compileCodexPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const copilotCompiled = compileCopilotPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const metadata = buildPackMetadataEnvelope({
      repoRoot: fixture.tempRoot,
      manifestPath,
      manifest,
      compiledPacks: [codexCompiled, copilotCompiled],
    });

    writeReleaseTrustBundle({
      repoRoot: fixture.tempRoot,
      releaseId: "0.4.0-revoked-key",
      packArtifacts: [
        {
          pack_id: "pairslash-plan",
          metadata,
        },
      ],
      privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }),
      keyId: "test-release-key",
    });

    assert.throws(
      () => verifyReleaseTrustBundle({ repoRoot: fixture.tempRoot }),
      /missing public key test-release-key/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("unauthorized core-maintained claim is denied by central pack authority", () => {
  const fixture = createTempRepo({ packs: ["pairslash-backend"] });
  try {
    const manifestPath = updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-backend",
      mutate(manifest) {
        manifest.support.tier_claim = "core-maintained";
        manifest.support.support_level_claim = "core-supported";
        return manifest;
      },
    });
    const manifest = loadPackManifest(manifestPath);
    const compiledPack = compileCodexPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const trustReceipt = assessPackTrust({
      repoRoot: fixture.tempRoot,
      manifestPath,
      manifest,
      compiledPack,
    });
    assert.equal(trustReceipt.policy_action, "deny");
    assert.match(
      trustReceipt.reasons.join("; "),
      /trust-authority:core-maintained-not-authorized:pairslash-backend/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("unauthorized high-risk capability claim is denied by central pack authority", () => {
  const fixture = createTempRepo({ packs: ["pairslash-backend"] });
  try {
    const manifestPath = updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-backend",
      mutate(manifest) {
        manifest.capabilities = [...new Set([...(manifest.capabilities ?? []), "mcp_client"])];
        return manifest;
      },
    });
    const manifest = loadPackManifest(manifestPath);
    const compiledPack = compileCodexPack({
      repoRoot: fixture.tempRoot,
      manifestPath,
    });
    const trustReceipt = assessPackTrust({
      repoRoot: fixture.tempRoot,
      manifestPath,
      manifest,
      compiledPack,
    });
    assert.equal(trustReceipt.policy_action, "deny");
    assert.match(
      trustReceipt.reasons.join("; "),
      /trust-authority:capability-not-authorized:pairslash-backend:mcp_client/,
    );
  } finally {
    fixture.cleanup();
  }
});
