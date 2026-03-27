import * as runtimeAdapter from "@pairslash/runtime-codex-adapter";
import {
  compilePack,
  materializeCompiledFile,
} from "@pairslash/spec-core";

import { codexGenerators } from "./generators.js";

function emitCodexBundle({ ir }) {
  return ir.logical_assets
    .filter(
      (asset) =>
        asset.runtime_selector === "shared" || asset.runtime_selector === "codex_cli",
    )
    .filter((asset) => asset.generator !== "pairslash_ownership_receipt")
    .map((asset) => {
      if (!runtimeAdapter.supportsInstallSurface(asset.install_surface)) {
        throw new Error(
          `codex emitter does not support install surface ${asset.install_surface}`,
        );
      }

      const relativePath = runtimeAdapter.resolveRuntimeAssetPath(asset);
      if (asset.generator === "source_copy") {
        return materializeCompiledFile({
          logicalAsset: asset,
          relativePath,
          content: asset.content,
        });
      }

      const render = codexGenerators[asset.generator];
      if (typeof render !== "function") {
        throw new Error(`codex emitter does not support generator ${asset.generator}`);
      }
      return materializeCompiledFile({
        logicalAsset: asset,
        relativePath,
        content: render(ir, asset),
      });
    });
}

export function compileCodexPack(options) {
  return compilePack({
    ...options,
    runtime: "codex_cli",
    runtimeAdapter,
    emitBundle: emitCodexBundle,
  });
}

export { emitCodexBundle, runtimeAdapter };
