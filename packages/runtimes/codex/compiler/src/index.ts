import * as runtimeAdapter from "@pairslash/runtime-codex-adapter";
import {
  buildNormalizedIr,
  compilePack,
  materializeCompiledFile,
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
        return materializeCompiledFile({
          logicalAsset: asset,
          relativePath,
          content: asset.content,
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

export function compileCodexPack(options: CompileOptions) {
  return compilePack({
    ...options,
    runtime: "codex_cli",
    runtimeAdapter,
    emitBundle: emitCodexBundle,
  } as Parameters<typeof compilePack>[0]);
}

export { emitCodexBundle, runtimeAdapter };
