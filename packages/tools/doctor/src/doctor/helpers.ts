import {
  resolveSupportLane,
} from "../support-lane.ts";
import {
  buildReviewRemediationAction,
  collectLifecycleReasonCodes,
  dedupeRemediationActions,
  detectRuntimeSelection,
  loadStateForDoctor,
  resolveStatePath,
} from "@pairslash/installer";
import * as codexAdapter from "@pairslash/runtime-codex-adapter";
import * as copilotAdapter from "@pairslash/runtime-copilot-adapter";
import {
  SUPPORTED_RUNTIMES,
  SUPPORTED_TARGETS,
  WORKFLOW_MATURITY_STRENGTH_ORDER,
  exists,
  loadPackCatalogRecords,
  loadPackManifestRecords,
  normalizeEmitMode,
  normalizeRuntime,
  normalizeSkillRoot,
  normalizeTarget,
  readFileNormalized,
  selectDefaultCatalogPack,
  selectPackManifestRecords,
  sha256,
} from "@pairslash/spec-core";
import {
  spawnSync,
} from "node:child_process";
import {
  accessSync,
  constants as fsConstants,
  readdirSync,
  statSync,
} from "node:fs";
import {
  dirname,
  join,
  resolve,
} from "node:path";
import process from "node:process";

export const ISSUE_STATUSES = new Set(["warn", "degraded", "fail", "unsupported"]);

export const REASON_CODE_INSTALL_STATE_INVALID = "install-state-invalid";

export const REASON_CODE_INSTALL_STATE_METADATA_MISMATCH = "install-state-metadata-mismatch";

export const REASON_CODE_MANAGED_PACK_REQUIRES_UPDATE = "managed-pack-requires-update";

export const REASON_CODE_RECONCILE_IDENTICAL = "reconcile-unmanaged-identical";

export const REASON_CODE_RECONCILE_OVERRIDE = "reconcile-unmanaged-override-preserved";

export const REASON_CODE_UNMANAGED_CONFLICT = "unmanaged-conflict-blocking";

export const REASON_CODE_MANAGED_OVERRIDE = "managed-override-preserved";

export const REASON_CODE_MANAGED_ORPHAN_OVERRIDE = "managed-orphan-override-preserved";

export const REASON_CODE_UNINSTALL_PRESERVE_UNMANAGED = "uninstall-preserve-unmanaged";

export const REASON_CODE_OWNERSHIP_METADATA_CONFLICT = "ownership-metadata-conflict";

export const REMEDIATION_STATUS_NONE = "none";

export const REMEDIATION_STATUS_ADVISORY = "advisory";

export const REMEDIATION_STATUS_BLOCKED = "blocked";

export const REMEDIATION_DECISION_REPAIR = "repair";

export const REMEDIATION_DECISION_RECONCILE = "reconcile";

export const REMEDIATION_DECISION_ABORT = "abort";

export function workflowMaturityRank(level) {
  if (typeof level !== "string") {
    return WORKFLOW_MATURITY_STRENGTH_ORDER.canary;
  }
  return WORKFLOW_MATURITY_STRENGTH_ORDER[level] ?? WORKFLOW_MATURITY_STRENGTH_ORDER.canary;
}

export function getAdapter(runtime) {
  const normalized = normalizeRuntime(runtime);
  return normalized === "codex_cli" ? codexAdapter : copilotAdapter;
}

export function inferSeverity(status) {
  if (status === "fail" || status === "unsupported") {
    return "fail";
  }
  if (status === "warn" || status === "degraded") {
    return "warn";
  }
  return "info";
}

export function buildIssueCode(checkId) {
  return `DOC-${checkId.replace(/\./g, "-").toUpperCase()}`;
}

export function buildStateReviewAction({ runtime, target, statePath, preferred = false }) {
  return buildReviewRemediationAction({
    actionId: `review-state:${runtime}:${target}`,
    summary: "Review and repair or remove the stale PairSlash install-state file before retrying.",
    path: statePath,
    appliesToActions: ["doctor", "install", "update", "uninstall"],
    reasonCodes: [REASON_CODE_INSTALL_STATE_INVALID, REASON_CODE_INSTALL_STATE_METADATA_MISMATCH],
    preferred,
  });
}

export function createCheckResult({
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
  reasonCodes = [],
  remediationActions = [],
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
    reason_codes: collectLifecycleReasonCodes({
      reasonCodes,
    }),
    remediation_actions: dedupeRemediationActions(remediationActions),
  };
}

export function findExistingParentPath(path) {
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

export function parseSimpleCommand(command) {
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

export function isCurrentNodeVersionCheck(parsed) {
  if (!parsed) {
    return false;
  }
  const file = parsed.file.toLowerCase();
  if (file !== "node" && file !== "node.exe") {
    return false;
  }
  return parsed.args.length === 1 && ["--version", "-v"].includes(parsed.args[0]);
}

export function runCheckCommand(command) {
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

export function detectShellName(shellOverride = null) {
  const raw = shellOverride ?? process.env.SHELL ?? process.env.ComSpec ?? process.env.TERM_PROGRAM ?? "unknown";
  return raw.toLowerCase();
}

export function detectShellProfileCandidates(shell, homeRootOverride = null) {
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

export function safeStat(path) {
  try {
    return { ok: true, stat: statSync(path) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function isWritablePath(path) {
  try {
    accessSync(path, fsConstants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function safeDigest(path) {
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

export function hasRepoMarkers(repoRoot) {
  return [".git", "packs", "package.json"].some((entry) => exists(join(repoRoot, entry)));
}

export function listInstallRootEntries(installRoot) {
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

export function summarizeScopeProbeIssue(code, summary, suggestedFix, blockingForInstall) {
  return {
    code,
    summary,
    suggested_fix: suggestedFix,
    blocking_for_install: blockingForInstall,
  };
}

export function pickScopeVerdict(current, candidate) {
  const order = ["pass", "warn", "degraded", "fail", "unsupported"];
  return order.indexOf(candidate) > order.indexOf(current) ? candidate : current;
}

export function buildScopeProbe({ repoRoot, runtime, target, adapter, selectedTarget, skillRoot = "runtime-default", emit = "skill" }) {
  const pluginLane = emit === "plugin";
  const configHome = adapter.resolveConfigHome({ repoRoot, target, skillRoot });
  // Plugin emit mode has repo-scope file placement only; user scope is owned
  // by the runtime's plugin commands (PairSlash never writes plugin caches).
  const installRoot = pluginLane
    ? target === "repo"
      ? adapter.resolvePluginRoot({ repoRoot, target })
      : null
    : adapter.resolveInstallRoot({ repoRoot, target, skillRoot });
  const statePath = resolveStatePath({ repoRoot, runtime, target, skillRoot, emit });
  const selected = target === selectedTarget;
  let verdict = "pass";
  const issues = [];

  if (pluginLane && target !== "repo") {
    verdict = pickScopeVerdict(verdict, selected ? "unsupported" : "warn");
    issues.push(
      summarizeScopeProbeIssue(
        `scope.${target}.plugin_scope`,
        "Plugin emit mode places files only at repo scope; user-scope plugin install goes through the runtime's plugin commands.",
        "Use --emit plugin --target repo, or the runtime's plugin surface for user scope.",
        selected,
      ),
    );
  }

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

  const installRootStat = installRoot ? safeStat(installRoot) : null;
  if (installRoot && exists(installRoot) && (!installRootStat.ok || !installRootStat.stat.isDirectory())) {
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
    installRoot ? findExistingParentPath(installRoot) : null,
    findExistingParentPath(dirname(statePath)),
  ].filter(Boolean))];
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

export function resolveDoctorRuntime(requestedRuntime, repoRoot, target, runtimeSelectionOverride = null, skillRoot = "runtime-default", emit = "skill") {
  if (runtimeSelectionOverride) {
    return normalizeRuntime(runtimeSelectionOverride);
  }
  const normalized = normalizeRuntime(requestedRuntime);
  if (normalized && normalized !== "auto") {
    return normalized;
  }

  const stateCandidates = SUPPORTED_RUNTIMES.filter((runtime) =>
    exists(resolveStatePath({ repoRoot, runtime, target, skillRoot, emit })),
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

export function buildBaseContext({
  repoRoot,
  runtime,
  target = "repo",
  packs = [],
  skillRoot = "runtime-default",
  emit = "skill",
  adapterOverride = null,
  runtimeSelectionOverride = null,
  osOverride = null,
  shellOverride = null,
  cwdOverride = null,
}) {
  const normalizedTarget = normalizeTarget(target);
  const normalizedEmit = normalizeEmitMode(emit);
  const normalizedSkillRoot =
    normalizedEmit === "plugin" ? "runtime-default" : normalizeSkillRoot(skillRoot);
  const normalizedRuntime = resolveDoctorRuntime(
    runtime,
    repoRoot,
    normalizedTarget,
    runtimeSelectionOverride,
    normalizedSkillRoot,
    normalizedEmit,
  );
  const adapter = adapterOverride ?? getAdapter(normalizedRuntime);
  const catalogRecords = loadPackCatalogRecords(repoRoot, { includeAdvanced: false });
  const runtimePresence = Object.fromEntries(
    SUPPORTED_RUNTIMES.map((supportedRuntime) => {
      if (supportedRuntime === normalizedRuntime) {
        return [supportedRuntime, adapter.detectRuntime()];
      }
      return [supportedRuntime, getAdapter(supportedRuntime).detectRuntime()];
    }),
  );
  const requestedPacks = [...new Set(packs)].sort((left: any, right: any) => left.localeCompare(right));
  const manifestRecords = loadPackManifestRecords(repoRoot);
  const manifestSelection = selectPackManifestRecords(manifestRecords, requestedPacks);
  const defaultCatalogRecord = selectDefaultCatalogPack(catalogRecords);
  const installIntentPacks = requestedPacks.length > 0
    ? [...requestedPacks]
    : defaultCatalogRecord
      ? [defaultCatalogRecord.id]
      : [];
  const os = osOverride ?? process.platform;
  const shell = detectShellName(shellOverride);
  const statePath = resolveStatePath({
    repoRoot,
    runtime: normalizedRuntime,
    target: normalizedTarget,
    skillRoot: normalizedSkillRoot,
    emit: normalizedEmit,
  });

  let state = null;
  let stateError = null;
  const stateFileExists = exists(statePath);
  try {
    state = loadStateForDoctor({
      repoRoot,
      runtime: normalizedRuntime,
      target: normalizedTarget,
      skillRoot: normalizedSkillRoot,
      emit: normalizedEmit,
    }).state;
  } catch (error) {
    stateError = error.message;
  }

  const detection = runtimePresence[normalizedRuntime];
  const supportLane = resolveSupportLane({
    repoRoot,
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
    installIntentPacks,
    adapter,
    runtimePresence,
    detection,
    supportLane,
    skillRoot: normalizedSkillRoot,
    emit: normalizedEmit,
    configHome: adapter.resolveConfigHome({ repoRoot, target: normalizedTarget, skillRoot: normalizedSkillRoot }),
    installRoot:
      normalizedEmit === "plugin"
        ? normalizedTarget === "repo"
          ? adapter.resolvePluginRoot({ repoRoot, target: normalizedTarget })
          : null
        : adapter.resolveInstallRoot({ repoRoot, target: normalizedTarget, skillRoot: normalizedSkillRoot }),
    statePath,
    stateFileExists,
    state,
    stateError,
    shell,
    shellProfileCandidates: detectShellProfileCandidates(shell),
    catalogRecords,
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
          skillRoot: normalizedSkillRoot,
          emit: normalizedEmit,
        }),
      ]),
    ),
  };
}
