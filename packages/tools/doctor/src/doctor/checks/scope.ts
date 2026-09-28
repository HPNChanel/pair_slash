import {
  exists,
} from "@pairslash/spec-core";
import {
  createCheckResult,
  findExistingParentPath,
  hasRepoMarkers,
  safeStat,
} from "../helpers.ts";

export function runScopeRepoRoot(context) {
  if (context.target === "user") {
    return createCheckResult({
      id: "scope.repo_root",
      group: "scope",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        repo_root: context.repoRoot,
      },
      summary: "user scope does not require repository markers",
      evidence: {},
    });
  }
  const manifestCount = context.manifestRecords.length;
  if (!hasRepoMarkers(context.repoRoot)) {
    return createCheckResult({
      id: "scope.repo_root",
      group: "scope",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        repo_root: context.repoRoot,
      },
      summary: "repo scope could not confirm repository markers",
      remediation: "Run doctor from the repository root or choose `--target user`.",
      evidence: {
        manifest_count: manifestCount,
      },
      blockingForInstall: true,
    });
  }
  if (context.requestedPacks.length > 0 && manifestCount === 0) {
    return createCheckResult({
      id: "scope.repo_root",
      group: "scope",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        repo_root: context.repoRoot,
      },
      summary: "requested packs cannot be resolved because no manifests were discovered",
      remediation: "Run doctor from the PairSlash repo root containing `packs/core`.",
      evidence: {},
      blockingForInstall: true,
    });
  }
  return createCheckResult({
    id: "scope.repo_root",
    group: "scope",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {
      repo_root: context.repoRoot,
    },
    summary: "repo root markers are present",
    evidence: {
      manifest_count: manifestCount,
    },
  });
}

export function runConfigHomeCheck(context) {
  if (!exists(context.configHome)) {
    return createCheckResult({
      id: "filesystem.config_home",
      group: "filesystem",
      status: "warn",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        config_home: context.configHome,
      },
      summary: "config home does not exist yet but can be initialized during install",
      remediation: "Run install to create the runtime config home, or create the directory manually if policy requires it.",
      evidence: {
        parent: findExistingParentPath(context.configHome),
      },
    });
  }
  const stat = safeStat(context.configHome);
  if (!stat.ok || !stat.stat.isDirectory()) {
    return createCheckResult({
      id: "filesystem.config_home",
      group: "filesystem",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        config_home: context.configHome,
      },
      summary: "config home exists but is not a directory",
      remediation: "Remove the blocking file or fix the config home path so it resolves to a directory.",
      evidence: {
        error: stat.error ?? null,
      },
      blockingForInstall: true,
    });
  }
  return createCheckResult({
    id: "filesystem.config_home",
    group: "filesystem",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {
      config_home: context.configHome,
    },
    summary: "config home path is valid",
    evidence: {},
  });
}
