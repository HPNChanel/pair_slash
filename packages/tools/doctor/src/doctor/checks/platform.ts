import {
  createCheckResult,
  safeStat,
} from "../helpers.ts";

export function runSupportLane(context: any) {
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

export function runPlatformSupport(context: any) {
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

export function runShellProfileCandidates(context: any) {
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
    if (stat.ok && stat.stat?.isDirectory()) {
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
