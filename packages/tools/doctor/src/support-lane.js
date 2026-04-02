import {
  findPublicCompatibilityLane,
  hasRecordedLiveTestedRange,
  publicSupportLevelToDoctorLaneStatus,
  satisfiesRuntimeRange,
} from "@pairslash/spec-core";

export function resolveSupportLane({ runtime, target, os, runtimeVersion = null, runtimeAvailable = false }) {
  const publicLane = findPublicCompatibilityLane({ runtime, target, os });

  if (!publicLane && !["win32", "linux", "darwin"].includes(os)) {
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

  if (!publicLane) {
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
  const testedVersionRange = hasRecordedLiveTestedRange(publicLane) ? publicLane.live_tested_range : null;
  if (testedVersionRange) {
    if (runtimeAvailable && runtimeVersion && runtimeVersion !== "unknown") {
      testedRangeStatus = satisfiesRuntimeRange(runtimeVersion, testedVersionRange)
        ? "recorded"
        : "outside_recorded";
    }
  } else if (publicLane.support_level === "prep") {
    testedRangeStatus = "prep_lane";
  }

  return {
    os,
    runtime,
    target,
    lane_status: publicSupportLevelToDoctorLaneStatus(publicLane.support_level),
    tested_range_status: testedRangeStatus,
    tested_version_range: testedVersionRange,
    evidence_source: publicLane.evidence_source,
    blocking_for_install: publicLane.support_level === "known-broken",
    summary: publicLane.support_semantics,
  };
}
