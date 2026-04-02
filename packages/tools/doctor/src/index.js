import { accessSync, constants as fsConstants, readdirSync, statSync } from "node:fs";
import process from "node:process";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import {
  detectRuntimeSelection,
  loadStateForDoctor,
  planUpdate,
  resolveStatePath,
  satisfiesRuntimeRange,
} from "@pairslash/installer";
import {
  DOCTOR_REPORT_SCHEMA_VERSION,
  SUPPORT_VERDICTS,
  SUPPORTED_TARGETS,
  SUPPORTED_RUNTIMES,
  exists,
  loadPackManifestRecords,
  normalizeRuntime,
  normalizeTarget,
  readFileNormalized,
  relativeFrom,
  selectPackManifestRecords,
  sha256,
  validateDoctorReport,
} from "@pairslash/spec-core";
import * as codexAdapter from "@pairslash/runtime-codex-adapter";
import * as copilotAdapter from "@pairslash/runtime-copilot-adapter";
import {
  listTraceIndexes,
  loadRetentionState,
  resolveRetentionPolicy,
  resolveTelemetryMode,
  resolveTraceRoot,
} from "@pairslash/trace";
import { resolveSupportLane } from "./support-lane.js";

const ISSUE_STATUSES = new Set(["warn", "degraded", "fail", "unsupported"]);

function getAdapter(runtime) {
  const normalized = normalizeRuntime(runtime);
  return normalized === "codex_cli" ? codexAdapter : copilotAdapter;
}

function inferSeverity(status) {
  if (status === "fail" || status === "unsupported") {
    return "fail";
  }
  if (status === "warn" || status === "degraded") {
    return "warn";
  }
  return "info";
}

function buildIssueCode(checkId) {
  return `DOC-${checkId.replace(/\./g, "-").toUpperCase()}`;
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
  blockingForInstall = false,
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
    blocking_for_install: blockingForInstall,
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

function parseSimpleCommand(command) {
  if (typeof command !== "string" || command.trim() === "") {
    return null;
  }
  if (/[\"'`|&;<>$()]/.test(command)) {
    return null;
  }
  const tokens = command.trim().split(/\s+/);
  if (tokens.length === 0) {
    return null;
  }
  return {
    file: tokens[0],
    args: tokens.slice(1),
  };
}

function isCurrentNodeVersionCheck(parsed) {
  if (!parsed) {
    return false;
  }
  const file = parsed.file.toLowerCase();
  if (file !== "node" && file !== "node.exe") {
    return false;
  }
  return parsed.args.length === 1 && ["--version", "-v"].includes(parsed.args[0]);
}

function runCheckCommand(command) {
  const parsed = parseSimpleCommand(command);
  if (isCurrentNodeVersionCheck(parsed)) {
    return {
      status: 0,
      stdout: `${process.version}\n`,
      stderr: "",
      error: null,
    };
  }
  if (parsed) {
    return spawnSync(parsed.file, parsed.args, {
      encoding: "utf8",
    });
  }
  return spawnSync(command, {
    shell: true,
    encoding: "utf8",
  });
}

function detectShellName(shellOverride = null) {
  const raw = shellOverride ?? process.env.SHELL ?? process.env.ComSpec ?? process.env.TERM_PROGRAM ?? "unknown";
  return raw.toLowerCase();
}

function detectShellProfileCandidates(shell, homeRootOverride = null) {
  const homeRoot = homeRootOverride ?? process.env.USERPROFILE ?? process.env.HOME ?? null;
  if (!homeRoot) {
    return [];
  }
  if (shell.includes("pwsh") || shell.includes("powershell")) {
    return [
      join(homeRoot, "Documents", "PowerShell", "Microsoft.PowerShell_profile.ps1"),
      join(homeRoot, "Documents", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1"),
    ];
  }
  if (shell.includes("zsh")) {
    return [join(homeRoot, ".zshrc"), join(homeRoot, ".zprofile")];
  }
  if (shell.includes("bash")) {
    return [join(homeRoot, ".bashrc"), join(homeRoot, ".bash_profile"), join(homeRoot, ".profile")];
  }
  if (shell === "sh" || shell.endsWith("/sh") || shell.endsWith("\\sh") || shell.endsWith("sh.exe")) {
    return [join(homeRoot, ".profile")];
  }
  return [];
}

function safeStat(path) {
  try {
    return { ok: true, stat: statSync(path) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function isWritablePath(path) {
  try {
    accessSync(path, fsConstants.W_OK);
    return true;
  } catch {
    return false;
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

function summarizeScopeProbeIssue(code, summary, suggestedFix, blockingForInstall) {
  return {
    code,
    summary,
    suggested_fix: suggestedFix,
    blocking_for_install: blockingForInstall,
  };
}

function pickScopeVerdict(current, candidate) {
  const order = ["pass", "warn", "degraded", "fail", "unsupported"];
  return order.indexOf(candidate) > order.indexOf(current) ? candidate : current;
}

function buildScopeProbe({ repoRoot, runtime, target, adapter, selectedTarget }) {
  const configHome = adapter.resolveConfigHome({ repoRoot, target });
  const installRoot = adapter.resolveInstallRoot({ repoRoot, target });
  const statePath = resolveStatePath({ repoRoot, runtime, target });
  const selected = target === selectedTarget;
  let verdict = "pass";
  const issues = [];

  const configHomeStat = safeStat(configHome);
  if (exists(configHome) && (!configHomeStat.ok || !configHomeStat.stat.isDirectory())) {
    const issueVerdict = selected ? "fail" : "warn";
    verdict = pickScopeVerdict(verdict, issueVerdict);
    issues.push(
      summarizeScopeProbeIssue(
        `scope.${target}.config_home`,
        `Config home ${configHome} exists but is not a directory.`,
        "Remove the blocking file or fix the runtime config-home path.",
        selected,
      ),
    );
  }

  const installRootStat = safeStat(installRoot);
  if (exists(installRoot) && (!installRootStat.ok || !installRootStat.stat.isDirectory())) {
    const issueVerdict = selected ? "fail" : "warn";
    verdict = pickScopeVerdict(verdict, issueVerdict);
    issues.push(
      summarizeScopeProbeIssue(
        `scope.${target}.install_root`,
        `Install root ${installRoot} exists but is not a directory.`,
        "Remove the conflicting file so the runtime install root can be created as a directory.",
        selected,
      ),
    );
  }

  const writableTargets = [...new Set([
    findExistingParentPath(configHome),
    findExistingParentPath(installRoot),
    findExistingParentPath(dirname(statePath)),
  ])];
  const writeFailures = writableTargets
    .map((path) => ({ path, result: adapter.checkWritablePath(path) }))
    .filter((entry) => !entry.result.writable);

  if (writeFailures.length > 0) {
    const issueVerdict = selected ? "fail" : "warn";
    verdict = pickScopeVerdict(verdict, issueVerdict);
    issues.push(
      summarizeScopeProbeIssue(
        `scope.${target}.write_permission`,
        `${writeFailures.length} required path(s) for ${target} scope are not writable.`,
        "Fix filesystem permissions or choose the other target scope before install.",
        selected,
      ),
    );
  }

  return {
    target,
    selected,
    config_home: configHome,
    install_root: installRoot,
    state_path: statePath,
    config_home_exists: exists(configHome),
    install_root_exists: exists(installRoot),
    writable: writeFailures.length === 0,
    verdict,
    blocking_for_install: issues.some((issue) => issue.blocking_for_install),
    issue_codes: issues.map((issue) => issue.code),
    issues,
  };
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
  osOverride = null,
  shellOverride = null,
  cwdOverride = null,
}) {
  const normalizedTarget = normalizeTarget(target);
  const normalizedRuntime = resolveDoctorRuntime(
    runtime,
    repoRoot,
    normalizedTarget,
    runtimeSelectionOverride,
  );
  const adapter = adapterOverride ?? getAdapter(normalizedRuntime);
  const runtimePresence = Object.fromEntries(
    SUPPORTED_RUNTIMES.map((supportedRuntime) => {
      if (supportedRuntime === normalizedRuntime) {
        return [supportedRuntime, adapter.detectRuntime()];
      }
      return [supportedRuntime, getAdapter(supportedRuntime).detectRuntime()];
    }),
  );
  const requestedPacks = [...new Set(packs)].sort((left, right) => left.localeCompare(right));
  const manifestRecords = loadPackManifestRecords(repoRoot);
  const manifestSelection = selectPackManifestRecords(manifestRecords, requestedPacks);
  const os = osOverride ?? process.platform;
  const shell = detectShellName(shellOverride);
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

  const detection = runtimePresence[normalizedRuntime];
  const supportLane = resolveSupportLane({
    runtime: normalizedRuntime,
    target: normalizedTarget,
    os,
    runtimeVersion: detection.version,
    runtimeAvailable: Boolean(detection.available),
  });

  return {
    os,
    cwd: cwdOverride ?? process.cwd(),
    repoRoot,
    runtime: normalizedRuntime,
    target: normalizedTarget,
    requestedPacks,
    adapter,
    runtimePresence,
    detection,
    supportLane,
    configHome: adapter.resolveConfigHome({ repoRoot, target: normalizedTarget }),
    installRoot: adapter.resolveInstallRoot({ repoRoot, target: normalizedTarget }),
    statePath,
    stateFileExists,
    state,
    stateError,
    shell,
    shellProfileCandidates: detectShellProfileCandidates(shell),
    manifestRecords,
    selectedManifests: manifestSelection.valid,
    invalidSelectedManifests: manifestSelection.invalid,
    missingRequestedPacks: manifestSelection.missing,
    scopeProbes: Object.fromEntries(
      SUPPORTED_TARGETS.map((supportedTarget) => [
        supportedTarget,
        buildScopeProbe({
          repoRoot,
          runtime: normalizedRuntime,
          target: supportedTarget,
          adapter,
          selectedTarget: normalizedTarget,
        }),
      ]),
    ),
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
    blockingForInstall: true,
  });
}

function runRuntimePresenceMatrix(context) {
  const presence = Object.fromEntries(
    SUPPORTED_RUNTIMES.map((runtime) => [
      runtime,
      {
        available: Boolean(context.runtimePresence[runtime]?.available),
        executable: context.runtimePresence[runtime]?.executable ?? null,
        version: context.runtimePresence[runtime]?.version ?? null,
        error: context.runtimePresence[runtime]?.error ?? null,
      },
    ]),
  );
  const detected = Object.entries(presence)
    .filter((entry) => entry[1].available)
    .map((entry) => entry[0])
    .sort((left, right) => left.localeCompare(right));
  return createCheckResult({
    id: "runtime.presence_matrix",
    group: "runtime",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary:
      detected.length > 0
        ? `detected runtime(s): ${detected.join(", ")}`
        : "no supported runtime detected in PATH",
    evidence: {
      runtimes: presence,
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
      blockingForInstall: true,
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

function runRuntimeTestedRange(context) {
  if (!context.detection.available) {
    return createCheckResult({
      id: "runtime.tested_range",
      group: "runtime",
      status: "skip",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "skipped because runtime is unavailable",
      evidence: {},
    });
  }

  if (
    context.supportLane.lane_status === "unsupported" ||
    context.supportLane.tested_range_status === "unsupported" ||
    context.supportLane.tested_range_status === "prep_lane"
  ) {
    return createCheckResult({
      id: "runtime.tested_range",
      group: "runtime",
      status: "skip",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "skipped because no tested runtime range is recorded for this support lane",
      evidence: {
        lane_status: context.supportLane.lane_status,
        tested_range_status: context.supportLane.tested_range_status,
      },
    });
  }

  if (!context.supportLane.tested_version_range) {
    return createCheckResult({
      id: "runtime.tested_range",
      group: "runtime",
      status: "warn",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "no recorded tested runtime version exists for this lane yet",
      remediation: "Proceed with preview/doctor evidence, but treat the lane as unrecorded until live pilot evidence is captured.",
      evidence: {
        lane_status: context.supportLane.lane_status,
        runtime_version: context.detection.version,
      },
    });
  }

  if (context.supportLane.tested_range_status === "recorded") {
    return createCheckResult({
      id: "runtime.tested_range",
      group: "runtime",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `runtime version ${context.detection.version} matches recorded pilot evidence`,
      evidence: {
        runtime_version: context.detection.version,
        tested_version_range: context.supportLane.tested_version_range,
      },
    });
  }

  return createCheckResult({
    id: "runtime.tested_range",
    group: "runtime",
    status: "degraded",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary: `runtime version ${context.detection.version} is outside recorded pilot evidence ${context.supportLane.tested_version_range}`,
    remediation: "Prefer a recorded pilot version when you need support-grade evidence, or capture new live validation before broad rollout.",
    evidence: {
      runtime_version: context.detection.version,
      tested_version_range: context.supportLane.tested_version_range,
    },
  });
}

function runSupportLane(context) {
  const lane = context.supportLane;
  const status =
    lane.lane_status === "supported"
      ? "pass"
      : lane.lane_status === "unverified"
        ? "warn"
        : lane.lane_status === "prep"
          ? "degraded"
          : "unsupported";
  return createCheckResult({
    id: "platform.support_lane",
    group: "platform",
    status,
    runtime: context.runtime,
    target: context.target,
    inputs: {
      os: lane.os,
      runtime: lane.runtime,
      target: lane.target,
    },
    summary: lane.summary,
    remediation:
      lane.lane_status === "supported"
        ? null
        : lane.lane_status === "unverified"
          ? "Use the lane for local validation, but collect live pilot evidence before claiming support."
          : lane.lane_status === "prep"
            ? "Use doctor and preview on Windows, but keep install support claims in prep status until live runtime evidence is recorded."
            : "Run PairSlash from Windows, Linux, or macOS within a documented compatibility lane.",
    evidence: {
      lane_status: lane.lane_status,
      tested_range_status: lane.tested_range_status,
      evidence_source: lane.evidence_source,
      tested_version_range: lane.tested_version_range,
    },
    blockingForInstall: lane.blocking_for_install,
  });
}

function runPlatformSupport(context) {
  const knownShells = ["powershell", "pwsh", "cmd", "bash", "zsh", "sh"];
  if (!["win32", "linux", "darwin"].includes(context.os)) {
    return createCheckResult({
      id: "platform.os_shell_support",
      group: "platform",
      status: "skip",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        os: context.os,
        shell: context.shell,
      },
      summary: "skipped because support-lane evaluation already marked the OS unsupported",
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
        os: context.os,
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
        os: context.os,
        shell: context.shell,
      },
      summary: `platform ${context.os} with shell ${context.shell} is recognized`,
      evidence: {},
    });
}

function runShellProfileCandidates(context) {
  if (context.shell.includes("cmd")) {
    return createCheckResult({
      id: "platform.shell_profile_candidates",
      group: "platform",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        shell: context.shell,
      },
      summary: "cmd.exe does not use a standard file-based shell profile",
      evidence: {
        candidates: [],
      },
    });
  }
  const profileIssues = [];
  for (const candidate of context.shellProfileCandidates) {
    const stat = safeStat(candidate);
    if (stat.ok && stat.stat.isDirectory()) {
      profileIssues.push({
        path: candidate,
        reason: "profile path resolves to a directory",
      });
    }
  }
  if (profileIssues.length > 0) {
    return createCheckResult({
      id: "platform.shell_profile_candidates",
      group: "platform",
      status: "warn",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        shell: context.shell,
      },
      summary: `${profileIssues.length} shell profile candidate(s) are unusable`,
      remediation: "Fix or remove the invalid profile path before relying on shell-based runtime setup.",
      evidence: {
        candidates: context.shellProfileCandidates,
        profile_issues: profileIssues,
      },
    });
  }
  if (context.shellProfileCandidates.length > 0) {
    return createCheckResult({
      id: "platform.shell_profile_candidates",
      group: "platform",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        shell: context.shell,
      },
      summary: `detected ${context.shellProfileCandidates.length} shell profile candidate(s)`,
      evidence: {
        candidates: context.shellProfileCandidates,
      },
    });
  }
  return createCheckResult({
    id: "platform.shell_profile_candidates",
    group: "platform",
    status: "warn",
    runtime: context.runtime,
    target: context.target,
    inputs: {
      shell: context.shell,
    },
    summary: `no known shell profile candidates for ${context.shell}`,
    remediation: "Use a supported shell profile path manually if you need to preload runtime environment variables.",
    evidence: {
      candidates: [],
    },
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
      blockingForInstall: true,
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
      blockingForInstall: true,
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
      blockingForInstall: true,
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
      blockingForInstall: true,
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
  const invalid =
    context.requestedPacks.length > 0
      ? context.invalidSelectedManifests
      : context.manifestRecords.filter((record) => record.error);
  const normalizationWarnings = context.selectedManifests.flatMap((record) =>
    (record.normalizationWarnings ?? []).map((warning) => ({
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
        invalid: invalid.map((record) => ({
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
      remediation: "Rewrite legacy manifests using canonical pack.manifest.yaml v2.1.0 fields.",
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
      const result = runCheckCommand(tool.check_command);
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
      blockingForInstall: true,
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
      blockingForInstall: true,
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
      blockingForInstall: true,
    });
  }
  if (warnings.length > 0) {
    return createCheckResult({
      id: "install_state.owned_files_integrity",
      group: "install_state",
      status: "degraded",
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

function normalizePackTrustReceipt(pack) {
  return (
    pack.trust_receipt ?? {
      source_class: "local-source",
      verification_status: "legacy",
      trust_tier: "local-dev",
      policy_action: "allow",
      signature_status: "missing",
      support_level: "local-dev",
      version_policy: {
        status: "legacy",
        blocking: false,
        summary: "legacy install state without trust receipt",
      },
      summary: "legacy install state without trust receipt",
      reasons: ["legacy-state:missing-trust-receipt"],
    }
  );
}

function runInstalledTrustPosture(context) {
  if (!context.state || context.state.packs.length === 0) {
    return createCheckResult({
      id: "install_state.trust_posture",
      group: "trust",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "no installed packs require trust posture verification yet",
      evidence: {},
    });
  }

  const failures = [];
  const warnings = [];
  for (const pack of context.state.packs) {
    const receipt = normalizePackTrustReceipt(pack);
    const summary = {
      pack_id: pack.id,
      source_class: receipt.source_class,
      verification_status: receipt.verification_status,
      trust_tier: receipt.trust_tier ?? "local-dev",
      signature_status: receipt.signature_status ?? "missing",
      support_level: receipt.support_level ?? "local-dev",
      policy_action: receipt.policy_action,
      summary: receipt.summary,
    };
    if (receipt.policy_action === "deny" || receipt.source_class === "external-unverified") {
      failures.push({
        ...summary,
        reason: "installed pack is not trusted by the local policy",
      });
      continue;
    }
    if (receipt.version_policy?.blocking) {
      failures.push({
        ...summary,
        reason: receipt.version_policy.summary,
      });
      continue;
    }
    if (
      receipt.verification_status === "legacy" ||
      receipt.policy_action === "ask" ||
      receipt.trust_tier === "local-dev" ||
      receipt.trust_tier === "verified-external" ||
      receipt.trust_tier === "first-party-official" ||
      receipt.support_level === "official-preview" ||
      receipt.support_level === "publisher-verified"
    ) {
      warnings.push(summary);
    }
  }

  if (failures.length > 0) {
    return createCheckResult({
      id: "install_state.trust_posture",
      group: "trust",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${failures.length} installed pack(s) violate the local trust policy`,
      remediation: "Reinstall from a trusted release or remove the untrusted pack before applying more updates.",
      evidence: {
        failures,
      },
      blockingForInstall: true,
    });
  }
  if (warnings.length > 0) {
    return createCheckResult({
      id: "install_state.trust_posture",
      group: "trust",
      status: "warn",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${warnings.length} installed pack(s) require trust review or carry non-core support posture`,
      remediation: "Review `doctor --format json` to confirm which packs are local-dev, official-preview, or verified-external.",
      evidence: {
        warnings,
      },
    });
  }
  return createCheckResult({
    id: "install_state.trust_posture",
    group: "trust",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary: "installed packs have release-verified trust receipts",
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
      blockingForInstall: true,
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

function runUpdatePreviewRisk(context) {
  if (!context.state || context.state.packs.length === 0) {
    return createCheckResult({
      id: "install_state.update_preview_risk",
      group: "install_state",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "no installed packs require update-risk analysis yet",
      evidence: {},
    });
  }

  try {
    const envelope = planUpdate({
      repoRoot: context.repoRoot,
      runtime: context.runtime,
      target: context.target,
      packs: context.state.packs.map((pack) => pack.id),
    });
    const blocked = envelope.plan.operations.filter((operation) => operation.kind === "blocked_conflict");
    const preserved = envelope.plan.operations.filter((operation) => operation.kind === "preserve_override");
    if (envelope.plan.errors.length > 0 || blocked.length > 0) {
      return createCheckResult({
        id: "install_state.update_preview_risk",
        group: "install_state",
        status: "fail",
        runtime: context.runtime,
        target: context.target,
        inputs: {},
        summary: "update preview found blocking conflicts or plan errors for the installed footprint",
        remediation: "Run `pairslash update --preview` and resolve blocked conflicts before applying changes.",
        evidence: {
          errors: envelope.plan.errors,
          blocked_conflicts: blocked.map((operation) => ({
            pack_id: operation.pack_id,
            relative_path: operation.relative_path,
            reason: operation.reason,
          })),
        },
        blockingForInstall: true,
      });
    }
    if (preserved.length > 0) {
      return createCheckResult({
        id: "install_state.update_preview_risk",
        group: "install_state",
        status: "degraded",
        runtime: context.runtime,
        target: context.target,
        inputs: {},
        summary: `${preserved.length} local override path(s) would be preserved during update`,
        remediation: "Review preserved overrides with `pairslash update --preview` before updating the pack.",
        evidence: {
          preserved_overrides: preserved.map((operation) => ({
            pack_id: operation.pack_id,
            relative_path: operation.relative_path,
            reason: operation.reason,
          })),
        },
      });
    }
  } catch (error) {
    return createCheckResult({
      id: "install_state.update_preview_risk",
      group: "install_state",
      status: "warn",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "update-risk analysis could not be completed from the current install state",
      remediation: "Rerun `pairslash update --preview` directly after fixing state or manifest issues.",
      evidence: {
        error: error.message,
      },
    });
  }

  return createCheckResult({
    id: "install_state.update_preview_risk",
    group: "install_state",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary: "update preview reports no override-preservation or conflict risk",
    evidence: {},
  });
}

function runAssetPlacement(context) {
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
          reason: error.message,
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

const CHECKS = [
  runRuntimePresenceMatrix,
  runRuntimeDetect,
  runRuntimeVersionRange,
  runRuntimeTestedRange,
  runSupportLane,
  runPlatformSupport,
  runShellProfileCandidates,
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
  runInstalledTrustPosture,
  runOwnedFilesIntegrity,
  runUpdatePreviewRisk,
  runUnmanagedInstallRoot,
  runAssetPlacement,
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
      ...(() => {
        const receipt = normalizePackTrustReceipt(pack);
        return {
          source_class: receipt.source_class,
          verification_status: receipt.verification_status,
          trust_tier: receipt.trust_tier ?? "local-dev",
          signature_status: receipt.signature_status ?? "missing",
          support_level: receipt.support_level ?? "local-dev",
        };
      })(),
      id: pack.id,
      version: pack.version,
      install_dir: pack.install_dir,
      local_overrides: pack.files.filter((file) => file.local_override).length,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function buildIssues(checks) {
  return checks
    .filter((check) => ISSUE_STATUSES.has(check.status))
    .map((check) => ({
      code: buildIssueCode(check.id),
      verdict: check.status,
      severity: check.status === "fail" || check.status === "unsupported" ? "fail" : "warn",
      check_id: check.id,
      summary: check.summary,
      evidence: check.evidence,
      suggested_fix: check.remediation,
      blocking_for_install: check.blocking_for_install,
      message: check.summary,
      remediation: check.remediation,
    }));
}

function buildNextActions(issues) {
  const deduped = [];
  const seen = new Set();
  for (const issue of issues) {
    if (!issue.suggested_fix || seen.has(issue.suggested_fix)) {
      continue;
    }
    seen.add(issue.suggested_fix);
    deduped.push(issue.suggested_fix);
  }
  return deduped.length > 0
    ? deduped
    : ["No action required. Environment is ready for PairSlash compatibility diagnostics."];
}

function aggregateVerdict(checks) {
  if (checks.some((check) => check.status === "unsupported")) {
    return "unsupported";
  }
  if (checks.some((check) => check.status === "fail")) {
    return "fail";
  }
  if (checks.some((check) => check.status === "degraded")) {
    return "degraded";
  }
  if (checks.some((check) => check.status === "warn")) {
    return "warn";
  }
  return "pass";
}

function buildEnvironmentSummary(context) {
  return {
    os: context.os,
    shell: context.shell,
    shell_profile_candidates: context.shellProfileCandidates,
    cwd: context.cwd,
    repo_root: context.repoRoot,
    config_home: context.configHome,
    install_root: context.installRoot,
    state_path: context.statePath,
    runtime_executable: context.detection.executable ?? null,
    runtime_version: context.detection.version ?? null,
    runtime_available: Boolean(context.detection.available),
  };
}

function buildScopeProbes(context) {
  return Object.fromEntries(
    SUPPORTED_TARGETS.map((target) => [
      target,
      {
        ...context.scopeProbes[target],
      },
    ]),
  );
}

function buildObservabilityHealth(repoRoot, runtime, target) {
  const traceRoot = resolveTraceRoot(repoRoot);
  const indexes = listTraceIndexes(repoRoot)
    .filter((entry) => (runtime ? entry.runtime === runtime : true))
    .filter((entry) => (target ? entry.target === target : true));
  const missingEventFiles = indexes.filter((entry) => !exists(entry.event_file)).length;
  const retentionState = loadRetentionState(repoRoot);
  const retentionPolicy = resolveRetentionPolicy(repoRoot);
  const writableProbePath = exists(traceRoot) ? traceRoot : dirname(traceRoot);
  return {
    trace_root_exists: exists(traceRoot),
    trace_root_writable: isWritablePath(writableProbePath),
    index_event_consistent: missingEventFiles === 0,
    missing_event_files: missingEventFiles,
    retention_last_pruned_at: retentionState?.last_pruned_at ?? null,
    retention_policy: retentionPolicy,
  };
}

function buildRecentTraceSummary(repoRoot, runtime, target) {
  const indexes = listTraceIndexes(repoRoot)
    .filter((entry) => (runtime ? entry.runtime === runtime : true))
    .filter((entry) => (target ? entry.target === target : true))
    .sort((left, right) => (right.started_at ?? "").localeCompare(left.started_at ?? ""))
    .slice(0, 5);
  return {
    telemetry_mode: resolveTelemetryMode(repoRoot),
    session_count: indexes.length,
    latest_session_id: indexes[0]?.session_id ?? null,
    latest_outcome: indexes[0]?.last_outcome ?? null,
    latest_failure_domain: indexes[0]?.decisive_failure_domain ?? null,
    retention_last_pruned_at: loadRetentionState(repoRoot)?.last_pruned_at ?? null,
  };
}

function preferredPackId(context) {
  const selectedPackIds = context.selectedManifests.map((record) => record.packId);
  if (selectedPackIds.includes("pairslash-plan")) {
    return "pairslash-plan";
  }
  if (selectedPackIds.length > 0) {
    return selectedPackIds[0];
  }
  const installedPackIds = (context.state?.packs ?? []).map((pack) => pack.id);
  if (installedPackIds.includes("pairslash-plan")) {
    return "pairslash-plan";
  }
  if (installedPackIds.length > 0) {
    return installedPackIds[0];
  }
  const availablePackIds = context.manifestRecords
    .filter((record) => !record.error)
    .map((record) => record.packId)
    .sort((left, right) => left.localeCompare(right));
  if (availablePackIds.includes("pairslash-plan")) {
    return "pairslash-plan";
  }
  return availablePackIds[0] ?? null;
}

function runtimeFlag(runtime) {
  return runtime === "codex_cli" ? "codex" : "copilot";
}

function buildFirstWorkflowGuidance(context, { installBlocked }) {
  const recommendedPackId = preferredPackId(context);
  const doctorCommand = `node packages/tools/cli/src/bin/pairslash.js doctor --runtime ${runtimeFlag(context.runtime)} --target ${context.target}`;

  if (installBlocked) {
    return {
      ready: false,
      recommended_pack_id: recommendedPackId,
      rationale: "Blocking issues must be fixed before install or first workflow execution.",
      commands: [doctorCommand],
    };
  }

  if ((context.state?.packs ?? []).length > 0) {
    return {
      ready: true,
      recommended_pack_id: recommendedPackId,
      rationale: "A managed pack is already installed for this runtime and target.",
      commands: [
        `Launch ${context.detection.executable ?? runtimeFlag(context.runtime)} from the repo root and use /skills to run ${recommendedPackId ?? "the installed pack"}.`,
      ],
    };
  }

  if (recommendedPackId) {
    return {
      ready: false,
      recommended_pack_id: recommendedPackId,
      rationale: "Install the baseline pack first, then enter the runtime through /skills.",
      commands: [
        `node packages/tools/cli/src/bin/pairslash.js preview install ${recommendedPackId} --runtime ${runtimeFlag(context.runtime)} --target ${context.target}`,
        `node packages/tools/cli/src/bin/pairslash.js install ${recommendedPackId} --runtime ${runtimeFlag(context.runtime)} --target ${context.target} --apply --yes`,
        `Launch ${context.detection.executable ?? runtimeFlag(context.runtime)} from the repo root and use /skills to run ${recommendedPackId}.`,
      ],
    };
  }

  return {
    ready: false,
    recommended_pack_id: null,
    rationale: "No valid pack manifest was discovered for this repository yet.",
    commands: [doctorCommand],
  };
}

export function runDoctor({
  repoRoot,
  runtime,
  target = "repo",
  packs = [],
  _adapter_override = null,
  _runtime_selection_override = null,
  _os_override = null,
  _shell_override = null,
  _cwd_override = null,
}) {
  const context = buildBaseContext({
    repoRoot,
    runtime,
    target,
    packs,
    adapterOverride: _adapter_override,
    runtimeSelectionOverride: _runtime_selection_override,
    osOverride: _os_override,
    shellOverride: _shell_override,
    cwdOverride: _cwd_override,
  });
  const checks = CHECKS.map((check) => check(context));
  const issues = buildIssues(checks);
  const installBlocked = checks.some(
    (check) => check.blocking_for_install && ISSUE_STATUSES.has(check.status),
  );
  const report = {
    kind: "doctor-report",
    schema_version: DOCTOR_REPORT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    runtime: context.runtime,
    target: context.target,
    support_verdict: aggregateVerdict(checks),
    install_blocked: installBlocked,
    environment_summary: buildEnvironmentSummary(context),
    scope_probes: buildScopeProbes(context),
    support_lane: { ...context.supportLane },
    runtime_compatibility: buildRuntimeCompatibility(context, checks),
    recent_trace_summary: buildRecentTraceSummary(context.repoRoot, context.runtime, context.target),
    observability_health: buildObservabilityHealth(context.repoRoot, context.runtime, context.target),
    checks,
    issues,
    next_actions: buildNextActions(issues),
    installed_packs: buildInstalledPacks(context.state),
    first_workflow_guidance: buildFirstWorkflowGuidance(context, {
      installBlocked,
    }),
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
