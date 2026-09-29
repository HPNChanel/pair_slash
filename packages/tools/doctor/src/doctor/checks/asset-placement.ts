import {
  basename,
} from "node:path";
import {
  createCheckResult,
} from "../helpers.ts";

export function runAssetPlacement(context: any) {
  if (!context.state || context.state.packs.length === 0) {
    return createCheckResult({
      id: "install_state.asset_placement",
      group: "install_state",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "no installed runtime assets to validate",
      evidence: {},
    });
  }

  const invalid = [];
  for (const pack of context.state.packs) {
    for (const file of pack.files) {
      if (file.asset_kind === "ownership_manifest") {
        continue;
      }
      if (!context.adapter.supportsInstallSurface(file.install_surface)) {
        invalid.push({
          pack_id: pack.id,
          relative_path: file.relative_path,
          install_surface: file.install_surface,
          reason: "install surface is not supported by the selected runtime adapter",
        });
        continue;
      }
      try {
        const expectedPath = context.adapter.resolveAssetPath({
          install_surface: file.install_surface,
          source_relpath:
            file.install_surface === "canonical_skill" || file.install_surface === "support_doc"
              ? file.relative_path
              : null,
          file_name: basename(file.relative_path),
        });
        if (expectedPath !== file.relative_path) {
          invalid.push({
            pack_id: pack.id,
            relative_path: file.relative_path,
            install_surface: file.install_surface,
            expected_relative_path: expectedPath,
            reason: "asset path does not match runtime-native placement",
          });
        }
      } catch (error) {
        invalid.push({
          pack_id: pack.id,
          relative_path: file.relative_path,
          install_surface: file.install_surface,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  if (invalid.length > 0) {
    return createCheckResult({
      id: "install_state.asset_placement",
      group: "install_state",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${invalid.length} installed asset placement issue(s) were detected`,
      remediation: "Reinstall the pack for the correct runtime or fix compiler/runtime emitter drift before updating.",
      evidence: {
        invalid,
      },
      blockingForInstall: true,
    });
  }
  return createCheckResult({
    id: "install_state.asset_placement",
    group: "install_state",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary: "installed runtime assets match expected placement for the selected runtime",
    evidence: {},
  });
}
