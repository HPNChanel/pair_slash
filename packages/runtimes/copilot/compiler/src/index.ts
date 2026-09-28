import * as runtimeAdapter from "@pairslash/runtime-copilot-adapter";
import {
  buildNormalizedIr,
  buildPluginManifest,
  buildPluginProvenance,
  compilePack,
  COPILOT_PLUGIN_MANIFEST_NAME,
  enrichSkillFrontmatter,
  materializeCompiledFile,
  PLUGIN_PROVENANCE_FILENAME,
  PLUGIN_SKILLS_DIR,
  stableJson,
} from "@pairslash/spec-core";

import { copilotGenerators } from "./generators.ts";

type NormalizedIr = ReturnType<typeof buildNormalizedIr>;
type CompileOptions = {
  repoRoot: string;
  manifestPath: string;
  distRoot?: string;
  write?: boolean;
};
type LogicalAsset = {
  runtime_selector: string;
  generator: string;
  install_surface: string;
  source_relpath?: string | null;
  content?: string;
};

function emitCopilotBundle({ ir }: { ir: NormalizedIr }) {
  return ir.logical_assets
    .filter(
      (asset: LogicalAsset) =>
        asset.runtime_selector === "shared" || asset.runtime_selector === "copilot_cli",
    )
    .filter((asset: LogicalAsset) => asset.generator !== "pairslash_ownership_receipt")
    .map((asset: LogicalAsset) => {
      if (!runtimeAdapter.supportsInstallSurface(asset.install_surface)) {
        throw new Error(
          `copilot emitter does not support install surface ${asset.install_surface}`,
        );
      }

      const relativePath = runtimeAdapter.resolveRuntimeAssetPath(asset);
      if (asset.generator === "source_copy") {
        const content =
          asset.source_relpath === "SKILL.md"
            ? enrichSkillFrontmatter({ content: asset.content, ir })
            : asset.content;
        return materializeCompiledFile({
          logicalAsset: asset,
          relativePath,
          content,
        });
      }

      const render = copilotGenerators[asset.generator as keyof typeof copilotGenerators];
      if (typeof render !== "function") {
        throw new Error(`copilot emitter does not support generator ${asset.generator}`);
      }
      return materializeCompiledFile({
        logicalAsset: asset,
        relativePath,
        content: render(ir),
      });
    });
}

const PLUGIN_WRAPPER_ASSET_BASE = {
  generator: "copilot_plugin_manifest",
  required: true,
  owner: "pairslash",
  uninstall_behavior: "remove_if_unmodified",
  generated: true,
  override_eligible: false,
  write_authority_guarded: false,
  asset_kind: "runtime_manifest",
  install_surface: "metadata",
  runtime_selector: "copilot_cli",
} as const;

function emitCopilotPluginBundle({ ir }: { ir: NormalizedIr }) {
  const skillRoot = `${PLUGIN_SKILLS_DIR}/${ir.pack.id}`;
  const skillFiles = emitCopilotBundle({ ir }).map((file) => ({
    ...file,
    relative_path: `${skillRoot}/${file.relative_path}`,
  }));
  const manifestShape = {
    pack_name: ir.pack.id,
    pack_version: ir.pack.version,
    summary: ir.pack.summary,
    category: ir.pack.category,
    display_name: ir.pack.display_name,
  };
  const manifestFile = materializeCompiledFile({
    logicalAsset: { ...PLUGIN_WRAPPER_ASSET_BASE, asset_id: "plugin-manifest" },
    relativePath: COPILOT_PLUGIN_MANIFEST_NAME,
    content: stableJson(
      buildPluginManifest({ manifest: manifestShape, runtime: "copilot_cli" }),
    ),
  });
  const provenanceFile = materializeCompiledFile({
    logicalAsset: {
      ...PLUGIN_WRAPPER_ASSET_BASE,
      generator: "pairslash_plugin_provenance",
      asset_id: "plugin-provenance",
    },
    relativePath: PLUGIN_PROVENANCE_FILENAME,
    content: stableJson(
      buildPluginProvenance({
        manifest: manifestShape,
        runtime: "copilot_cli",
        manifestDigest: ir.manifest_digest,
      }),
    ),
  });
  return [...skillFiles, manifestFile, provenanceFile];
}

export function compileCopilotPack(options: CompileOptions & { emitMode?: string }) {
  const { emitMode = "skill", ...rest } = options;
  if (!["skill", "plugin"].includes(emitMode)) {
    throw new Error(`unsupported emit mode: ${emitMode}`);
  }
  return compilePack({
    ...rest,
    runtime: "copilot_cli",
    runtimeAdapter,
    emitBundle: emitMode === "plugin" ? emitCopilotPluginBundle : emitCopilotBundle,
  } as Parameters<typeof compilePack>[0]);
}

export { emitCopilotBundle, emitCopilotPluginBundle, runtimeAdapter };
