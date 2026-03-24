import { join } from "node:path";

import {
  LOGICAL_ASSET_KINDS,
  NORMALIZED_IR_SCHEMA_VERSION,
  PHASE4_COMPILER_VERSION,
  RUNTIME_SELECTORS,
} from "./constants.js";
import { getPackId, loadPackManifest, resolvePackDir } from "./manifest.js";
import { readFileNormalized, relativeFrom, sha256, summarizeCounts } from "./utils.js";
import { validateNormalizedIr } from "./validate.js";

function classifySourceAsset(relativePath, primarySkillFile) {
  return relativePath === primarySkillFile ? "skill_markdown" : "support_doc";
}

function classifyInstallSurface(relativePath, primarySkillFile) {
  return relativePath === primarySkillFile ? "canonical_skill" : "support_doc";
}

function buildRuntimeSupport(manifest) {
  return Object.fromEntries(
    Object.entries(manifest.runtime_targets).map(([runtime, target]) => [
      runtime,
      {
        semver_range: manifest.supported_runtime_ranges[runtime],
        direct_invocation: target.direct_invocation,
        metadata_mode: target.metadata_mode,
        skill_directory_name: target.skill_directory_name,
        compatibility: target.compatibility,
      },
    ]),
  );
}

function buildSourceLogicalAsset({
  sourceDir,
  relativePath,
  primarySkillFile,
  overrideFiles,
  workflowClass,
}) {
  const absolutePath = join(sourceDir, relativePath);
  const content = readFileNormalized(absolutePath);
  const assetKind = classifySourceAsset(relativePath, primarySkillFile);
  const installSurface = classifyInstallSurface(relativePath, primarySkillFile);
  return {
    logical_id: `source:${relativePath}`,
    asset_kind: assetKind,
    source_relpath: relativePath,
    install_surface: installSurface,
    runtime_selector: "shared",
    content_type: relativePath.endsWith(".yaml") || relativePath.endsWith(".yml") ? "text/yaml" : "text/markdown",
    generated: false,
    override_eligible: overrideFiles.has(relativePath),
    write_authority_guarded: workflowClass === "write-authority",
    stable_sort_key: `${installSurface}:${relativePath}`,
    sha256: sha256(content),
    size: Buffer.byteLength(content),
    content,
  };
}

function stripLogicalAssetContent(asset) {
  const { content, ...rest } = asset;
  return rest;
}

export function stripNormalizedIrContent(ir) {
  return {
    ...ir,
    logical_assets: ir.logical_assets.map(stripLogicalAssetContent),
  };
}

export function buildNormalizedIr({ repoRoot, manifestPath }) {
  const manifest = loadPackManifest(manifestPath);
  const sourceDir = resolvePackDir(repoRoot, manifest);
  const overrideFiles = new Set(manifest.local_override_policy.eligible_paths);
  const logicalAssets = manifest.assets.include.map((relativePath) =>
    buildSourceLogicalAsset({
      sourceDir,
      relativePath,
      primarySkillFile: manifest.assets.primary_skill_file,
      overrideFiles,
      workflowClass: manifest.pack.workflow_class,
    }),
  );

  const ir = {
    kind: "normalized-pack-ir",
    schema_version: NORMALIZED_IR_SCHEMA_VERSION,
    compiler_version: PHASE4_COMPILER_VERSION,
    manifest_relpath: relativeFrom(repoRoot, manifestPath),
    manifest_digest: sha256(readFileNormalized(manifestPath)),
    pack: {
      id: getPackId(manifest),
      version: manifest.version,
      display_name: manifest.pack.display_name,
      summary: manifest.pack.summary,
      category: manifest.pack.category,
      workflow_class: manifest.pack.workflow_class,
      phase: manifest.pack.phase,
      status: manifest.pack.status,
      canonical_entrypoint: manifest.pack.canonical_entrypoint,
      release_channel: manifest.release_channel,
      risk_level: manifest.risk_level,
    },
    policy: {
      install_targets: manifest.install_targets,
      capabilities: manifest.capabilities,
      required_tools: manifest.required_tools,
      required_mcp_servers: manifest.required_mcp_servers,
      memory_permissions: manifest.memory_permissions,
      ownership: manifest.ownership,
      local_override_policy: manifest.local_override_policy,
    },
    runtime_support: buildRuntimeSupport(manifest),
    logical_assets: logicalAssets,
    asset_summary: {
      total_assets: logicalAssets.length,
      by_kind: summarizeCounts(logicalAssets, "asset_kind"),
      by_runtime: summarizeCounts(logicalAssets, "runtime_selector"),
    },
  };

  const errors = validateNormalizedIr(ir);
  if (errors.length > 0) {
    throw new Error(`invalid normalized ir for ${getPackId(manifest)} :: ${errors.join("; ")}`);
  }
  return ir;
}

export function createGeneratedLogicalAsset({
  logicalId,
  assetKind,
  runtimeSelector,
  installSurface,
  fileName,
  content,
  overrideEligible = false,
  writeAuthorityGuarded = false,
  contentType = "text/plain",
}) {
  if (!LOGICAL_ASSET_KINDS.includes(assetKind)) {
    throw new Error(`unsupported asset kind ${assetKind}`);
  }
  if (!RUNTIME_SELECTORS.includes(runtimeSelector)) {
    throw new Error(`unsupported runtime selector ${runtimeSelector}`);
  }
  return {
    logical_id: logicalId,
    asset_kind: assetKind,
    source_relpath: null,
    install_surface: installSurface,
    runtime_selector: runtimeSelector,
    file_name: fileName,
    content_type: contentType,
    generated: true,
    override_eligible: overrideEligible,
    write_authority_guarded: writeAuthorityGuarded,
    stable_sort_key: `${installSurface}:${fileName}`,
    sha256: sha256(content),
    size: Buffer.byteLength(content),
    content,
  };
}
