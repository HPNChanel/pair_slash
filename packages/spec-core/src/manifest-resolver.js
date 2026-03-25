import { SUPPORTED_RUNTIMES, SUPPORTED_TARGETS } from "./constants.js";
import { normalizePackManifestV2 } from "./manifest-v2.normalize.js";
import { normalizeRuntime, normalizeTarget } from "./utils.js";

function assertManifest(manifest) {
  const normalized = normalizePackManifestV2(manifest, { attachAliases: true });
  if (!normalized) {
    throw new Error("unsupported manifest shape");
  }
  return normalized;
}

export function resolveManifestRuntime(manifest, runtime) {
  const normalizedManifest = assertManifest(manifest);
  const normalizedRuntime = normalizeRuntime(runtime);
  if (!SUPPORTED_RUNTIMES.includes(normalizedRuntime)) {
    throw new Error(`unsupported runtime: ${runtime}`);
  }
  if (!normalizedManifest.supported_runtimes.includes(normalizedRuntime)) {
    throw new Error(`manifest does not support runtime ${normalizedRuntime}`);
  }
  return {
    runtime: normalizedRuntime,
    runtime_range: normalizedManifest.supported_runtime_ranges[normalizedRuntime],
    runtime_binding: normalizedManifest.runtime_bindings[normalizedRuntime],
    assets: normalizedManifest.runtime_assets.entries.filter(
      (entry) => entry.runtime === "shared" || entry.runtime === normalizedRuntime,
    ),
    ownership_records: normalizedManifest.asset_ownership.records.filter((record) =>
      normalizedManifest.runtime_assets.entries
        .filter((entry) => entry.runtime === "shared" || entry.runtime === normalizedRuntime)
        .some((entry) => entry.asset_id === record.asset_id),
    ),
  };
}

export function resolveManifestTarget(manifest, target) {
  const normalizedManifest = assertManifest(manifest);
  const normalizedTarget = normalizeTarget(target);
  if (!SUPPORTED_TARGETS.includes(normalizedTarget)) {
    throw new Error(`unsupported target: ${target}`);
  }
  if (!normalizedManifest.install_targets.includes(normalizedTarget)) {
    throw new Error(`manifest does not support target ${normalizedTarget}`);
  }
  return {
    target: normalizedTarget,
    smoke_checks: normalizedManifest.smoke_checks.filter((entry) => entry.target === normalizedTarget),
  };
}

export function resolveManifestInstallSpec(manifest, { runtime, target }) {
  const normalizedManifest = assertManifest(manifest);
  const runtimeSpec = resolveManifestRuntime(normalizedManifest, runtime);
  const targetSpec = resolveManifestTarget(normalizedManifest, target);
  return {
    pack_name: normalizedManifest.pack_name,
    runtime: runtimeSpec.runtime,
    target: targetSpec.target,
    runtime_range: runtimeSpec.runtime_range,
    runtime_binding: runtimeSpec.runtime_binding,
    source_root: normalizedManifest.runtime_assets.source_root,
    primary_skill: normalizedManifest.runtime_assets.primary_skill,
    assets: runtimeSpec.assets,
    ownership_records: runtimeSpec.ownership_records,
    docs_refs: normalizedManifest.docs_refs,
    smoke_checks: targetSpec.smoke_checks.filter((entry) => entry.runtime === runtimeSpec.runtime),
    update_strategy: normalizedManifest.update_strategy,
    uninstall_strategy: normalizedManifest.uninstall_strategy,
    local_override_policy: normalizedManifest.local_override_policy,
  };
}
