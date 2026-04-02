import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { compileCodexPack } from "@pairslash/compiler-codex";
import { compileCopilotPack } from "@pairslash/compiler-copilot";
import {
  buildPackMetadataEnvelope,
  loadPackManifestRecords,
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
  const records = loadPackManifestRecords(repoRoot)
    .filter((record) => record.isValid)
    .sort((left, right) => left.packId.localeCompare(right.packId));
  if (requestedPacks.length === 0) {
    return records;
  }
  const byId = new Map(records.map((record) => [record.packId, record]));
  return requestedPacks.map((packId) => {
    const record = byId.get(packId);
    if (!record) {
      throw new Error(`pack-not-found:${packId}`);
    }
    return record;
  });
}

function compileAllRuntimes({ repoRoot, manifestPath }) {
  return [
    compileCodexPack({ repoRoot, manifestPath }),
    compileCopilotPack({ repoRoot, manifestPath }),
  ];
}

const options = parseArgs(process.argv.slice(2));
if (Boolean(options.privateKeyFile) !== Boolean(options.keyId)) {
  throw new Error("provide both --private-key-file and --key-id, or neither");
}

const releaseId = options.releaseId ?? detectReleaseId(options.repoRoot);
const sourceCommit = options.sourceCommit ?? detectSourceCommit(options.repoRoot);
const selectedRecords = selectManifestRecords(options.repoRoot, options.packs);
const privateKeyPem = options.privateKeyFile ? readFileSync(options.privateKeyFile, "utf8") : null;

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
  privateKeyPem,
  keyId: options.keyId,
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
