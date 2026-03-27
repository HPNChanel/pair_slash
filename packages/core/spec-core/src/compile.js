import { join, resolve } from "node:path";

import {
  COMPILED_PACK_FILE,
  COMPILED_PACK_SCHEMA_VERSION,
  NORMALIZED_IR_FILE,
  PHASE4_COMPILER_VERSION,
} from "./constants.js";
import { buildNormalizedIr, stripNormalizedIrContent } from "./ir.js";
import { buildOwnershipReceipt } from "./ownership-receipt.js";
import { ensureDir, sha256, stableJson, toPosix, writeTextFile } from "./utils.js";
import { validateCompiledPack } from "./validate.js";

function stripCompiledFileContent(file) {
  const { content, ...rest } = file;
  return rest;
}

export function stripCompiledContent(compiledPack) {
  return {
    ...compiledPack,
    files: compiledPack.files.map(stripCompiledFileContent),
  };
}

function assertUniqueRelativePaths(emittedAssets) {
  const seen = new Set();
  for (const asset of emittedAssets) {
    if (seen.has(asset.relative_path)) {
      throw new Error(`duplicate emitted asset path ${asset.relative_path}`);
    }
    seen.add(asset.relative_path);
  }
}

function normalizeEmittedAssets(emittedAssets) {
  assertUniqueRelativePaths(emittedAssets);
  return emittedAssets
    .map((asset) => ({
      ...asset,
      relative_path: toPosix(asset.relative_path),
      sha256: asset.sha256 ?? sha256(asset.content),
      size: asset.size ?? Buffer.byteLength(asset.content),
    }))
    .sort((left, right) => left.relative_path.localeCompare(right.relative_path));
}

function getOwnershipReceiptAsset(ir) {
  const receiptAsset =
    ir.logical_assets.find((asset) => asset.asset_id === "ownership-receipt") ?? null;
  if (!receiptAsset) {
    throw new Error(`normalized ir ${ir.pack.id} is missing ownership-receipt asset`);
  }
  return receiptAsset;
}

export function materializeCompiledFile({
  logicalAsset,
  relativePath,
  content,
}) {
  const normalizedPath = toPosix(relativePath);
  return {
    asset_id: logicalAsset.asset_id,
    generator: logicalAsset.generator,
    required: logicalAsset.required,
    owner: logicalAsset.owner,
    uninstall_behavior: logicalAsset.uninstall_behavior,
    relative_path: normalizedPath,
    sha256: sha256(content),
    size: Buffer.byteLength(content),
    generated: logicalAsset.generated,
    override_eligible: logicalAsset.override_eligible,
    write_authority_guarded: logicalAsset.write_authority_guarded,
    asset_kind: logicalAsset.asset_kind,
    install_surface: logicalAsset.install_surface,
    runtime_selector: logicalAsset.runtime_selector,
    content,
  };
}

export function finalizeCompiledPack({
  repoRoot,
  ir,
  runtime,
  runtimeAdapter,
  emittedAssets,
  write = false,
  distRoot = resolve(repoRoot, "dist", "compiled"),
}) {
  const runtimeTarget = ir.runtime_support[runtime];
  if (!runtimeTarget) {
    throw new Error(`normalized ir ${ir.pack.id} does not support runtime ${runtime}`);
  }

  const files = normalizeEmittedAssets(emittedAssets);
  const ownershipFile = materializeCompiledFile({
    logicalAsset: getOwnershipReceiptAsset(ir),
    relativePath: ir.policy.asset_ownership.ownership_file,
    content: buildOwnershipReceipt({
      ir,
      runtime,
      directInvocation: runtimeTarget.direct_invocation,
      emittedAssets: files,
    }),
  });
  const compiledFiles = [...files, ownershipFile].sort((left, right) =>
    left.relative_path.localeCompare(right.relative_path),
  );
  const digestInput = compiledFiles
    .map(
      (file) =>
        `${file.asset_id}:${file.relative_path}:${file.sha256}:${file.generator}:${file.owner}:${file.uninstall_behavior}`,
    )
    .join("\n");
  const outputDir = join(distRoot, runtimeAdapter.shortName, ir.pack.id);
  const normalizedIrStripped = stripNormalizedIrContent(ir);
  const compiledPack = {
    kind: "compiled-pack",
    schema_version: COMPILED_PACK_SCHEMA_VERSION,
    compiler_version: PHASE4_COMPILER_VERSION,
    manifest_digest: ir.manifest_digest,
    normalized_ir_digest: sha256(stableJson(normalizedIrStripped)),
    runtime,
    runtime_short_name: runtimeAdapter.shortName,
    bundle_kind: runtimeAdapter.bundleKind,
    pack_id: ir.pack.id,
    version: ir.pack.version,
    canonical_entrypoint: ir.pack.canonical_entrypoint,
    direct_invocation: runtimeTarget.direct_invocation,
    output_dir: outputDir,
    digest: sha256(digestInput),
    normalized_ir: normalizedIrStripped,
    files: compiledFiles,
  };
  const errors = validateCompiledPack(compiledPack);
  if (errors.length > 0) {
    throw new Error(`compiled pack ${ir.pack.id}/${runtime} invalid :: ${errors.join("; ")}`);
  }
  if (write) {
    writeCompiledPack(compiledPack);
  }
  return compiledPack;
}

export function compilePack({
  repoRoot,
  manifestPath,
  runtime,
  runtimeAdapter,
  emitBundle,
  write = false,
  distRoot,
}) {
  if (typeof emitBundle !== "function") {
    throw new Error("compilePack requires emitBundle");
  }
  const ir = buildNormalizedIr({ repoRoot, manifestPath });
  const emittedAssets = emitBundle({ ir, runtimeAdapter });
  return finalizeCompiledPack({
    repoRoot,
    ir,
    runtime,
    runtimeAdapter,
    emittedAssets,
    write,
    distRoot,
  });
}

export function writeCompiledPack(compiledPack) {
  ensureDir(compiledPack.output_dir);
  for (const file of compiledPack.files) {
    writeTextFile(join(compiledPack.output_dir, file.relative_path), file.content);
  }
  writeTextFile(
    join(compiledPack.output_dir, COMPILED_PACK_FILE),
    stableJson(stripCompiledContent(compiledPack)),
  );
  writeTextFile(
    join(compiledPack.output_dir, NORMALIZED_IR_FILE),
    stableJson(compiledPack.normalized_ir),
  );
  return compiledPack.output_dir;
}
