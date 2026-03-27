import {
  NORMALIZED_IR_SCHEMA_VERSION,
  PHASE4_COMPILER_VERSION,
} from "./constants.js";
import { getPackId, loadPackManifest, resolvePackDir } from "./manifest.js";
import { buildLogicalAssetsFromManifest } from "./runtime-asset-ir.js";
import { readFileNormalized, relativeFrom, sha256, summarizeCounts } from "./utils.js";
import { validateNormalizedIr } from "./validate.js";

function buildRuntimeSupport(manifest) {
  return Object.fromEntries(
    Object.entries(manifest.runtime_bindings).map(([runtime, binding]) => [
      runtime,
      {
        semver_range: manifest.supported_runtime_ranges[runtime],
        direct_invocation: binding.direct_invocation,
        metadata_mode: binding.metadata_mode,
        skill_directory_name: binding.install_dir_name,
        compatibility: binding.compatibility,
      },
    ]),
  );
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
  const logicalAssets = buildLogicalAssetsFromManifest({
    manifest,
    sourceDir,
  });

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
      asset_ownership: manifest.asset_ownership,
      local_override_policy: manifest.local_override_policy,
      update_strategy: manifest.update_strategy,
      uninstall_strategy: manifest.uninstall_strategy,
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
