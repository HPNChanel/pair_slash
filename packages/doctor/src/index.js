import { readdirSync, statSync } from "node:fs";
import process from "node:process";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import {
  detectRuntimeSelection,
  loadStateForDoctor,
  resolveStatePath,
  satisfiesRuntimeRange,
} from "@pairslash/installer";
import {
  DOCTOR_REPORT_SCHEMA_VERSION,
  SUPPORT_VERDICTS,
  SUPPORTED_RUNTIMES,
  discoverPackManifestPaths,
  exists,
  getPackId,
  loadPackManifest,
  normalizeRuntime,
  normalizeTarget,
  readFileNormalized,
  relativeFrom,
  sha256,
  validateDoctorReport,
} from "@pairslash/spec-core";
import * as codexAdapter from "@pairslash/runtime-codex-adapter";
import * as copilotAdapter from "@pairslash/runtime-copilot-adapter";

const DEGRADED_CHECKS = new Set([
  "dependencies.required_tools",
  "dependencies.required_mcp_servers",
  "install_state.owned_files_integrity",
]);

function getAdapter(runtime) {
  const normalized = normalizeRuntime(runtime);
  return normalized === "codex_cli" ? codexAdapter : copilotAdapter;
}

function inferSeverity(status) {
  if (status === "fail") {
    return "fail";
  }
  if (status === "warn") {
    return "warn";
  }
  return "info";
}

function createCheckResult({
  id,
  group,
  status,
  runtime,
  target,
  inputs = {},
  summary,
  remediation = null,
  evidence = {},
}) {
  return {
    id,
    group,
    severity: inferSeverity(status),
    status,
    runtime,
    target,
    inputs,
    summary,
    remediation,
    evidence,
  };
}

function findExistingParentPath(path) {
  let current = resolve(path);
  while (!exists(current)) {
    const parent = dirname(current);
    if (parent === current) {
      return current;
    }
    current = parent;
  }
  return current;
}

function detectShellName() {
  const raw = process.env.SHELL || process.env.ComSpec || process.env.TERM_PROGRAM || "unknown";
  return raw.toLowerCase();
}

function safeStat(path) {
  try {
    return { ok: true, stat: statSync(path) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function safeDigest(path) {
  try {
    return {
      ok: true,
      digest: sha256(readFileNormalized(path)),
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
    };
  }
}

function hasRepoMarkers(repoRoot) {
  return [".git", "packs", "package.json"].some((entry) => exists(join(repoRoot, entry)));
}

function listInstallRootEntries(installRoot) {
  if (!exists(installRoot)) {
    return [];
  }
  return readdirSync(installRoot, { withFileTypes: true })
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => ({
      name: entry.name,
      absolutePath: join(installRoot, entry.name),
      isDirectory: entry.isDirectory(),
    }));
}

function loadManifestRecords(repoRoot) {
  return discoverPackManifestPaths(repoRoot).map((manifestPath) => {
    try {
      const manifest = loadPackManifest(manifestPath);
      return {
        manifestPath,
        manifest,
        packId: getPackId(manifest),
        error: null,
      };
    } catch (error) {
      return {
        manifestPath,
        manifest: null,
        packId: relativeFrom(join(repoRoot, "packs", "core"), dirname(manifestPath)),
        error: error.message,
      };
    }
  });
}

function selectManifestRecords(records, requestedPacks) {
  const validRecords = records.filter((record) => !record.error);
  if (requestedPacks.length === 0) {
    return {
      selected: validRecords,
      missing: [],
    };
  }

  const byPackId = new Map(validRecords.map((record) => [record.packId, record]));
  const selected = [];
  const missing = [];
  for (const packId of requestedPacks) {
    if (!byPackId.has(packId)) {
      missing.push(packId);
      continue;
    }
    selected.push(byPackId.get(packId));
  }
  return { selected, missing };
}

function resolveDoctorRuntime(requestedRuntime, repoRoot, target, runtimeSelectionOverride = null) {
  if (runtimeSelectionOverride) {
    return normalizeRuntime(runtimeSelectionOverride);
  }
  const normalized = normalizeRuntime(requestedRuntime);
  if (normalized && normalized !== "auto") {
    return normalized;
  }

  const stateCandidates = SUPPORTED_RUNTIMES.filter((runtime) =>
    exists(resolveStatePath({ repoRoot, runtime, target })),
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
      `runtime-selection-ambiguous: detected ${detection.candidates.join(", ") || "multiple runtimes"}; rerun with explicit --runtime`,
    );
  }
  throw new Error("runtime-selection-failed: no runtime resolved; rerun with explicit --runtime");
}

function buildBaseContext({
  repoRoot,
  runtime,
  target = "repo",
  packs = [],
  adapterOverride = null,
  runtimeSelectionOverride = null,
}) {
  const normalizedTarget = normalizeTarget(target);
  const normalizedRuntime = resolveDoctorRuntime(
    runtime,
    repoRoot,
    normalizedTarget,
    runtimeSelectionOverride,
  );
  const adapter = adapterOverride ?? getAdapter(normalizedRuntime);
  const requestedPacks = [...new Set(packs)].sort((left, right) => left.localeCompare(right));
  const manifestRecords = loadManifestRecords(repoRoot);
  const selectedManifests = selectManifestRecords(manifestRecords, requestedPacks);
  const statePath = resolveStatePath({
    repoRoot,
    runtime: normalizedRuntime,
    target: normalizedTarget,
  });

  let state = null;
  let stateError = null;
  const stateFileExists = exists(statePath);
  try {
    state = loadStateForDoctor({
      repoRoot,
      runtime: normalizedRuntime,
      target: normalizedTarget,
    }).state;
  } catch (error) {
    stateError = error.message;
  }

  return {
    repoRoot,
    runtime: normalizedRuntime,
    target: normalizedTarget,
    requestedPacks,
    adapter,
    detection: adapter.detectRuntime(),
    configHome: adapter.resolveConfigHome({ repoRoot, target: normalizedTarget }),
    installRoot: adapter.resolveInstallRoot({ repoRoot, target: normalizedTarget }),
    statePath,
    stateFileExists,
    state,
    stateError,
    shell: detectShellName(),
    manifestRecords,
    selectedManifests: selectedManifests.selected,
    missingRequestedPacks: selectedManifests.missing,
  };
}

function runRuntimeDetect(context) {
  const detection = context.detection;
  if (detection.available) {
    return createCheckResult({
      id: "runtime.detect",
      group: "runtime",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        executable: detection.executable,
      },
      summary: `runtime available via ${detection.executable} (${detection.version})`,
      evidence: {
        version: detection.version,
      },
    });
  }
  return createCheckResult({
    id: "runtime.detect",
    group: "runtime",
    status: "fail",
    runtime: context.runtime,
    target: context.target,
    inputs: {
      executable: detection.executable,
    },
    summary: `runtime unavailable: ${detection.error}`,
    remediation:
      context.runtime === "codex_cli"
        ? "Install Codex CLI and verify `codex --version` succeeds."
        : "Install GitHub CLI with Copilot CLI enabled and verify `gh copilot --help` succeeds.",
    evidence: {
      error: detection.error,
    },
  });
}

function runRuntimeVersionRange(context) {
  const inputs = {
    pack_count: context.selectedManifests.length,
  };
  if (!context.detection.available) {
    return createCheckResult({
      id: "runtime.version_range",
      group: "runtime",
      status: "skip",
      runtime: context.runtime,
      target: context.target,
      inputs,
      summary: "skipped because runtime is unavailable",
      evidence: {},
    });
  }

  const mismatches = [];
  const unknown = [];
  for (const record of context.selectedManifests) {
    const range = record.manifest.supported_runtime_ranges[context.runtime];
    if (satisfiesRuntimeRange(context.detection.version, range)) {
      continue;
    }
    if (context.detection.version === "unknown") {
      unknown.push({ pack_id: record.packId, range });
      continue;
    }
    mismatches.push({
      pack_id: record.packId,
      range,
      version: context.detection.version,
    });
  }

  if (mismatches.length > 0) {
    return createCheckResult({
      id: "runtime.version_range",
      group: "runtime",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs,
      summary: `${mismatches.length} pack(s) require a different runtime version`,
      remediation: "Upgrade or downgrade the runtime so every selected pack satisfies supported_runtime_ranges.",
      evidence: {
        mismatches,
      },
    });
  }
  if (unknown.length > 0) {
    return createCheckResult({
      id: "runtime.version_range",
      group: "runtime",
      status: "warn",
      runtime: context.runtime,
      target: context.target,
      inputs,
      summary: `runtime version could not be parsed for ${unknown.length} pack(s)`,
      remediation: "Verify the runtime version string and rerun doctor with a runtime that reports semantic versions.",
      evidence: {
        unknown,
      },
    });
  }
  return createCheckResult({
    id: "runtime.version_range",
    group: "runtime",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs,
    summary: "runtime version satisfies all selected pack ranges",
    evidence: {
      version: context.detection.version,
    },
  });
}

function runPlatformSupport(context) {
  const supportedOs = ["win32", "linux", "darwin"];
  const knownShells = ["powershell", "pwsh", "cmd", "bash", "zsh", "sh"];
  if (!supportedOs.includes(process.platform)) {
    return createCheckResult({
      id: "platform.os_shell_support",
      group: "platform",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        os: process.platform,
        shell: context.shell,
      },
      summary: `unsupported operating system ${process.platform}`,
      remediation: "Run PairSlash from Windows, Linux, or macOS.",
      evidence: {},
    });
  }
  if (!knownShells.some((shell) => context.shell.includes(shell))) {
    return createCheckResult({
      id: "platform.os_shell_support",
      group: "platform",
      status: "warn",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        os: process.platform,
        shell: context.shell,
      },
      summary: `shell ${context.shell} is unrecognized but runtime detection succeeded`,
      remediation: "Use PowerShell, cmd, bash, zsh, or sh if shell-specific issues appear.",
      evidence: {},
    });
  }
  return createCheckResult({
    id: "platform.os_shell_support",
    group: "platform",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {
      os: process.platform,
      shell: context.shell,
    },
    summary: `platform ${process.platform} with shell ${context.shell} is supported`,
    evidence: {},
  });
}

function runScopeRepoRoot(context) {
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

function runConfigHomeCheck(context) {
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

function runInstallRootCheck(context) {
  if (!exists(context.installRoot)) {
    return createCheckResult({
      id: "filesystem.install_root",
      group: "filesystem",
      status: "warn",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        install_root: context.installRoot,
      },
      summary: "install root does not exist yet",
      remediation: "Run install to create the runtime install root.",
      evidence: {
        parent: findExistingParentPath(context.installRoot),
      },
    });
  }
  const stat = safeStat(context.installRoot);
  if (!stat.ok || !stat.stat.isDirectory()) {
    return createCheckResult({
      id: "filesystem.install_root",
      group: "filesystem",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        install_root: context.installRoot,
      },
      summary: "install root exists but is not a directory",
      remediation: "Remove or relocate the conflicting file so the install root can be a directory.",
      evidence: {
        error: stat.error ?? null,
      },
    });
  }
  return createCheckResult({
    id: "filesystem.install_root",
    group: "filesystem",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {
      install_root: context.installRoot,
    },
    summary: "install root path is valid",
    evidence: {},
  });
}

function runWritePermissionCheck(context) {
  const targets = [
    context.installRoot,
    dirname(context.statePath),
    context.configHome,
  ].map((path) => findExistingParentPath(path));
  const failures = [];
  for (const path of [...new Set(targets)]) {
    const permission = context.adapter.checkWritablePath(path);
    if (!permission.writable) {
      failures.push({ path, error: permission.error });
    }
  }
  if (failures.length > 0) {
    return createCheckResult({
      id: "filesystem.write_permission",
      group: "filesystem",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        paths: [...new Set(targets)],
      },
      summary: `${failures.length} writable path check(s) failed`,
      remediation: "Fix filesystem permissions or switch to a target scope with write access.",
      evidence: {
        failures,
      },
    });
  }
  return createCheckResult({
    id: "filesystem.write_permission",
    group: "filesystem",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {
      paths: [...new Set(targets)],
    },
    summary: "required filesystem paths are writable",
    evidence: {},
  });
}

function runInstallStateLoad(context) {
  if (context.stateError) {
    return createCheckResult({
      id: "install_state.load",
      group: "install_state",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        state_path: context.statePath,
      },
      summary: `install state is invalid: ${context.stateError}`,
      remediation: "Remove or repair the invalid install state file, then rerun install or update.",
      evidence: {},
    });
  }
  if (!context.state) {
    return createCheckResult({
      id: "install_state.load",
      group: "install_state",
      status: "skip",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        state_path: context.statePath,
      },
      summary: "skipped because no install state context is available",
      evidence: {},
    });
  }

  const mismatches = [];
  if (context.state.runtime !== context.runtime) {
    mismatches.push(`runtime ${context.state.runtime}`);
  }
  if (context.state.target !== context.target) {
    mismatches.push(`target ${context.state.target}`);
  }
  if (context.state.config_home !== context.configHome) {
    mismatches.push(`config_home ${context.state.config_home}`);
  }
  if (context.state.install_root !== context.installRoot) {
    mismatches.push(`install_root ${context.state.install_root}`);
  }
  if (mismatches.length > 0) {
    return createCheckResult({
      id: "install_state.load",
      group: "install_state",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        state_path: context.statePath,
      },
      summary: "install state metadata does not match the current runtime/target paths",
      remediation: "Reinstall for the intended runtime/target or remove stale install state before retrying.",
      evidence: {
        mismatches,
      },
    });
  }

  if (!context.stateFileExists) {
    return createCheckResult({
      id: "install_state.load",
      group: "install_state",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        state_path: context.statePath,
      },
      summary: "install state is absent, which is valid before first install",
      evidence: {},
    });
  }

  return createCheckResult({
    id: "install_state.load",
    group: "install_state",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {
      state_path: context.statePath,
    },
    summary: "install state loaded successfully",
    evidence: {
      pack_count: context.state.packs.length,
    },
  });
}

function runManifestValidation(context) {
  const invalid = context.manifestRecords.filter((record) => record.error);
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
        invalid: invalid.map((record) => ({
          manifest_path: record.manifestPath,
          error: record.error,
        })),
      },
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

function runManifestRuntimeTargets(context) {
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

function runManifestNamingConflicts(context) {
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
      { repoRoot: context.repoRoot, target: context.target },
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

function runRequiredTools(context) {
  if (context.selectedManifests.length === 0) {
    return createCheckResult({
      id: "dependencies.required_tools",
      group: "dependencies",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "no selected manifests require tools for doctor checks",
      evidence: {},
    });
  }

  const failures = [];
  const warnings = [];
  const statePacks = new Map((context.state?.packs ?? []).map((pack) => [pack.id, pack]));

  for (const record of context.selectedManifests) {
    for (const tool of record.manifest.required_tools ?? []) {
      const requiredFor = new Set(tool.required_for ?? []);
      if (![...requiredFor].some((phase) => ["doctor", "install", "run"].includes(phase))) {
        continue;
      }
      const result = spawnSync(tool.check_command, {
        shell: true,
        encoding: "utf8",
      });
      if (result.status === 0) {
        continue;
      }
      const detail = {
        pack_id: record.packId,
        tool_id: tool.id,
        required_for: [...requiredFor],
        error: result.stderr?.trim() || result.stdout?.trim() || "tool check failed",
      };
      const installed = statePacks.has(record.packId);
      if (requiredFor.has("doctor") || requiredFor.has("install") || installed) {
        failures.push(detail);
      } else {
        warnings.push(detail);
      }
    }
  }

  if (failures.length > 0) {
    return createCheckResult({
      id: "dependencies.required_tools",
      group: "dependencies",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${failures.length} required tool check(s) failed`,
      remediation: "Install the missing tool(s) or fix PATH/environment variables so each manifest tool check passes.",
      evidence: {
        failures,
        warnings,
      },
    });
  }
  if (warnings.length > 0) {
    return createCheckResult({
      id: "dependencies.required_tools",
      group: "dependencies",
      status: "warn",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${warnings.length} run-only tool requirement(s) are missing for uninstalled packs`,
      remediation: "Install the missing run-time tools before installing or invoking those packs.",
      evidence: {
        warnings,
      },
    });
  }
  return createCheckResult({
    id: "dependencies.required_tools",
    group: "dependencies",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary: "required tool checks passed",
    evidence: {},
  });
}

function buildExpectedMcpPath(context, installDir) {
  const relativePath = context.adapter.resolveAssetPath({
    install_surface: "mcp",
    file_name: "servers.yaml",
  });
  return join(installDir, relativePath);
}

function runRequiredMcpServers(context) {
  if (context.selectedManifests.length === 0) {
    return createCheckResult({
      id: "dependencies.required_mcp_servers",
      group: "dependencies",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "no selected manifests require MCP servers",
      evidence: {},
    });
  }

  const failures = [];
  const warnings = [];
  const statePacks = new Map((context.state?.packs ?? []).map((pack) => [pack.id, pack]));

  for (const record of context.selectedManifests) {
    const servers = record.manifest.required_mcp_servers ?? [];
    if (servers.length === 0) {
      continue;
    }
    const installedPack = statePacks.get(record.packId);
    if (!installedPack) {
      warnings.push({
        pack_id: record.packId,
        servers: servers.map((server) => server.id),
        reason: "pack not installed; declaration-only verification",
      });
      continue;
    }
    const mcpPath = buildExpectedMcpPath(context, installedPack.install_dir);
    const stat = safeStat(mcpPath);
    if (!stat.ok || !stat.stat.isFile()) {
      failures.push({
        pack_id: record.packId,
        path: mcpPath,
        servers: servers.map((server) => server.id),
      });
    }
  }

  if (failures.length > 0) {
    return createCheckResult({
      id: "dependencies.required_mcp_servers",
      group: "dependencies",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${failures.length} installed pack(s) are missing MCP config assets`,
      remediation: "Reinstall the affected pack or restore the runtime MCP config asset under the managed install directory.",
      evidence: {
        failures,
        warnings,
      },
    });
  }
  if (warnings.length > 0) {
    return createCheckResult({
      id: "dependencies.required_mcp_servers",
      group: "dependencies",
      status: "warn",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${warnings.length} selected pack(s) declare MCP dependencies but are not installed`,
      remediation: "Install those packs if you need doctor to validate emitted MCP config on disk.",
      evidence: {
        warnings,
      },
    });
  }
  return createCheckResult({
    id: "dependencies.required_mcp_servers",
    group: "dependencies",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary: "required MCP server config assets are present",
    evidence: {},
  });
}

function runOwnedFilesIntegrity(context) {
  if (!context.state || context.state.packs.length === 0) {
    return createCheckResult({
      id: "install_state.owned_files_integrity",
      group: "install_state",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "no installed pack files to verify",
      evidence: {},
    });
  }

  const failures = [];
  const warnings = [];
  for (const pack of context.state.packs) {
    for (const file of pack.files) {
      if (!file.owned_by_pairslash) {
        continue;
      }
      if (!exists(file.absolute_path)) {
        failures.push({
          pack_id: pack.id,
          relative_path: file.relative_path,
          reason: "missing managed file",
        });
        continue;
      }
      const stat = safeStat(file.absolute_path);
      if (!stat.ok || !stat.stat.isFile()) {
        failures.push({
          pack_id: pack.id,
          relative_path: file.relative_path,
          reason: "managed path is not a regular file",
        });
        continue;
      }
      const digest = safeDigest(file.absolute_path);
      if (!digest.ok) {
        failures.push({
          pack_id: pack.id,
          relative_path: file.relative_path,
          reason: digest.error,
        });
        continue;
      }
      if (digest.digest === file.current_digest) {
        if (file.local_override) {
          warnings.push({
            pack_id: pack.id,
            relative_path: file.relative_path,
            reason: "local override preserved in receipt",
          });
        }
        continue;
      }
      if (file.override_eligible) {
        warnings.push({
          pack_id: pack.id,
          relative_path: file.relative_path,
          reason: "override-eligible managed file was edited after the last receipt update",
        });
      } else {
        failures.push({
          pack_id: pack.id,
          relative_path: file.relative_path,
          reason: "non-override managed file was edited",
        });
      }
    }
  }

  if (failures.length > 0) {
    return createCheckResult({
      id: "install_state.owned_files_integrity",
      group: "install_state",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${failures.length} managed file integrity issue(s) detected`,
      remediation: "Run `pairslash update --preview` or restore the managed files before applying more changes.",
      evidence: {
        failures,
        warnings,
      },
    });
  }
  if (warnings.length > 0) {
    return createCheckResult({
      id: "install_state.owned_files_integrity",
      group: "install_state",
      status: "warn",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${warnings.length} local override or edited managed file(s) were preserved`,
      remediation: "Review preserved local overrides before running update or uninstall.",
      evidence: {
        warnings,
      },
    });
  }
  return createCheckResult({
    id: "install_state.owned_files_integrity",
    group: "install_state",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary: "tracked managed files match install state receipts",
    evidence: {},
  });
}

function runUnmanagedInstallRoot(context) {
  const entries = listInstallRootEntries(context.installRoot);
  const trackedNames = new Set((context.state?.packs ?? []).map((pack) => relativeFrom(context.installRoot, pack.install_dir)));
  const selectedNames = new Set(context.selectedManifests.map((record) => record.packId));
  const unmanaged = entries.filter((entry) => !trackedNames.has(entry.name));
  if (unmanaged.length === 0) {
    return createCheckResult({
      id: "conflict.unmanaged_install_root",
      group: "conflict",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "no unmanaged runtime assets detected under the install root",
      evidence: {},
    });
  }

  const collisions = unmanaged.filter((entry) => selectedNames.has(entry.name));
  if (collisions.length > 0) {
    return createCheckResult({
      id: "conflict.unmanaged_install_root",
      group: "conflict",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${collisions.length} unmanaged install root entry matches a selected pack id`,
      remediation: "Rename or remove conflicting unmanaged directories before installing or updating the pack.",
      evidence: {
        collisions: collisions.map((entry) => entry.absolutePath),
      },
    });
  }

  return createCheckResult({
    id: "conflict.unmanaged_install_root",
    group: "conflict",
    status: "warn",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary: `${unmanaged.length} unmanaged install root entr${unmanaged.length === 1 ? "y" : "ies"} detected`,
    remediation: "Review unmanaged runtime assets if they might collide with future PairSlash installs.",
    evidence: {
      unmanaged: unmanaged.map((entry) => ({
        name: entry.name,
        absolute_path: entry.absolutePath,
      })),
    },
  });
}

function runAssetSurfaceConsistency(context) {
  if (!context.state || context.state.packs.length === 0) {
    return createCheckResult({
      id: "runtime.asset_surface_consistency",
      group: "runtime",
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
      if (!context.adapter.supportsInstallSurface(file.install_surface)) {
        invalid.push({
          pack_id: pack.id,
          relative_path: file.relative_path,
          install_surface: file.install_surface,
        });
      }
    }
  }
  if (invalid.length > 0) {
    return createCheckResult({
      id: "runtime.asset_surface_consistency",
      group: "runtime",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${invalid.length} installed asset surface(s) are invalid for ${context.runtime}`,
      remediation: "Reinstall the pack for the correct runtime or fix compiler/runtime emitter drift.",
      evidence: {
        invalid,
      },
    });
  }
  return createCheckResult({
    id: "runtime.asset_surface_consistency",
    group: "runtime",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary: "installed asset surfaces are valid for the selected runtime",
    evidence: {},
  });
}

const CHECKS = [
  runRuntimeDetect,
  runRuntimeVersionRange,
  runPlatformSupport,
  runScopeRepoRoot,
  runConfigHomeCheck,
  runInstallRootCheck,
  runWritePermissionCheck,
  runInstallStateLoad,
  runManifestValidation,
  runManifestRuntimeTargets,
  runManifestNamingConflicts,
  runRequiredTools,
  runRequiredMcpServers,
  runOwnedFilesIntegrity,
  runUnmanagedInstallRoot,
  runAssetSurfaceConsistency,
];

function buildRuntimeCompatibility(context, checks) {
  const versionCheck = checks.find((check) => check.id === "runtime.version_range");
  const incompatiblePackIds =
    versionCheck?.evidence?.mismatches?.map((entry) => entry.pack_id).sort((left, right) => left.localeCompare(right)) ?? [];
  const selectedPackCount = context.selectedManifests.length;
  const compatiblePackCount = Math.max(0, selectedPackCount - incompatiblePackIds.length);
  return {
    requested_runtime_range_max_status:
      versionCheck?.status === "fail"
        ? "mismatch"
        : versionCheck?.status === "warn" || versionCheck?.status === "skip"
          ? "unknown"
          : "supported",
    selected_pack_count: selectedPackCount,
    compatible_pack_count: compatiblePackCount,
    incompatible_pack_ids: incompatiblePackIds,
  };
}

function buildInstalledPacks(state) {
  if (!state) {
    return [];
  }
  return state.packs
    .map((pack) => ({
      id: pack.id,
      version: pack.version,
      install_dir: pack.install_dir,
      local_overrides: pack.files.filter((file) => file.local_override).length,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function buildIssues(checks) {
  return checks
    .filter((check) => check.status === "warn" || check.status === "fail")
    .map((check) => ({
      code: check.id.replace(/\./g, "_"),
      severity: check.status === "fail" ? "fail" : "warn",
      check_id: check.id,
      message: check.summary,
      remediation: check.remediation,
    }));
}

function buildNextActions(issues) {
  const deduped = [];
  const seen = new Set();
  for (const issue of issues) {
    if (!issue.remediation || seen.has(issue.remediation)) {
      continue;
    }
    seen.add(issue.remediation);
    deduped.push(issue.remediation);
  }
  return deduped.length > 0
    ? deduped
    : ["No action required. Environment is ready for PairSlash Phase 4 diagnostics."];
}

function aggregateVerdict(checks) {
  if (checks.some((check) => check.status === "fail")) {
    return "fail";
  }
  if (checks.some((check) => check.status === "warn" && DEGRADED_CHECKS.has(check.id))) {
    return "degraded";
  }
  if (checks.some((check) => check.status === "warn")) {
    return "warn";
  }
  return "pass";
}

function buildEnvironmentSummary(context) {
  return {
    os: process.platform,
    shell: context.shell,
    cwd: process.cwd(),
    repo_root: context.repoRoot,
    config_home: context.configHome,
    install_root: context.installRoot,
    state_path: context.statePath,
    runtime_executable: context.detection.executable ?? null,
    runtime_version: context.detection.version ?? null,
    runtime_available: Boolean(context.detection.available),
  };
}

export function runDoctor({
  repoRoot,
  runtime,
  target = "repo",
  packs = [],
  _adapter_override = null,
  _runtime_selection_override = null,
}) {
  const context = buildBaseContext({
    repoRoot,
    runtime,
    target,
    packs,
    adapterOverride: _adapter_override,
    runtimeSelectionOverride: _runtime_selection_override,
  });
  const checks = CHECKS.map((check) => check(context));
  const issues = buildIssues(checks);
  const report = {
    kind: "doctor-report",
    schema_version: DOCTOR_REPORT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    runtime: context.runtime,
    target: context.target,
    support_verdict: aggregateVerdict(checks),
    environment_summary: buildEnvironmentSummary(context),
    runtime_compatibility: buildRuntimeCompatibility(context, checks),
    checks,
    issues,
    next_actions: buildNextActions(issues),
    installed_packs: buildInstalledPacks(context.state),
  };
  const errors = validateDoctorReport(report);
  if (errors.length > 0) {
    throw new Error(`invalid doctor report :: ${errors.join("; ")}`);
  }
  if (!SUPPORT_VERDICTS.includes(report.support_verdict)) {
    throw new Error(`unsupported verdict emitted: ${report.support_verdict}`);
  }
  return report;
}
