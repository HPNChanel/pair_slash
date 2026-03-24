import { join, resolve } from "node:path";

import {
  COMPILED_PACK_FILE,
  COMPILED_PACK_SCHEMA_VERSION,
  NORMALIZED_IR_FILE,
  OWNERSHIP_FILE,
  PHASE4_COMPILER_VERSION,
} from "./constants.js";
import { buildNormalizedIr, stripNormalizedIrContent } from "./ir.js";
import { ensureDir, sha256, stableJson, writeTextFile } from "./utils.js";
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
      sha256: asset.sha256 ?? sha256(asset.content),
      size: asset.size ?? Buffer.byteLength(asset.content),
    }))
    .sort((left, right) => left.relative_path.localeCompare(right.relative_path));
}

function buildOwnershipMetadata({
  ir,
  runtime,
  directInvocation,
  emittedAssets,
}) {
  return {
    kind: "pairslash-owned-footprint",
    schema_version: "1.0.0",
    compiler_version: PHASE4_COMPILER_VERSION,
    manifest_digest: ir.manifest_digest,
    pack_id: ir.pack.id,
    version: ir.pack.version,
    runtime,
    canonical_entrypoint: ir.pack.canonical_entrypoint,
    direct_invocation: directInvocation,
    ownership_scope: ir.policy.ownership.ownership_scope,
    ownership_file: ir.policy.ownership.ownership_file,
    files: emittedAssets.map((file) => ({
      relative_path: file.relative_path,
      sha256: file.sha256,
      generated: file.generated,
      asset_kind: file.asset_kind,
      install_surface: file.install_surface,
      runtime_selector: file.runtime_selector,
      override_eligible: file.override_eligible,
      override_strategy: file.override_eligible ? "preserve" : "managed_replace",
      write_authority_guarded: file.write_authority_guarded,
      owned_by_pairslash: true,
    })),
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
  const ownershipMetadata = stableJson(
    buildOwnershipMetadata({
      ir,
      runtime,
      directInvocation: runtimeTarget.direct_invocation,
      emittedAssets: files,
    }),
  );
  const ownershipFile = {
    relative_path: OWNERSHIP_FILE,
    sha256: sha256(ownershipMetadata),
    size: Buffer.byteLength(ownershipMetadata),
    generated: true,
    override_eligible: false,
    write_authority_guarded: ir.pack.workflow_class === "write-authority",
    asset_kind: "ownership_manifest",
    install_surface: "metadata",
    runtime_selector: "shared",
    content: ownershipMetadata,
  };
  const compiledFiles = [...files, ownershipFile].sort((left, right) =>
    left.relative_path.localeCompare(right.relative_path),
  );
  const digestInput = compiledFiles
    .map((file) => `${file.relative_path}:${file.sha256}:${file.asset_kind}:${file.install_surface}`)
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
