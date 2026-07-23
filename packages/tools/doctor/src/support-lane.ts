import {
  findPublicCompatibilityLane,
  hasRecordedLiveTestedRange,
  loadPublicSupportSnapshot,
  publicSupportLevelToDoctorLaneStatus,
  satisfiesRuntimeRange,
} from "@pairslash/spec-core";

export function resolveSupportLane({
  repoRoot,
  runtime,
  target,
  os,
  runtimeVersion = null,
  runtimeAvailable = false,
}) {
  const supportSnapshot = loadPublicSupportSnapshot(repoRoot);
  const publicLane = findPublicCompatibilityLane({
    repoRoot,
    runtime,
    target,
    os,
    snapshot: supportSnapshot,
  });

  if (!publicLane && !["win32", "linux", "darwin"].includes(os)) {
    return {
      os,
      runtime,
      target,
      lane_status: "unsupported",
      claim_status: "blocked",
      tested_range_status: "unsupported",
      tested_version_range: null,
      evidence_source: "docs/compatibility/compatibility-matrix.md; docs/evidence/live-runtime/README.md",
      evidence_data_ref: null,
      canonical_entrypoint: "/skills",
      required_evidence_class: "live_verification",
      actual_evidence_class: null,
      freshness_state: "none-recorded",
      last_verified_at: null,
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
      claim_status: "prep",
      tested_range_status: "unrecorded",
      tested_version_range: null,
      evidence_source:
        "docs/compatibility/compatibility-matrix.md; docs/evidence/live-runtime/README.md; docs/compatibility/runtime-surface-matrix.yaml",
      evidence_data_ref: null,
      canonical_entrypoint: "/skills",
      required_evidence_class: "live_verification",
      actual_evidence_class: null,
      freshness_state: "none-recorded",
      last_verified_at: null,
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
    claim_status: publicLane.support_level,
    tested_range_status: testedRangeStatus,
    tested_version_range: testedVersionRange,
    evidence_source: publicLane.evidence_source,
    evidence_data_ref: publicLane.evidence_data_ref ?? null,
    canonical_entrypoint: publicLane.canonical_entrypoint ?? "/skills",
    required_evidence_class: publicLane.required_evidence_class ?? "live_verification",
    actual_evidence_class: publicLane.actual_evidence_class ?? null,
    freshness_state: publicLane.freshness_state ?? "none-recorded",
    last_verified_at: publicLane.last_verified_at ?? null,
    blocking_for_install: publicLane.support_level === "blocked" || publicLane.support_level === "known-broken",
    summary: publicLane.support_semantics,
  };
}
