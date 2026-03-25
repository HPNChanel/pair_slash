import * as runtimeAdapter from "@pairslash/runtime-copilot-adapter";
import {
  compilePack,
  materializeCompiledFile,
} from "@pairslash/spec-core";

import { copilotGenerators } from "./generators.js";

function emitCopilotBundle({ ir }) {
  return ir.logical_assets
    .filter(
      (asset) =>
        asset.runtime_selector === "shared" || asset.runtime_selector === "copilot_cli",
    )
    .filter((asset) => asset.generator !== "pairslash_ownership_receipt")
    .map((asset) => {
      if (!runtimeAdapter.supportsInstallSurface(asset.install_surface)) {
        throw new Error(
          `copilot emitter does not support install surface ${asset.install_surface}`,
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

      const render = copilotGenerators[asset.generator];
      if (typeof render !== "function") {
        throw new Error(`copilot emitter does not support generator ${asset.generator}`);
      }
      return materializeCompiledFile({
        logicalAsset: asset,
        relativePath,
        content: render(ir, asset),
      });
    });
}

export function compileCopilotPack(options) {
  return compilePack({
    ...options,
    runtime: "copilot_cli",
    runtimeAdapter,
    emitBundle: emitCopilotBundle,
  });
}

export { emitCopilotBundle, runtimeAdapter };
