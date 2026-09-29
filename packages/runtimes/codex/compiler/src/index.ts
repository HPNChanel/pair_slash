import * as runtimeAdapter from "@pairslash/runtime-codex-adapter";
import {
  buildNormalizedIr,
  buildPluginManifest,
  buildPluginProvenance,
  compilePack,
  CODEX_PLUGIN_MANIFEST_RELPATH,
  enrichSkillFrontmatter,
  materializeCompiledFile,
  PLUGIN_HOOKS_CONFIG_RELPATH,
  PLUGIN_PREFLIGHT_SCRIPT_RELPATH,
  PLUGIN_PROVENANCE_FILENAME,
  PLUGIN_SKILLS_DIR,
  renderPluginHooksConfig,
  renderPreflightScript,
  stableJson,
} from "@pairslash/spec-core";

import { codexGenerators } from "./generators.ts";

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

function emitCodexBundle({ ir }: { ir: NormalizedIr }) {
  return ir.logical_assets
    .filter(
      (asset: LogicalAsset) =>
        asset.runtime_selector === "shared" || asset.runtime_selector === "codex_cli",
    )
    .filter((asset: LogicalAsset) => asset.generator !== "pairslash_ownership_receipt")
    .map((asset: LogicalAsset) => {
      if (!runtimeAdapter.supportsInstallSurface(asset.install_surface)) {
        throw new Error(
          `codex emitter does not support install surface ${asset.install_surface}`,
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

      const render = codexGenerators[asset.generator as keyof typeof codexGenerators];
      if (typeof render !== "function") {
        throw new Error(`codex emitter does not support generator ${asset.generator}`);
      }
      return materializeCompiledFile({
        logicalAsset: asset,
        relativePath,
        content: render(ir),
      });
    });
}

const PLUGIN_WRAPPER_ASSET_BASE = {
  generator: "codex_plugin_manifest",
  required: true,
  owner: "pairslash",
  uninstall_behavior: "remove_if_unmodified",
  generated: true,
  override_eligible: false,
  write_authority_guarded: false,
  asset_kind: "runtime_manifest",
  install_surface: "metadata",
  runtime_selector: "codex_cli",
} as const;

function emitCodexPluginBundle({ ir }: { ir: NormalizedIr }) {
  const skillRoot = `${PLUGIN_SKILLS_DIR}/${ir.pack.id}`;
  const skillFiles = emitCodexBundle({ ir }).map((file: any) => ({
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
    relativePath: CODEX_PLUGIN_MANIFEST_RELPATH,
    content: stableJson(
      buildPluginManifest({ manifest: manifestShape, runtime: "codex_cli" }),
    ),
  });
  // Plugin hook wiring (T4-01): emitted only when the resolved preflight hooks
  // are enabled and at least one canonical event has an advisory channel on
  // Codex. Codex loads hooks/hooks.json from the plugin directory by
  // convention; no manifest pointer exists in the Codex plugin.json shape.
  const hooksConfig =
    ir.hooks?.preflight?.emit === true
      ? renderPluginHooksConfig({ ir, runtime: "codex_cli" })
      : null;
  const hookFiles = hooksConfig
    ? [
        materializeCompiledFile({
          logicalAsset: {
            ...PLUGIN_WRAPPER_ASSET_BASE,
            generator: "codex_plugin_hooks",
            asset_id: "plugin-hooks-config",
            asset_kind: "hook_script",
          },
          relativePath: PLUGIN_HOOKS_CONFIG_RELPATH,
          content: hooksConfig,
        }),
        materializeCompiledFile({
          logicalAsset: {
            ...PLUGIN_WRAPPER_ASSET_BASE,
            generator: "codex_plugin_hooks",
            asset_id: "plugin-preflight-script",
            asset_kind: "hook_script",
          },
          relativePath: PLUGIN_PREFLIGHT_SCRIPT_RELPATH,
          content: renderPreflightScript({ ir, runtime: "codex_cli" }),
        }),
      ]
    : [];
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
        runtime: "codex_cli",
        manifestDigest: ir.manifest_digest,
        hooks: hooksConfig
          ? {
              advisory_only: true,
              config_relpath: PLUGIN_HOOKS_CONFIG_RELPATH,
              script_relpath: PLUGIN_PREFLIGHT_SCRIPT_RELPATH,
            }
          : null,
      }),
    ),
  });
  return [...skillFiles, manifestFile, ...hookFiles, provenanceFile];
}

export function compileCodexPack(options: CompileOptions & { emitMode?: string }) {
  const { emitMode = "skill", ...rest } = options;
  if (!["skill", "plugin"].includes(emitMode)) {
    throw new Error(`unsupported emit mode: ${emitMode}`);
  }
  return compilePack({
    ...rest,
    runtime: "codex_cli",
    runtimeAdapter,
    emitBundle: emitMode === "plugin" ? emitCodexPluginBundle : emitCodexBundle,
  } as Parameters<typeof compilePack>[0]);
}

// Codex marketplace manifest shape verified against the plugin-creator sample
// and Codex plugin docs (2026-09-28): {name, interface.displayName, plugins[]}
// with plugins[].source {source:"local", path:"./plugins/<name>"} | "url" |
// "git-subdir". policy.installation/authentication values: AVAILABLE,
// INSTALLED_BY_DEFAULT / ON_INSTALL, ON_USE. Emission only — publishing is a
// T3-05/T7 decision.
export function buildCodexMarketplaceManifest({ name, displayName, packIds, pluginsBase = "./plugins" }: { name?: string; displayName?: any; packIds: string[]; pluginsBase?: any }) {
  return {
    name,
    interface: {
      displayName,
    },
    plugins: [...packIds].sort().map((packId: string) => ({
      name: packId,
      source: {
        source: "local",
        path: `${pluginsBase}/${packId}`,
      },
      policy: {
        installation: "AVAILABLE",
        authentication: "ON_INSTALL",
      },
      category: "developer-tools",
    })),
  };
}

export { emitCodexBundle, emitCodexPluginBundle, runtimeAdapter };
