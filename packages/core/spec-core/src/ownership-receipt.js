import { PHASE4_COMPILER_VERSION } from "./constants.js";
import { stableJson } from "./utils.js";

export function buildOwnershipReceipt({ ir, runtime, directInvocation, emittedAssets }) {
  return stableJson({
    kind: "pairslash-owned-footprint",
    schema_version: "1.0.0",
    compiler_version: PHASE4_COMPILER_VERSION,
    manifest_digest: ir.manifest_digest,
    pack_id: ir.pack.id,
    version: ir.pack.version,
    runtime,
    canonical_entrypoint: ir.pack.canonical_entrypoint,
    direct_invocation: directInvocation,
    ownership_scope: ir.policy.asset_ownership.ownership_scope,
    ownership_file: ir.policy.asset_ownership.ownership_file,
    update_strategy: ir.policy.update_strategy,
    uninstall_strategy: ir.policy.uninstall_strategy,
    local_override_policy: ir.policy.local_override_policy,
    files: emittedAssets.map((file) => ({
      asset_id: file.asset_id,
      relative_path: file.relative_path,
      sha256: file.sha256,
      generated: file.generated,
      generator: file.generator,
      required: file.required,
      asset_kind: file.asset_kind,
      install_surface: file.install_surface,
      runtime_selector: file.runtime_selector,
      override_eligible: file.override_eligible,
      override_strategy: file.override_eligible ? "preserve" : "managed_replace",
      write_authority_guarded: file.write_authority_guarded,
      owner: file.owner,
      uninstall_behavior: file.uninstall_behavior,
      owned_by_pairslash: file.owner === "pairslash",
    })),
  });
}
