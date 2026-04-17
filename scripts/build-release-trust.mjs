import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { compileCodexPack } from "@pairslash/compiler-codex";
import { compileCopilotPack } from "@pairslash/compiler-copilot";
import {
  buildPackMetadataEnvelope,
  loadPackCatalogRecords,
  loadPackManifest,
  stableJson,
  writeReleaseTrustBundle,
} from "@pairslash/spec-core";

function parseArgs(argv) {
  const options = {
    repoRoot: process.cwd(),
    releaseId: null,
    outDir: null,
    packs: [],
    publisher: "pairslash",
    privateKeyFile: null,
    keyId: null,
    sourceCommit: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--repo-root") {
      options.repoRoot = resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--release-id") {
      options.releaseId = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--out") {
      options.outDir = resolve(options.repoRoot, argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--packs") {
      options.packs = argv[index + 1]
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }
    if (token === "--publisher") {
      options.publisher = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--private-key-file") {
      options.privateKeyFile = resolve(options.repoRoot, argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--key-id") {
      options.keyId = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--source-commit") {
      options.sourceCommit = argv[index + 1];
      index += 1;
    }
  }
  return options;
}

function loadSigningOptions({ repoRoot, privateKeyFile, keyId }) {
  const envPrivateKey = process.env.PAIRSLASH_RELEASE_TRUST_PRIVATE_KEY ?? null;
  const envKeyId = process.env.PAIRSLASH_RELEASE_TRUST_KEY_ID ?? null;
  const privateKeyPem = privateKeyFile
    ? readFileSync(privateKeyFile, "utf8")
    : envPrivateKey;
  const resolvedKeyId = keyId ?? envKeyId;
  if (Boolean(privateKeyPem) !== Boolean(resolvedKeyId)) {
    throw new Error("provide both signing key and key id, or neither");
  }
  return {
    privateKeyPem,
    keyId: resolvedKeyId,
  };
}

function detectSourceCommit(repoRoot) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim() || null;
}

function detectReleaseId(repoRoot) {
  const pkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
  return pkg.version;
}

function selectManifestRecords(repoRoot, requestedPacks) {
  const records = loadPackCatalogRecords(repoRoot, { includeAdvanced: false })
    .filter((record) => record.catalog_scope === "core")
    .sort((left, right) => left.id.localeCompare(right.id));
  if (requestedPacks.length === 0) {
    return records.map((record) => ({
      packId: record.id,
      manifestPath: resolve(repoRoot, record.pack_manifest),
      manifest: loadPackManifest(resolve(repoRoot, record.pack_manifest)),
    }));
  }
  const byId = new Map(records.map((record) => [record.id, record]));
  return requestedPacks.map((packId) => {
    const record = byId.get(packId);
    if (!record) {
      throw new Error(`pack-not-found:${packId}`);
    }
    const manifestPath = resolve(repoRoot, record.pack_manifest);
    return {
      packId: record.id,
      manifestPath,
      manifest: loadPackManifest(manifestPath),
    };
  });
}

function compileAllRuntimes({ repoRoot, manifestPath }) {
  return [
    compileCodexPack({ repoRoot, manifestPath }),
    compileCopilotPack({ repoRoot, manifestPath }),
  ];
}

const options = parseArgs(process.argv.slice(2));
const signingOptions = loadSigningOptions({
  repoRoot: options.repoRoot,
  privateKeyFile: options.privateKeyFile,
  keyId: options.keyId,
});

const releaseId = options.releaseId ?? detectReleaseId(options.repoRoot);
const sourceCommit = options.sourceCommit ?? detectSourceCommit(options.repoRoot);
const selectedRecords = selectManifestRecords(options.repoRoot, options.packs);

const packArtifacts = selectedRecords.map((record) => {
  const compiledPacks = compileAllRuntimes({
      repoRoot: options.repoRoot,
      manifestPath: record.manifestPath,
    });
  return {
    pack_id: record.packId,
    metadata: buildPackMetadataEnvelope({
      repoRoot: options.repoRoot,
      manifestPath: record.manifestPath,
      manifest: record.manifest,
      compiledPacks,
      publisher: options.publisher,
    }),
  };
});

const bundle = writeReleaseTrustBundle({
  repoRoot: options.repoRoot,
  releaseId,
  packArtifacts,
  publisher: options.publisher,
  privateKeyPem: signingOptions.privateKeyPem,
  keyId: signingOptions.keyId,
  outDir: options.outDir ?? resolve(options.repoRoot, "dist", "release-trust"),
  sourceCommit,
});

process.stdout.write(
  stableJson({
    kind: "release-trust-build-result",
    release_id: releaseId,
    signed: bundle.signed,
    trust_dir: bundle.trust_dir,
    pack_count: packArtifacts.length,
  }),
);
