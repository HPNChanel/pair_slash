import {
  satisfiesRuntimeRange,
} from "@pairslash/installer";
import {
  SUPPORTED_RUNTIMES,
  exists,
} from "@pairslash/spec-core";
import {
  readFileSync,
  statSync,
} from "node:fs";
import {
  homedir,
} from "node:os";
import {
  join,
} from "node:path";
import process from "node:process";
import {
  createCheckResult,
} from "../helpers.ts";

export function runRuntimeDetect(context: any) {
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
        detection_path: detection.detection_path ?? null,
        gh_version: detection.gh_version ?? null,
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
        : "Install Copilot CLI and verify `copilot --version` or `gh copilot --version` succeeds.",
    evidence: {
      error: detection.error,
      gh_version: detection.gh_version ?? null,
    },
    blockingForInstall: true,
  });
}

export function surfaceProbeObservations(context: any) {
  const home = homedir();
  const repoRoot = context.repoRoot;
  const candidatePaths = (paths: any) =>
    paths.filter((value: any) => typeof value === "string" && value.length > 0);
  const probeDefinitions =
    context.runtime === "codex_cli"
      ? [
          {
            probe: "codex.config_home",
            description: "Codex config dir (CODEX_HOME or ~/.codex); informational only",
            candidates: candidatePaths([process.env.CODEX_HOME, join(home, ".codex")]),
          },
          {
            probe: "codex.daemon_state",
            description: "Codex app-server/exec-server daemon artifacts; informational only, daemon lifecycle is not probed or managed",
            candidates: candidatePaths([
              join(home, ".codex", "app-server-daemon"),
              join(home, ".codex", "app-server-control"),
              join(home, ".codex", "packages", "app-server-daemon"),
            ]),
          },
          {
            probe: "codex.hooks_config",
            description: "Codex hooks configuration candidates; informational only",
            candidates: candidatePaths([
              join(home, ".codex", "hooks"),
              join(home, ".codex", "hooks.json"),
              join(repoRoot, ".codex", "hooks"),
            ]),
          },
        ]
      : [
          {
            probe: "copilot.config_home",
            description: "Copilot user config dir (~/.copilot); informational only",
            candidates: candidatePaths([join(home, ".copilot")]),
          },
          {
            probe: "copilot.plugin_dirs",
            description: "Copilot plugin directory candidates; informational only",
            candidates: candidatePaths([
              join(home, ".copilot", "plugins"),
              join(home, ".copilot", "extensions"),
              join(repoRoot, ".github", "plugins"),
            ]),
          },
          {
            probe: "copilot.hooks_config",
            description: "Copilot hooks configuration candidates; informational only",
            candidates: candidatePaths([
              join(home, ".copilot", "hooks.json"),
              join(home, ".copilot", "hooks"),
              join(repoRoot, ".github", "hooks"),
            ]),
          },
        ];
  return probeDefinitions
    .map((definition) => {
      const detectedPaths = definition.candidates.filter((path: any) => exists(path)).sort();
      return {
        probe: definition.probe,
        description: definition.description,
        detected: detectedPaths.length > 0,
        paths: detectedPaths,
      };
    })
    .sort((left, right) => left.probe.localeCompare(right.probe));
}

export function runRuntimeSurfaceProbe(context: any) {
  const observations = surfaceProbeObservations(context);
  const detectedCount = observations.filter((observation) => observation.detected).length;
  return createCheckResult({
    id: "runtime.surface_probe",
    group: "runtime",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary: `${detectedCount}/${observations.length} informational surface probe(s) detected artifacts`,
    evidence: {
      informational_only: true,
      affects_verdict: false,
      observations,
    },
  });
}

export const CODEX_DAEMON_ARTIFACT_PATHS = [
  "app-server-control/app-server-control.sock",
  "app-server-daemon",
  "app-server-daemon/app-server-updater.pid",
  "app-server-daemon/app-server.pid",
  "app-server-daemon/settings.json",
  "packages/app-server-daemon",
];

export function codexDaemonPathKind(path: any) {
  try {
    const stat = statSync(path);
    return { kind: stat.isDirectory() ? "dir" : "file" };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return { kind: "missing" };
    }
    return { kind: "error", error: error instanceof Error ? error.message : String(error) };
  }
}

export function readCodexDaemonAutoStart(configPath: any) {
  if (codexDaemonPathKind(configPath).kind !== "file") {
    return { value: "unset", readable: true };
  }
  try {
    const text = readFileSync(configPath, "utf8");
    const section = text.match(/\[daemon\]([\s\S]*?)(?:\r?\n\s*\[|$)/);
    const flag = section ? section[1].match(/auto_start\s*=\s*(true|false)/) : null;
    return { value: flag ? flag[1] : "unset", readable: true };
  } catch {
    return { value: "unset", readable: false };
  }
}

export function readCodexDaemonRecordedPid(pidPath: any) {
  try {
    const parsed = JSON.parse(readFileSync(pidPath, "utf8"));
    return typeof parsed?.pid === "number" ? parsed.pid : null;
  } catch {
    return null;
  }
}

export function runCodexDaemonState(context: any) {
  if (context.runtime !== "codex_cli") {
    return createCheckResult({
      id: "runtime.daemon_state",
      group: "runtime",
      status: "skip",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "codex daemon state check is not applicable to this runtime",
      evidence: {
        informational_only: true,
        affects_verdict: false,
        applicable: false,
        detection_method: "passive-filesystem-artifacts",
      },
    });
  }
  const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");
  const homeKind = codexDaemonPathKind(codexHome);
  const artifacts =
    homeKind.kind === "dir"
      ? CODEX_DAEMON_ARTIFACT_PATHS.map((relativePath) => {
          const observed = codexDaemonPathKind(join(codexHome, relativePath));
          return {
            path: relativePath,
            present: observed.kind === "file" || observed.kind === "dir",
            kind: observed.kind,
          };
        })
      : [];
  const presentCount = artifacts.filter((entry) => entry.present).length;
  const errorCount = artifacts.filter((entry) => entry.kind === "error").length;
  const daemonState =
    homeKind.kind === "dir"
      ? presentCount > 0
        ? "present"
        : errorCount > 0
          ? "undetectable"
          : "absent"
      : homeKind.kind === "missing"
        ? "absent"
        : "undetectable";
  const autoStart =
    homeKind.kind === "dir"
      ? readCodexDaemonAutoStart(join(codexHome, "config.toml"))
      : { value: "unset", readable: true };
  const pidArtifact = artifacts.find(
    (entry) => entry.path === "app-server-daemon/app-server.pid" && entry.present,
  );
  const recordedPid = pidArtifact
    ? readCodexDaemonRecordedPid(join(codexHome, "app-server-daemon", "app-server.pid"))
    : null;
  const interpretation =
    daemonState === "present"
      ? "Codex >=0.157 auto-starts a shared app-server/exec-server; artifacts indicate daemon use. Live state is not probed by design (C.8)."
      : daemonState === "absent" && autoStart.value === "false"
        ? "no daemon artifacts observed and [daemon] auto_start is disabled in config.toml; absence is expected"
        : daemonState === "absent"
          ? "no daemon artifacts observed; no daemon-capable session has run here or auto_start is off"
          : "CODEX_HOME could not be inspected; daemon state could not be determined";
  return createCheckResult({
    id: "runtime.daemon_state",
    group: "runtime",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {
      codex_home: codexHome,
    },
    summary:
      daemonState === "undetectable"
        ? "codex daemon state could not be determined"
        : `codex daemon artifacts ${daemonState} (informational, lifecycle unmanaged)`,
    evidence: {
      informational_only: true,
      affects_verdict: false,
      applicable: true,
      detection_method: "passive-filesystem-artifacts",
      lifecycle_management: "none",
      codex_home: codexHome,
      codex_home_error: homeKind.kind === "error" ? homeKind.error : null,
      daemon_state: daemonState,
      daemon_auto_start: autoStart.value,
      config_readable: autoStart.readable,
      recorded_pid: recordedPid,
      artifacts,
      interpretation,
    },
  });
}

export function readTomlSectionFlag(text: any, section: any, keys: any) {
  const match = text.match(new RegExp(`\\[${section}\\]([\\s\\S]*?)(?:\\r?\\n\\s*\\[|$)`));
  if (!match) {
    return { value: null, key: null };
  }
  for (const key of keys) {
    const flag = match[1].match(new RegExp(`(?:^|\\r?\\n)\\s*${key}\\s*=\\s*(true|false)`));
    if (flag) {
      return { value: flag[1] === "true", key };
    }
  }
  return { value: null, key: null };
}

export function readJsonFlag(path: any, key: any) {
  if (codexDaemonPathKind(path).kind !== "file") {
    return { value: null, readable: true };
  }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return { value: parsed?.[key] === true ? true : parsed?.[key] === false ? false : null, readable: true };
  } catch {
    return { value: null, readable: false };
  }
}

export function codexHooksFeatureFlag(configPaths: any) {
  let decision: any = { value: null, key: null, source_path: null };
  for (const configPath of configPaths) {
    if (codexDaemonPathKind(configPath).kind !== "file") {
      continue;
    }
    try {
      const flag = readTomlSectionFlag(readFileSync(configPath, "utf8"), "features", [
        "hooks",
        "codex_hooks",
      ]);
      if (flag.value !== null) {
        decision = { ...flag, source_path: configPath };
      }
    } catch {
      // Unreadable config layer: skip; state reported as unknown via evidence.
    }
  }
  return decision;
}

export function codexHooksRequirements(requirementsPaths: any) {
  return requirementsPaths.map((requirementsPath: any) => {
    if (codexDaemonPathKind(requirementsPath).kind !== "file") {
      return { path: requirementsPath, present: false };
    }
    try {
      const text = readFileSync(requirementsPath, "utf8");
      const features = readTomlSectionFlag(text, "features", ["hooks"]);
      const managedOnly = /(?:^|\r?\n)\s*allow_managed_hooks_only\s*=\s*true/.test(text);
      return {
        path: requirementsPath,
        present: true,
        hooks_disabled: features.value === false,
        allow_managed_hooks_only: managedOnly,
      };
    } catch {
      return { path: requirementsPath, present: true, unreadable: true };
    }
  });
}

export function runHooksState(context: any) {
  const home = homedir();
  const repoRoot = context.repoRoot;
  if (context.runtime === "codex_cli") {
    const codexHome = process.env.CODEX_HOME || join(home, ".codex");
    const flag = codexHooksFeatureFlag([
      join(codexHome, "config.toml"),
      join(repoRoot, ".codex", "config.toml"),
    ]);
    const requirementsPaths = process.env.PAIRSLASH_DOCTOR_CODEX_REQUIREMENTS
      ? process.env.PAIRSLASH_DOCTOR_CODEX_REQUIREMENTS.split(";").filter(Boolean)
      : process.platform === "win32"
        ? [
            join(
              process.env.ProgramData || "C:\\ProgramData",
              "OpenAI",
              "Codex",
              "requirements.toml",
            ),
          ]
        : ["/etc/codex/requirements.toml"];
    const requirements = codexHooksRequirements(requirementsPaths);
    const managedDisabled = requirements.some((entry: any) => entry.hooks_disabled === true);
    const managedOnly = requirements.some((entry: any) => entry.allow_managed_hooks_only === true);
    const hooksState =
      managedOnly || managedDisabled
        ? "managed-restricted"
        : flag.value === false
          ? "disabled"
          : "enabled";
    const interpretation =
      hooksState === "managed-restricted"
        ? "admin requirements restrict hooks (managed-only or hooks=false); unmanaged hooks incl. PairSlash plugin preflight hooks are skipped"
        : hooksState === "disabled"
          ? "lifecycle hooks disabled via [features] hooks=false; PairSlash advisory preflight hooks will not run"
          : "hooks enabled; unmanaged hooks (incl. PairSlash plugin hooks) are hash-pinned and skipped until reviewed in /hooks";
    return createCheckResult({
      id: "runtime.hooks_state",
      group: "runtime",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        codex_home: codexHome,
      },
      summary: `codex hooks state: ${hooksState} (informational, config read-only)`,
      evidence: {
        informational_only: true,
        affects_verdict: false,
        applicable: true,
        detection_method: "passive-config-artifacts",
        hooks_state: hooksState,
        feature_flag: flag.value === null ? "unset" : flag.value === true ? "enabled" : "disabled",
        feature_flag_key: flag.key,
        feature_flag_deprecated_alias: flag.key === "codex_hooks",
        feature_flag_source: flag.source_path,
        managed_requirements: requirements.filter((entry: any) => entry.present),
        interpretation,
      },
    });
  }
  const copilotHome = process.env.COPILOT_HOME || join(home, ".copilot");
  const userSetting = readJsonFlag(join(copilotHome, "settings.json"), "disableAllHooks");
  const repoSettings = [
    join(repoRoot, ".github", "copilot", "settings.json"),
    join(repoRoot, ".github", "copilot", "settings.local.json"),
  ].map((settingsPath) => ({
    path: settingsPath,
    ...readJsonFlag(settingsPath, "disableAllHooks"),
  }));
  const anyDisabled = userSetting.value === true || repoSettings.some((entry) => entry.value === true);
  const hooksState = anyDisabled
    ? "disabled"
    : userSetting.readable === false || repoSettings.some((entry) => entry.readable === false)
      ? "unknown"
      : "enabled";
  const interpretation =
    hooksState === "disabled"
      ? "disableAllHooks set; PairSlash plugin hooks will not run"
      : hooksState === "unknown"
        ? "a Copilot settings file could not be parsed; hooks state could not be determined"
        : "hooks apply as configured; per-hook enable/disable toggles are temporarily unavailable in current Copilot CLI (removed with the /plugins dashboard)";
  return createCheckResult({
    id: "runtime.hooks_state",
    group: "runtime",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {
      copilot_home: copilotHome,
    },
    summary: `copilot hooks state: ${hooksState} (informational, config read-only)`,
    evidence: {
      informational_only: true,
      affects_verdict: false,
      applicable: true,
      detection_method: "passive-config-artifacts",
      hooks_state: hooksState,
      per_hook_toggles: "unavailable",
      disable_all_hooks: {
        user_settings: userSetting.value,
        repo_settings: repoSettings,
      },
      interpretation,
    },
  });
}

export function runRuntimePresenceMatrix(context: any) {
  const presence = Object.fromEntries(
    SUPPORTED_RUNTIMES.map((runtime) => [
      runtime,
      {
        available: Boolean(context.runtimePresence[runtime]?.available),
        executable: context.runtimePresence[runtime]?.executable ?? null,
        version: context.runtimePresence[runtime]?.version ?? null,
        detection_path: context.runtimePresence[runtime]?.detection_path ?? null,
        error: context.runtimePresence[runtime]?.error ?? null,
      },
    ]),
  );
  const detected = Object.entries(presence)
    .filter((entry) => entry[1].available)
    .map((entry) => entry[0])
    .sort((left: any, right: any) => left.localeCompare(right));
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

export function runRuntimeVersionRange(context: any) {
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

export function runRuntimeTestedRange(context: any) {
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
