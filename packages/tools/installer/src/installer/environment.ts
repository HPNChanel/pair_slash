import {
  buildInstallStateMetadataMismatches,
  isPathWithinRoot,
} from "../semantics.ts";
import {
  buildEmptyState,
  findStatePack,
  loadInstallState,
  resolveStatePath,
} from "../state.ts";
import {
  runLintBridge,
} from "@pairslash/lint-bridge";
import {
  INSTALL_JOURNAL_DIR,
  SUPPORTED_RUNTIMES,
  exists,
  loadPackManifest,
  normalizeRuntime,
} from "@pairslash/spec-core";
import {
  dirname,
  resolve,
} from "node:path";
import {
  REASON_CODE_INSTALL_STATE_INVALID,
  REASON_CODE_INSTALL_STATE_METADATA_MISMATCH,
  findExistingParentPath,
  resolveInstallRootForEmit,
  runCheckCommand,
  safeLstat,
  safeRealpath,
} from "./helpers.ts";
import {
  buildStateReviewAction,
  manifestSelection,
} from "./plan.ts";

export function inspectInstallDirBoundary({ installRoot, installDir }: { installRoot: string; installDir?: any }) {
  const rootPath = resolve(installRoot);
  const candidatePath = resolve(installDir);
  if (!isPathWithinRoot(rootPath, candidatePath)) {
    return {
      reason: "resolved pack install path escapes install root",
      detail: `install root ${rootPath} does not contain ${candidatePath}`,
    };
  }

  const rootAnchor = findExistingParentPath(rootPath);
  const rootAnchorRealpath = safeRealpath(rootAnchor);
  const candidateAnchor = findExistingParentPath(candidatePath);
  const candidateAnchorStat = safeLstat(candidateAnchor);
  if (!candidateAnchorStat.ok) {
    return {
      reason: "unable to inspect existing install path anchor",
      detail: candidateAnchorStat.error,
    };
  }
  if (candidateAnchorStat.stat?.isSymbolicLink()) {
    return {
      reason: "install path anchor is a symbolic link and cannot be trusted",
      detail: candidateAnchor,
    };
  }

  if (rootAnchorRealpath.ok) {
    const candidateAnchorRealpath = safeRealpath(candidateAnchor);
    if (!candidateAnchorRealpath.ok) {
      return {
        reason: "unable to resolve install path anchor realpath",
        detail: candidateAnchorRealpath.error,
      };
    }
    if (!isPathWithinRoot(rootAnchorRealpath.path, candidateAnchorRealpath.path)) {
      return {
        reason: "install path anchor resolves outside install root boundary",
        detail: `${candidateAnchorRealpath.path} not within ${rootAnchorRealpath.path}`,
      };
    }
  }

  if (!exists(candidatePath)) {
    return null;
  }

  const installDirStat = safeLstat(candidatePath);
  if (!installDirStat.ok) {
    return {
      reason: "unable to inspect existing install path",
      detail: installDirStat.error,
    };
  }
  if (installDirStat.stat?.isSymbolicLink()) {
    return {
      reason: "pack install path is a symbolic link and cannot be adopted",
      detail: candidatePath,
    };
  }
  if (!installDirStat.stat?.isDirectory()) {
    return {
      reason: "pack install path exists but is not a directory",
      detail: candidatePath,
    };
  }
  if (rootAnchorRealpath.ok) {
    const installDirRealpath = safeRealpath(candidatePath);
    if (!installDirRealpath.ok) {
      return {
        reason: "unable to resolve pack install path realpath",
        detail: installDirRealpath.error,
      };
    }
    if (!isPathWithinRoot(rootAnchorRealpath.path, installDirRealpath.path)) {
      return {
        reason: "pack install path resolves outside install root boundary",
        detail: `${installDirRealpath.path} not within ${rootAnchorRealpath.path}`,
      };
    }
  }
  return null;
}

export function runRequiredToolChecks(manifest: any, errors: string[]) {
  for (const tool of manifest.required_tools ?? []) {
    if (!tool.required_for?.includes("install")) {
      continue;
    }
    const result = runCheckCommand(tool.check_command);
    if (result.status !== 0) {
      errors.push(
        `missing-tool:${manifest.pack.id}:${tool.id}: ${
          result.stderr?.trim() || result.stdout?.trim() || "tool check failed"
        }`,
      );
    }
  }
}

export function applyLintPreflight({ repoRoot, packs, runtime, target, errors, warnings }: { repoRoot: string; packs?: any; runtime?: string; target?: any; errors: string[]; warnings: string[] }) {
  if (packs.length === 0) {
    return null;
  }
  const report = runLintBridge({
    repoRoot,
    packs,
    runtime,
    target,
  });
  for (const issue of report.issues) {
    if (issue.result === "error") {
      errors.push(
        `lint-error:${issue.code}:${issue.pack_id ?? "global"}:${issue.runtime}: ${issue.message}`,
      );
      continue;
    }
    if (issue.result === "warning") {
      warnings.push(
        `lint-warning:${issue.code}:${issue.pack_id ?? "global"}:${issue.runtime}: ${issue.message}`,
      );
    }
  }
  return report;
}

export function resolveInstallEnvironment({
  repoRoot,
  runtime,
  target,
  adapter,
  skillRoot,
  emit = "skill",
  errors,
  reasonCodes = [],
  remediationActions = [],
}: { repoRoot: string; runtime?: string; target?: any; adapter?: any; skillRoot?: any; emit?: string; errors: string[]; reasonCodes?: any; remediationActions?: any }) {
  let state;
  let statePath;
  try {
    const loaded = loadInstallState({ repoRoot, runtime, target, adapter, skillRoot, emit });
    state = loaded.state;
    statePath = loaded.statePath;
  } catch (error) {
    errors.push(`state-invalid: ${error instanceof Error ? error.message : String(error)}`);
    reasonCodes.push(REASON_CODE_INSTALL_STATE_INVALID);
    statePath = resolveStatePath({ repoRoot, runtime, target, skillRoot, emit });
    state = buildEmptyState({ repoRoot, runtime, target, adapter, skillRoot, emit });
    remediationActions.push(
      buildStateReviewAction({
        runtime,
        target,
        statePath,
        preferred: true,
      }),
    );
  }

  const installRoot = resolveInstallRootForEmit(adapter, { repoRoot, target, skillRoot, emit });
  const configHome = adapter.resolveConfigHome({ repoRoot, target, skillRoot });
  const journalDir = resolve(repoRoot, ".pairslash", INSTALL_JOURNAL_DIR);
  const mismatches = buildInstallStateMetadataMismatches({
    state,
    runtime,
    target,
    configHome,
    installRoot,
  });
  if (mismatches.length > 0) {
    errors.push(
      `state-metadata-mismatch:${mismatches.map((entry: any) => `${entry.field}:${entry.actual}`).join(",")}`,
    );
    reasonCodes.push(REASON_CODE_INSTALL_STATE_METADATA_MISMATCH);
    remediationActions.push(
      buildStateReviewAction({
        runtime,
        target,
        statePath,
        preferred: true,
      }),
    );
  }
  const permissionTargets = [
    installRoot ? findExistingParentPath(installRoot) : null,
    findExistingParentPath(dirname(statePath)),
    findExistingParentPath(journalDir),
  ].filter(Boolean);
  for (const permissionTarget of permissionTargets) {
    const permission = adapter.checkWritablePath(permissionTarget);
    if (!permission.writable) {
      errors.push(`permission-denied:${permissionTarget}: ${permission.error}`);
    }
  }

  return {
    state,
    statePath,
    installRoot,
    configHome,
    journalDir,
  };
}

export function resolveUpdateEnvironment({
  repoRoot,
  runtime,
  target,
  adapter,
  skillRoot,
  emit = "skill",
  errors,
  reasonCodes = [],
  remediationActions = [],
}: { repoRoot: string; runtime?: string; target?: any; adapter?: any; skillRoot?: any; emit?: string; errors: string[]; reasonCodes?: any; remediationActions?: any }) {
  const installRoot = resolveInstallRootForEmit(adapter, { repoRoot, target, skillRoot, emit });
  const configHome = adapter.resolveConfigHome({ repoRoot, target, skillRoot });
  const journalDir = resolve(repoRoot, ".pairslash", INSTALL_JOURNAL_DIR);
  const statePath = resolveStatePath({ repoRoot, runtime, target, skillRoot, emit });

  let state = buildEmptyState({ repoRoot, runtime, target, adapter, skillRoot, emit });
  try {
    const loaded = loadInstallState({ repoRoot, runtime, target, adapter, skillRoot, emit });
    state = loaded.state;
  } catch (error) {
    errors.push(`state-invalid: ${error instanceof Error ? error.message : String(error)}`);
    reasonCodes.push(REASON_CODE_INSTALL_STATE_INVALID);
    remediationActions.push(
      buildStateReviewAction({
        runtime,
        target,
        statePath,
        preferred: true,
      }),
    );
  }

  const mismatches = buildInstallStateMetadataMismatches({
    state,
    runtime,
    target,
    configHome,
    installRoot,
  });
  if (mismatches.length > 0) {
    errors.push(
      ...mismatches.map((entry: any) => `${entry.field}-mismatch: expected ${entry.expected} got ${entry.actual}`),
    );
    reasonCodes.push(REASON_CODE_INSTALL_STATE_METADATA_MISMATCH);
    remediationActions.push(
      buildStateReviewAction({
        runtime,
        target,
        statePath,
        preferred: true,
      }),
    );
  }

  const permissionTargets = [
    installRoot ? findExistingParentPath(installRoot) : null,
    findExistingParentPath(dirname(statePath)),
    findExistingParentPath(journalDir),
  ].filter(Boolean);
  for (const permissionTarget of permissionTargets) {
    const permission = adapter.checkWritablePath(permissionTarget);
    if (!permission.writable) {
      errors.push(`permission-denied:${permissionTarget}: ${permission.error}`);
    }
  }

  return {
    state,
    statePath,
    installRoot,
    configHome,
    journalDir,
  };
}

export function resolveUninstallRuntime(requestedRuntime: any, repoRoot: string, target: any, skillRoot: any, emit: string = "skill") {
  const normalized = normalizeRuntime(requestedRuntime);
  if (normalized && normalized !== "auto") {
    return normalized;
  }

  const candidates = SUPPORTED_RUNTIMES.filter((runtime: string) =>
    exists(resolveStatePath({ repoRoot, runtime, target, skillRoot, emit })),
  );
  if (candidates.length === 1) {
    return candidates[0];
  }
  if (candidates.length === 0) {
    throw new Error("runtime-unavailable:auto: no managed uninstall state found");
  }
  throw new Error(`runtime-ambiguous: uninstall state exists for ${candidates.join(", ")}`);
}

export function resolveUpdateSelection({
  repoRoot,
  state,
  requestedPacks,
  to,
  errors,
}: { repoRoot: string; state?: any; requestedPacks?: any; to?: any; errors: string[] }) {
  const selectedPackIds = requestedPacks.length > 0 ? requestedPacks : state.packs.map((pack: any) => pack.id);

  if (selectedPackIds.length === 0) {
    return {
      selectedPackIds,
      selection: [],
    };
  }

  for (const requestedPack of requestedPacks) {
    if (!findStatePack(state, requestedPack)) {
      errors.push(`pack-not-installed:${requestedPack}`);
    }
  }

  if (!to) {
    const { selection, errors: selectionErrors } = manifestSelection(repoRoot, selectedPackIds);
    errors.push(
      ...selectionErrors.map((error: any) =>
        error.startsWith("pack-not-found:")
          ? `manifest-not-found:${error.slice("pack-not-found: ".length)}`
          : error,
      ),
    );
    return {
      selectedPackIds,
      selection,
    };
  }

  if (selectedPackIds.length !== 1) {
    errors.push(`update-source-unsupported:${to}: --to requires exactly one selected pack`);
    return {
      selectedPackIds,
      selection: [],
    };
  }

  const manifestPath = resolve(repoRoot, to);
  if (!exists(manifestPath)) {
    errors.push(
      /\.(yaml|yml)$/i.test(to) ? `manifest-not-found:${to}` : `update-source-unsupported:${to}`,
    );
    return {
      selectedPackIds,
      selection: [],
    };
  }

  let manifest;
  try {
    manifest = loadPackManifest(manifestPath);
  } catch (error) {
    errors.push(`manifest-invalid:${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
    return {
      selectedPackIds,
      selection: [],
    };
  }
  const expectedPackId = selectedPackIds[0];
  if (manifest.pack.id !== expectedPackId) {
    errors.push(`manifest-pack-mismatch:${expectedPackId}: got ${manifest.pack.id}`);
    return {
      selectedPackIds,
      selection: [],
    };
  }

  return {
    selectedPackIds,
    selection: [{ manifestPath, manifest }],
  };
}
