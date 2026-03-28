import { satisfiesRuntimeRange } from "@pairslash/spec-core";

const PILOT_LANES = [
  {
    runtime: "codex_cli",
    target: "repo",
    os: "darwin",
    lane_status: "supported",
    tested_version_range: "0.116.0",
    evidence_source:
      "docs/compatibility/compatibility-matrix.md; docs/runtime-mapping/pilot-acceptance.md; .pairslash/project-memory/60-architecture-decisions/phase-0-codex-cli-verification-on-v0-116-0.yaml",
    summary: "macOS Codex repo scope is the primary stable-tested compatibility lane.",
  },
  {
    runtime: "copilot_cli",
    target: "user",
    os: "linux",
    lane_status: "supported",
    tested_version_range: null,
    evidence_source: "docs/compatibility/compatibility-matrix.md; docs/runtime-mapping/pilot-acceptance.md",
    summary: "Linux Copilot user scope is the secondary compatibility lane and remains degraded until live runtime evidence is tightened.",
  },
];

export function resolveSupportLane({ runtime, target, os, runtimeVersion = null, runtimeAvailable = false }) {
  if (!["win32", "linux", "darwin"].includes(os)) {
    return {
      os,
      runtime,
      target,
      lane_status: "unsupported",
      tested_range_status: "unsupported",
      tested_version_range: null,
      evidence_source: "docs/compatibility/compatibility-matrix.md",
      blocking_for_install: true,
      summary: `Operating system ${os} is outside the documented PairSlash compatibility lanes.`,
    };
  }

  if (os === "win32") {
    return {
      os,
      runtime,
      target,
      lane_status: "prep",
      tested_range_status: "prep_lane",
      tested_version_range: null,
      evidence_source: "docs/compatibility/compatibility-matrix.md; docs/runtime-mapping/pilot-acceptance.md",
      blocking_for_install: false,
      summary: "Windows is a prep lane: doctor and preview are expected, but live install evidence is still pending.",
    };
  }

  const matchedLane = PILOT_LANES.find(
    (lane) => lane.runtime === runtime && lane.target === target && lane.os === os,
  );

  if (!matchedLane) {
    return {
      os,
      runtime,
      target,
      lane_status: "unverified",
      tested_range_status: "unrecorded",
      tested_version_range: null,
      evidence_source:
        "docs/compatibility/compatibility-matrix.md; docs/runtime-mapping/pilot-acceptance.md; docs/compatibility/runtime-surface-matrix.yaml",
      blocking_for_install: false,
      summary: "This runtime/target/OS combination is supported by product intent but does not have a recorded pilot lane yet.",
    };
  }

  let testedRangeStatus = "unrecorded";
  if (matchedLane.tested_version_range) {
    if (runtimeAvailable && runtimeVersion && runtimeVersion !== "unknown") {
      testedRangeStatus = satisfiesRuntimeRange(runtimeVersion, matchedLane.tested_version_range)
        ? "recorded"
        : "outside_recorded";
    }
  }

  return {
    os,
    runtime,
    target,
    lane_status: matchedLane.lane_status,
    tested_range_status: testedRangeStatus,
    tested_version_range: matchedLane.tested_version_range,
    evidence_source: matchedLane.evidence_source,
    blocking_for_install: false,
    summary: matchedLane.summary,
  };
}
