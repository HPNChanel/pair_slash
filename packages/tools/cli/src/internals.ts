// PairSlash CLI internal helpers.
//
// Phase M1 (modernization foundation): extracted from bin/pairslash.js to
// reduce the 1650-line dispatcher. These helpers are pure utility functions
// and small orchestrators that the dispatcher and command handlers consume.
// No behavioral change — the existing cli.test.js suite is the contract.

import { resolve } from "node:path";

import {
  SUPPORTED_RUNTIMES,
  exists,
  loadPackCatalogRecords,
  loadPackManifestRecords,
  normalizeRuntime,
  normalizeTarget,
  selectDefaultCatalogPack,
  selectPackManifestRecords,
  stableJson,
  writeTextFile,
} from "@pairslash/spec-core";
import {
  applyInstall,
  applyUninstall,
  applyUpdate,
  detectRuntimeSelection,
  planInstall,
  planUninstall,
  planUpdate,
  resolveStatePath,
} from "@pairslash/installer";

import * as codexAdapter from "@pairslash/runtime-codex-adapter";
import * as copilotAdapter from "@pairslash/runtime-copilot-adapter";

export {
  applyInstall,
  applyUninstall,
  applyUpdate,
  planInstall,
  planUninstall,
  planUpdate,
};

export const LIFECYCLE_ACTIONS = ["install", "update", "uninstall"];
export const INSTALL_PACK_SETS = {
  bootstrap: ["pairslash-plan"],
  core: [],
};
export const INSTALL_PACK_SET_VALUES = Object.keys(INSTALL_PACK_SETS);

export { codexAdapter, copilotAdapter };

export function emit(stdout, value, formatters) {
  if (formatters.format === "json") {
    stdout.write(stableJson(value));
    return;
  }
  stdout.write(formatters.text(value));
}

export function assertRuntime(runtime) {
  if (!runtime) {
    throw new Error("--runtime is required");
  }
}

export function assertLifecycleAction(action, { command = "command" } = {}) {
  if (LIFECYCLE_ACTIONS.includes(action)) {
    return;
  }
  const received = action ?? "(missing)";
  throw new Error(
    `unknown ${command} action: ${received}; expected one of ${LIFECYCLE_ACTIONS.join(", ")}`,
  );
}

export function resolveInstallPacks(repoRoot, options) {
  if (options.packs.length > 0) {
    return options.packs;
  }
  const catalogRecords = loadPackCatalogRecords(repoRoot, { includeAdvanced: false });
  if (options.packSet === "bootstrap") {
    const defaultRecord = selectDefaultCatalogPack(catalogRecords);
    return defaultRecord ? [defaultRecord.id] : INSTALL_PACK_SETS.bootstrap;
  }
  if (options.packSet === "core") {
    return catalogRecords
      .filter((record) => record.default_discovery !== false)
      .map((record) => record.id);
  }
  return INSTALL_PACK_SETS[options.packSet] ?? INSTALL_PACK_SETS.bootstrap;
}

export function materializePlan(repoRoot, plan, planOut) {
  if (!planOut) {
    return plan;
  }
  const planPath = resolve(repoRoot, planOut);
  const persisted = { ...plan, plan_path: planPath };
  writeTextFile(planPath, stableJson(persisted));
  return persisted;
}

export function getRuntimeAdapter(runtime) {
  const normalized = normalizeRuntime(runtime);
  return normalized === "codex_cli" ? codexAdapter : copilotAdapter;
}

export function resolveSelectedPackRecord(repoRoot, requestedPacks = []) {
  const records = loadPackManifestRecords(repoRoot);
  const selection = selectPackManifestRecords(records, requestedPacks, { includeInvalid: true });
  const catalogRecords = loadPackCatalogRecords(repoRoot, { includeAdvanced: false });
  const preferredCatalogRecord = selectDefaultCatalogPack(catalogRecords);
  if (selection.missing.length > 0) {
    throw new Error(`pack-not-found: ${selection.missing.join(", ")}`);
  }
  if (requestedPacks.length > 0 && selection.valid.length === 0 && selection.invalid.length > 0) {
    throw new Error(`invalid-pack-manifest: ${selection.invalid[0].manifestPath} :: ${selection.invalid[0].error}`);
  }
  const record =
    selection.valid[0] ??
    (preferredCatalogRecord
      ? records.find((candidate) => candidate.packId === preferredCatalogRecord.id && candidate.isValid)
      : null) ??
    records.find((candidate) => candidate.isValid) ??
    null;
  return {
    record,
    selection,
  };
}

export function deriveToolAvailability(report, packId, manifest) {
  const check = report.checks.find((entry) => entry.id === "dependencies.required_tools");
  const failures = [
    ...(check?.evidence?.failures ?? []),
    ...(check?.evidence?.warnings ?? []),
  ];
  return (manifest?.required_tools ?? []).map((tool) => ({
    id: tool.id,
    available: !failures.some((failure) => failure.pack_id === packId && failure.tool_id === tool.id),
    required_for: tool.required_for ?? [],
  }));
}

export function selectorFromOptions(options, traceContext = null) {
  return {
    runtime: options.runtime && options.runtime !== "auto" ? normalizeRuntime(options.runtime) : null,
    target: options.target ?? null,
    exclude_session_id: traceContext?.sessionId ?? null,
  };
}

export function resolveExecutionRuntime(repoRoot, requestedRuntime, target) {
  if (requestedRuntime === "all") {
    throw new Error("runtime-selection-failed: --runtime all is not supported for this command");
  }
  if (requestedRuntime && requestedRuntime !== "auto") {
    return normalizeRuntime(requestedRuntime);
  }
  const normalizedTarget = normalizeTarget(target);
  const stateCandidates = SUPPORTED_RUNTIMES.filter((runtime) =>
    exists(resolveStatePath({ repoRoot, runtime, target: normalizedTarget })),
  );
  if (stateCandidates.length === 1) {
    return stateCandidates[0];
  }
  if (stateCandidates.length > 1) {
    throw new Error(
      `runtime-selection-ambiguous: install state exists for ${stateCandidates.join(", ")}; rerun with explicit --runtime`,
    );
  }
  const detection = detectRuntimeSelection("auto");
  if (detection.runtime) {
    return detection.runtime;
  }
  if (detection.ambiguous) {
    throw new Error(
      detection.candidates.length === 0
        ? "runtime-selection-failed: no runtime resolved; rerun with explicit --runtime"
        : `runtime-selection-ambiguous: detected ${detection.candidates.join(", ")}; rerun with explicit --runtime`,
    );
  }
  throw new Error("runtime-selection-failed: no runtime resolved; rerun with explicit --runtime");
}

export function buildLifecycleEnvelope(action, repoRoot, options) {
  assertLifecycleAction(action, { command: "preview" });
  if (action !== "install" && options.packSetProvided) {
    throw new Error("--pack-set and --all are only available for install");
  }
  const packs = action === "install" ? resolveInstallPacks(repoRoot, options) : options.packs;
  return action === "install"
    ? planInstall({ repoRoot, runtime: options.runtime, target: options.target, packs })
    : action === "update"
      ? planUpdate({
          repoRoot,
          runtime: options.runtime,
          target: options.target,
          packs,
          from: options.from,
          to: options.to,
        })
      : planUninstall({
          repoRoot,
          runtime: options.runtime,
          target: options.target,
          packs,
        });
}
