import { basename, extname, join } from "node:path";

import { readFileNormalized, sha256, stableJson, toPosix } from "./utils.js";

function detectContentType(relativePath) {
  const extension = extname(relativePath ?? "").toLowerCase();
  switch (extension) {
    case ".json":
      return "application/json";
    case ".md":
      return "text/markdown";
    case ".yaml":
    case ".yml":
      return "text/yaml";
    default:
      return "text/plain";
  }
}

function buildGeneratedSignature({ entry, ownershipRecord, writeAuthorityGuarded }) {
  return stableJson({
    asset_id: entry.asset_id,
    runtime: entry.runtime,
    asset_kind: entry.asset_kind,
    install_surface: entry.install_surface,
    generated_path: entry.generated_path,
    generator: entry.generator,
    required: entry.required,
    override_eligible: entry.override_eligible,
    owner: ownershipRecord.owner,
    uninstall_behavior: ownershipRecord.uninstall_behavior,
    write_authority_guarded: writeAuthorityGuarded,
  });
}

function buildSourceLogicalAsset({
  sourceDir,
  entry,
  ownershipRecord,
  writeAuthorityGuarded,
}) {
  const absolutePath = join(sourceDir, entry.source_path);
  const content = readFileNormalized(absolutePath);
  return {
    logical_id: entry.asset_id,
    asset_id: entry.asset_id,
    generator: entry.generator,
    required: entry.required,
    asset_kind: entry.asset_kind,
    install_surface: entry.install_surface,
    runtime_selector: entry.runtime,
    source_relpath: entry.source_path,
    generated_relpath: null,
    file_name: basename(entry.source_path),
    content_type: detectContentType(entry.source_path),
    generated: false,
    override_eligible: entry.override_eligible,
    owner: ownershipRecord.owner,
    uninstall_behavior: ownershipRecord.uninstall_behavior,
    write_authority_guarded: writeAuthorityGuarded,
    stable_sort_key: `${entry.runtime}:${entry.asset_id}:${entry.source_path}`,
    sha256: sha256(content),
    size: Buffer.byteLength(content),
    content,
  };
}

function buildGeneratedLogicalAsset({
  entry,
  ownershipRecord,
  writeAuthorityGuarded,
}) {
  const signature = buildGeneratedSignature({
    entry,
    ownershipRecord,
    writeAuthorityGuarded,
  });
  return {
    logical_id: entry.asset_id,
    asset_id: entry.asset_id,
    generator: entry.generator,
    required: entry.required,
    asset_kind: entry.asset_kind,
    install_surface: entry.install_surface,
    runtime_selector: entry.runtime,
    source_relpath: null,
    generated_relpath: toPosix(entry.generated_path),
    file_name: basename(entry.generated_path),
    content_type: detectContentType(entry.generated_path),
    generated: true,
    override_eligible: entry.override_eligible,
    owner: ownershipRecord.owner,
    uninstall_behavior: ownershipRecord.uninstall_behavior,
    write_authority_guarded: writeAuthorityGuarded,
    stable_sort_key: `${entry.runtime}:${entry.asset_id}:${entry.generated_path}`,
    sha256: sha256(signature),
    size: Buffer.byteLength(signature),
  };
}

export function buildLogicalAssetsFromManifest({ manifest, sourceDir }) {
  const ownershipById = new Map(
    manifest.asset_ownership.records.map((record) => [record.asset_id, record]),
  );
  const writeAuthorityGuarded = manifest.workflow_class === "write-authority";

  return manifest.runtime_assets.entries
    .slice()
    .sort((left, right) => left.asset_id.localeCompare(right.asset_id))
    .map((entry) => {
      const ownershipRecord = ownershipById.get(entry.asset_id);
      if (!ownershipRecord) {
        throw new Error(`missing ownership metadata for asset ${entry.asset_id}`);
      }
      return entry.source_path
        ? buildSourceLogicalAsset({
            sourceDir,
            entry,
            ownershipRecord,
            writeAuthorityGuarded,
          })
        : buildGeneratedLogicalAsset({
            entry,
            ownershipRecord,
            writeAuthorityGuarded,
          });
    });
}
