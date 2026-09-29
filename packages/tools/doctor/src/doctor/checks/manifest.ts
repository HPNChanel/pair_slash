import {
  createCheckResult,
} from "../helpers.ts";

export function runManifestValidation(context: any) {
  const invalid =
    context.requestedPacks.length > 0
      ? context.invalidSelectedManifests
      : context.manifestRecords.filter((record: any) => record.error);
  const normalizationWarnings = context.selectedManifests.flatMap((record: any) =>
    (record.normalizationWarnings ?? []).map((warning: any) => ({
      manifest_path: record.manifestPath,
      warning,
    })),
  );
  if (invalid.length > 0) {
    return createCheckResult({
      id: "manifest.discover_and_validate",
      group: "manifest",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        requested_packs: context.requestedPacks,
      },
      summary: `${invalid.length} manifest(s) failed validation`,
      remediation: "Fix manifest schema errors before running install or update.",
      evidence: {
        invalid: invalid.map((record: any) => ({
          manifest_path: record.manifestPath,
          error: record.error,
        })),
      },
      blockingForInstall: true,
    });
  }
  if (context.missingRequestedPacks.length > 0) {
    return createCheckResult({
      id: "manifest.discover_and_validate",
      group: "manifest",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        requested_packs: context.requestedPacks,
      },
      summary: `${context.missingRequestedPacks.length} requested pack(s) were not found`,
      remediation: "Verify pack ids or run doctor from the repository that contains the requested manifests.",
      evidence: {
        missing_packs: context.missingRequestedPacks,
      },
      blockingForInstall: true,
    });
  }
  if (context.manifestRecords.length === 0) {
    return createCheckResult({
      id: "manifest.discover_and_validate",
      group: "manifest",
      status: "warn",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        requested_packs: context.requestedPacks,
      },
      summary: "no pack manifests were discovered",
      remediation: "Run doctor from a PairSlash repository with `packs/core` manifests if you need manifest-aware checks.",
      evidence: {},
    });
  }
  if (normalizationWarnings.length > 0) {
    return createCheckResult({
      id: "manifest.discover_and_validate",
      group: "manifest",
      status: "warn",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        requested_packs: context.requestedPacks,
      },
      summary: `${normalizationWarnings.length} manifest normalization warning(s) detected`,
      remediation: "Rewrite legacy manifests using canonical pack.manifest.yaml v2.2.0 fields.",
      evidence: {
        discovered: context.manifestRecords.length,
        normalization_warnings: normalizationWarnings,
      },
    });
  }
  return createCheckResult({
    id: "manifest.discover_and_validate",
    group: "manifest",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {
      requested_packs: context.requestedPacks,
    },
    summary: `${context.selectedManifests.length} manifest(s) selected for doctor checks`,
    evidence: {
      discovered: context.manifestRecords.length,
    },
  });
}

export function runManifestRuntimeTargets(context: any) {
  if (context.selectedManifests.length === 0) {
    return createCheckResult({
      id: "manifest.runtime_target_presence",
      group: "manifest",
      status: "skip",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "skipped because no manifests were selected",
      evidence: {},
    });
  }
  const missing = [];
  for (const record of context.selectedManifests) {
    if (!record.manifest.runtime_targets?.[context.runtime]) {
      missing.push({
        pack_id: record.packId,
        reason: "missing runtime target",
      });
    }
    if (!record.manifest.install_targets.includes(context.target)) {
      missing.push({
        pack_id: record.packId,
        reason: "unsupported install target",
      });
    }
  }
  if (missing.length > 0) {
    return createCheckResult({
      id: "manifest.runtime_target_presence",
      group: "manifest",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${missing.length} runtime or install target declaration issue(s) found`,
      remediation: "Add the requested runtime target and install target to the manifest, or choose a compatible runtime/target.",
      evidence: {
        missing,
      },
      blockingForInstall: true,
    });
  }
  return createCheckResult({
    id: "manifest.runtime_target_presence",
    group: "manifest",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary: "all selected manifests declare the requested runtime and install target",
    evidence: {},
  });
}

export function runManifestNamingConflicts(context: any) {
  if (context.selectedManifests.length === 0) {
    return createCheckResult({
      id: "manifest.naming_conflicts",
      group: "conflict",
      status: "skip",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "skipped because no manifests were selected",
      evidence: {},
    });
  }
  const installDirs = new Map();
  const directInvocations = new Map();
  const conflicts = [];

  for (const record of context.selectedManifests) {
    const installDir = context.adapter.resolvePackInstallDir(
      { repoRoot: context.repoRoot, target: context.target, skillRoot: context.skillRoot },
      record.packId,
    );
    if (installDirs.has(installDir)) {
      conflicts.push({
        type: "install_dir",
        path: installDir,
        pack_ids: [installDirs.get(installDir), record.packId],
      });
    } else {
      installDirs.set(installDir, record.packId);
    }

    const directInvocation = record.manifest.runtime_targets[context.runtime]?.direct_invocation;
    if (directInvocation) {
      if (directInvocations.has(directInvocation)) {
        conflicts.push({
          type: "direct_invocation",
          value: directInvocation,
          pack_ids: [directInvocations.get(directInvocation), record.packId],
        });
      } else {
        directInvocations.set(directInvocation, record.packId);
      }
    }
  }

  if (conflicts.length > 0) {
    return createCheckResult({
      id: "manifest.naming_conflicts",
      group: "conflict",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${conflicts.length} naming conflict(s) detected`,
      remediation: "Rename the conflicting pack id or runtime direct invocation so each pack resolves to a unique runtime surface.",
      evidence: {
        conflicts,
      },
      blockingForInstall: true,
    });
  }
  return createCheckResult({
    id: "manifest.naming_conflicts",
    group: "conflict",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary: "no manifest naming conflicts detected",
    evidence: {},
  });
}
