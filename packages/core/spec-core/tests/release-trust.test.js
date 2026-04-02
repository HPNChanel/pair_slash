import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { compileCodexPack } from "@pairslash/compiler-codex";
import { compileCopilotPack } from "@pairslash/compiler-copilot";
import {
  assessPackTrust,
  buildPackMetadataEnvelope,
  loadPackManifest,
  verifyReleaseTrustBundle,
  writeReleaseTrustBundle,
} from "@pairslash/spec-core";

import { createTempRepo } from "../../../../tests/phase4-helpers.js";

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
