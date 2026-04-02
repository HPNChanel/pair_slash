export const PUBLIC_SUPPORT_POLICY = {
  stable_tested:
    "Deterministic compat-lab gates are green and a matching live runtime lane has recorded evidence.",
  degraded:
    "Deterministic compat-lab gates are green, but support is reduced by missing or partial live evidence or by documented caveats.",
  prep:
    "Doctor and preview are expected to work, but install claims are not yet recorded as live evidence.",
  known_broken:
    "PairSlash has an explicit known issue or blocked surface. No silent fallback is allowed.",
};

export const PUBLIC_COMPATIBILITY_LANES = [
  {
    runtime: "Codex CLI",
    runtime_id: "codex_cli",
    target: "repo",
    os_lane: "macOS",
    support_level: "stable-tested",
    recommended_version: "0.116.0",
    live_tested_range: "0.116.0",
    deterministic_lab_baseline: "0.116.0",
    support_semantics:
      "Canonical release lane. Use this lane when you need the strongest PairSlash support claim.",
    release_gate: "required",
    evidence_source:
      "docs/compatibility/compatibility-matrix.md; docs/compatibility/runtime-verification.md; docs/runtime-mapping/pilot-acceptance.md",
  },
  {
    runtime: "GitHub Copilot CLI",
    runtime_id: "copilot_cli",
    target: "user",
    os_lane: "Linux",
    support_level: "degraded",
    recommended_version: "2.50.x",
    live_tested_range: "none recorded",
    deterministic_lab_baseline: "2.50.0",
    support_semantics:
      "Deterministically covered in compat-lab, but live runtime evidence is not yet bounded enough for stable-tested claims.",
    release_gate: "required",
    evidence_source:
      "docs/compatibility/compatibility-matrix.md; docs/compatibility/runtime-verification.md; docs/runtime-mapping/pilot-acceptance.md",
  },
  {
    runtime: "Codex CLI",
    runtime_id: "codex_cli",
    target: "repo",
    os_lane: "Windows",
    support_level: "prep",
    recommended_version: "0.116.0",
    live_tested_range: "none recorded",
    deterministic_lab_baseline: "0.116.0",
    support_semantics:
      "Doctor and preview are expected; install evidence remains prep-only until manual live verification is recorded.",
    release_gate: "nightly-only",
    evidence_source:
      "docs/compatibility/compatibility-matrix.md; docs/compatibility/runtime-verification.md; docs/runtime-mapping/pilot-acceptance.md",
  },
  {
    runtime: "GitHub Copilot CLI",
    runtime_id: "copilot_cli",
    target: "user",
    os_lane: "Windows",
    support_level: "prep",
    recommended_version: "2.50.x",
    live_tested_range: "none recorded",
    deterministic_lab_baseline: "2.50.0",
    support_semantics:
      "Doctor and preview are expected; install evidence remains prep-only until manual live verification is recorded.",
    release_gate: "nightly-only",
    evidence_source:
      "docs/compatibility/compatibility-matrix.md; docs/compatibility/runtime-verification.md; docs/runtime-mapping/pilot-acceptance.md",
  },
];

export const PUBLIC_KNOWN_ISSUES = [
  {
    id: "K1",
    surface: "Copilot direct invocation with -p/--prompt",
    status: "known-broken",
    affected_lanes: "GitHub Copilot CLI",
    details: "Use /skills as the canonical entrypoint. Prompt-mode direct invocation remains blocked.",
  },
  {
    id: "K2",
    surface: "Windows live install evidence",
    status: "prep",
    affected_lanes: "Codex CLI repo, GitHub Copilot CLI user",
    details: "Compat-lab covers doctor and preview; stable-tested claims require manual live install evidence.",
  },
  {
    id: "K3",
    surface: "Codex read-only sandbox complex PowerShell",
    status: "degraded",
    affected_lanes: "Codex CLI",
    details: "Prefer simple single-statement PowerShell commands in verification and troubleshooting steps.",
  },
];

export const PUBLIC_RELEASE_GATES = [
  {
    id: "quick-pr",
    trigger: "pull_request and push",
    checks: ["lint", "unit", "compat goldens", "matrix sync"],
    required_for_release: true,
    notes: "Fast deterministic gate that blocks obvious compiler/installer/docs regressions.",
  },
  {
    id: "cross-os-acceptance",
    trigger: "pull_request and push",
    checks: ["macOS Codex acceptance", "Linux Copilot acceptance", "Windows prep acceptance"],
    required_for_release: true,
    notes: "Cross-OS installability and doctor coverage with fake runtimes and deterministic lanes.",
  },
  {
    id: "nightly-smoke",
    trigger: "nightly schedule or workflow_dispatch",
    checks: ["fixture smoke matrix", "behavior evals", "artifact regeneration check"],
    required_for_release: true,
    notes: "Deeper regression control without forcing the full cost into every PR.",
  },
  {
    id: "release-readiness",
    trigger: "manual pre-release gate",
    checks: ["full JS suite", "compat-lab suite", "public docs present", "generated artifacts up to date"],
    required_for_release: true,
    notes: "Release promotion must not proceed unless this gate is green.",
  },
];

const PLATFORM_TO_OS_LANE = {
  darwin: "macOS",
  linux: "Linux",
  win32: "Windows",
};

export function normalizePublicOsLane(os) {
  return PLATFORM_TO_OS_LANE[os] ?? null;
}

export function findPublicCompatibilityLane({ runtime, target, os }) {
  const osLane = normalizePublicOsLane(os);
  if (!osLane) {
    return null;
  }
  return (
    PUBLIC_COMPATIBILITY_LANES.find(
      (lane) => lane.runtime_id === runtime && lane.target === target && lane.os_lane === osLane,
    ) ?? null
  );
}

export function hasRecordedLiveTestedRange(lane) {
  return Boolean(lane?.live_tested_range && lane.live_tested_range !== "none recorded");
}

export function publicSupportLevelToDoctorLaneStatus(supportLevel) {
  if (supportLevel === "prep") {
    return "prep";
  }
  if (supportLevel === "known-broken") {
    return "unsupported";
  }
  return "supported";
}
