import {
  LIVE_RUNTIME_EVIDENCE_ROOT,
} from "./helpers.ts";

export const DEFAULT_PUBLIC_SUPPORT_POLICY = Object.freeze({
  blocked:
    "Fresh negative live evidence blocks the exact lane or documented surface until superseded by newer live verification.",
  degraded:
    "Real runtime evidence exists, but the canonical /skills path is missing, partial, or caveated for the documented lane.",
  prep:
    "Deterministic coverage and optional live smoke may exist, but canonical /skills verification is not yet recorded for the documented lane.",
  preview:
    "One fresh canonical live verification exists for the exact lane, but repeated live verification is not recorded yet.",
  stable_tested:
    "Repeated fresh canonical live verification exists for the exact runtime, target, OS, and lane scope.",
});

export const DEFAULT_PUBLIC_COMPATIBILITY_LANES = Object.freeze([
  {
    actual_evidence_class: "live_smoke",
    canonical_entrypoint: "/skills",
    runtime: "Codex CLI",
    runtime_id: "codex_cli",
    target: "repo",
    os_lane: "macOS",
    lane_id: "codex-cli-repo-macos",
    support_level: "degraded",
    recommended_version: "0.153.4",
    live_tested_range: "none recorded",
    deterministic_lab_baseline: "0.153.4",
    support_semantics:
      "Real Codex CLI behavior was observed on macOS repo scope, but only through codex exec/direct invocation and not through a checked-in canonical /skills picker capture. Keep this lane degraded.",
    release_gate: "required",
    evidence_source: `${LIVE_RUNTIME_EVIDENCE_ROOT}/codex-cli-repo-macos.md`,
    evidence_data_ref: `${LIVE_RUNTIME_EVIDENCE_ROOT}/codex-cli-repo-macos.yaml`,
    evidence_summary:
      "Archived direct-invocation live smoke exists for Codex CLI 0.116.0 on macOS repo scope, but canonical /skills evidence is still unrecorded. Version fields realigned 2026-09-28 to the live-observed 0.153.x series without new macOS evidence.",
    freshness_state: "fresh",
    host_profile_count: 1,
    last_verified_at: "2026-03-21",
    owner_id: "runtime-truth",
    required_evidence_class: "live_verification",
    deterministic_evidence_refs: [
      "docs/runtime-mapping/pilot-acceptance.md",
      "packages/tools/compat-lab/tests/acceptance.test.js",
      "packages/tools/compat-lab/tests/matrix.test.js",
    ],
    fake_evidence_refs: ["packages/tools/compat-lab/src/acceptance.js"],
    shim_evidence_refs: ["packages/tools/compat-lab/src/runtime-fixtures.js"],
    live_evidence_refs: [
      "docs-private/compatibility/phase-0-acceptance.md",
      ".pairslash/project-memory/60-architecture-decisions/phase-0-codex-cli-verification-on-v0-116-0.yaml",
    ],
    negative_evidence_refs: [
      ".pairslash/project-memory/70-known-good-patterns/codex-exec-as-non-interactive-skill-testing-surface.yaml",
    ],
    claim_guard_refs: [
      "docs/compatibility/runtime-verification.md",
      "docs/releases/public-claim-policy.md",
    ],
    surface_verdicts: {
      canonical_picker: "unrecorded",
      direct_invocation: "pass",
      gh_availability: "not_applicable",
      install_apply: "unrecorded",
      preview_install: "unrecorded",
      runtime_available: "pass",
    },
  },
  {
    actual_evidence_class: null,
    canonical_entrypoint: "/skills",
    runtime: "GitHub Copilot CLI",
    runtime_id: "copilot_cli",
    target: "user",
    os_lane: "Linux",
    lane_id: "copilot-cli-user-linux",
    support_level: "prep",
    recommended_version: "1.0.88",
    live_tested_range: "none recorded",
    deterministic_lab_baseline: "1.0.88",
    support_semantics:
      "Deterministic coverage exists, but no checked-in canonical /skills verification or live install record exists for the Linux user lane. Keep this lane prep-only.",
    release_gate: "required",
    evidence_source: `${LIVE_RUNTIME_EVIDENCE_ROOT}/copilot-cli-user-linux.md`,
    evidence_data_ref: `${LIVE_RUNTIME_EVIDENCE_ROOT}/copilot-cli-user-linux.yaml`,
    evidence_summary:
      "Deterministic installability coverage exists, but no checked-in Linux user /skills verification or live install record is present. Corrected 2026-09-28: the prior 2.50.x value reflected the gh host CLI version emitted by detection (and faked by compat-lab shims), not the Copilot CLI product series; recommended_version now tracks the observed @github/copilot v1.0.x stable line while deterministic_lab_baseline tracks the Copilot CLI product version the lab shims emit (the gh host version is modeled separately at 2.96.0).",
    freshness_state: "none-recorded",
    host_profile_count: 0,
    last_verified_at: null,
    owner_id: "runtime-truth",
    required_evidence_class: "live_verification",
    deterministic_evidence_refs: [
      "docs/runtime-mapping/pilot-acceptance.md",
      "packages/tools/compat-lab/tests/acceptance.test.js",
      "packages/tools/compat-lab/tests/matrix.test.js",
    ],
    fake_evidence_refs: ["packages/tools/compat-lab/src/acceptance.js"],
    shim_evidence_refs: ["packages/tools/compat-lab/src/runtime-fixtures.js"],
    live_evidence_refs: [],
    negative_evidence_refs: [],
    claim_guard_refs: [
      "docs/compatibility/runtime-verification.md",
      "docs/releases/public-claim-policy.md",
    ],
    surface_verdicts: {
      canonical_picker: "unrecorded",
      direct_invocation: "blocked",
      gh_availability: "unrecorded",
      install_apply: "unrecorded",
      preview_install: "unrecorded",
      runtime_available: "unrecorded",
    },
  },
  {
    actual_evidence_class: "live_smoke",
    canonical_entrypoint: "/skills",
    runtime: "Codex CLI",
    runtime_id: "codex_cli",
    target: "repo",
    os_lane: "Windows",
    lane_id: "codex-cli-repo-windows",
    support_level: "prep",
    recommended_version: "0.153.4",
    live_tested_range: "none recorded",
    deterministic_lab_baseline: "0.153.4",
    support_semantics:
      "Real Windows doctor and preview smoke are recorded, but install apply and canonical /skills verification remain unrecorded. Keep this lane prep-only.",
    release_gate: "nightly-only",
    evidence_source: `${LIVE_RUNTIME_EVIDENCE_ROOT}/codex-cli-repo-windows.md`,
    evidence_data_ref: `${LIVE_RUNTIME_EVIDENCE_ROOT}/codex-cli-repo-windows.yaml`,
    evidence_summary:
      "Real Windows doctor and preview smoke were recorded on 2026-04-05, but install apply and canonical /skills evidence remain unrecorded. Runtime version re-captured live on 2026-09-28 (codex-cli 0.153.4 on the Windows host); version fields realigned accordingly.",
    freshness_state: "fresh",
    host_profile_count: 1,
    last_verified_at: "2026-04-05T12:28:24.545Z",
    owner_id: "runtime-truth",
    required_evidence_class: "live_verification",
    deterministic_evidence_refs: [
      "docs/runtime-mapping/pilot-acceptance.md",
      "packages/tools/compat-lab/tests/acceptance.test.js",
      "packages/tools/compat-lab/tests/matrix.test.js",
    ],
    fake_evidence_refs: ["packages/tools/compat-lab/src/acceptance.js"],
    shim_evidence_refs: ["packages/tools/compat-lab/src/runtime-fixtures.js"],
    live_evidence_refs: [`${LIVE_RUNTIME_EVIDENCE_ROOT}/codex-cli-repo-windows.md`],
    negative_evidence_refs: [],
    claim_guard_refs: [
      "docs/compatibility/runtime-verification.md",
      "docs/releases/public-claim-policy.md",
    ],
    surface_verdicts: {
      canonical_picker: "unrecorded",
      direct_invocation: "not_recorded",
      gh_availability: "not_applicable",
      install_apply: "unrecorded",
      preview_install: "pass",
      runtime_available: "pass",
    },
  },
  {
    actual_evidence_class: "live_smoke",
    canonical_entrypoint: "/skills",
    runtime: "GitHub Copilot CLI",
    runtime_id: "copilot_cli",
    target: "user",
    os_lane: "Windows",
    lane_id: "copilot-cli-user-windows",
    support_level: "prep",
    recommended_version: "1.0.88",
    live_tested_range: "none recorded",
    deterministic_lab_baseline: "1.0.88",
    support_semantics:
      "A real Windows host probe was captured, but gh was unavailable locally and no canonical /skills or install proof exists. Keep this lane prep-only.",
    release_gate: "nightly-only",
    evidence_source: `${LIVE_RUNTIME_EVIDENCE_ROOT}/copilot-cli-user-windows.md`,
    evidence_data_ref: `${LIVE_RUNTIME_EVIDENCE_ROOT}/copilot-cli-user-windows.yaml`,
    evidence_summary:
      "A real Windows host probe was recorded on 2026-04-05, but gh was unavailable locally and preview blocked explicitly. Re-probed 2026-09-28: gh 2.96.0 is present and gh copilot --help exits 0 via the built-in wrapper, but the copilot binary is absent — wrapper presence is not Copilot CLI proof. Corrected 2026-09-28: the prior 2.50.x value reflected the gh host CLI version, not the Copilot CLI product series; recommended_version now tracks the observed @github/copilot v1.0.x stable line while deterministic_lab_baseline tracks the Copilot CLI product version the lab shims emit (the gh host version is modeled separately at 2.96.0).",
    freshness_state: "fresh",
    host_profile_count: 1,
    last_verified_at: "2026-04-05T12:28:23.177Z",
    owner_id: "runtime-truth",
    required_evidence_class: "live_verification",
    deterministic_evidence_refs: [
      "docs/runtime-mapping/pilot-acceptance.md",
      "packages/tools/compat-lab/tests/acceptance.test.js",
      "packages/tools/compat-lab/tests/matrix.test.js",
    ],
    fake_evidence_refs: ["packages/tools/compat-lab/src/acceptance.js"],
    shim_evidence_refs: ["packages/tools/compat-lab/src/runtime-fixtures.js"],
    live_evidence_refs: [`${LIVE_RUNTIME_EVIDENCE_ROOT}/copilot-cli-user-windows.md`],
    negative_evidence_refs: [`${LIVE_RUNTIME_EVIDENCE_ROOT}/copilot-cli-user-windows.md`],
    claim_guard_refs: [
      "docs/compatibility/runtime-verification.md",
      "docs/releases/public-claim-policy.md",
    ],
    surface_verdicts: {
      canonical_picker: "unrecorded",
      direct_invocation: "blocked",
      gh_availability: "fail",
      install_apply: "blocked",
      preview_install: "fail",
      runtime_available: "fail",
    },
  },
]);

export const DEFAULT_PUBLIC_KNOWN_ISSUES = Object.freeze([
  {
    id: "K1",
    surface: "Copilot direct invocation with -p/--prompt",
    status: "blocked",
    affected_lanes: "GitHub Copilot CLI",
    details: "Use /skills as the canonical entrypoint. Prompt-mode direct invocation remains blocked. Retest pending 2026-09-28 — Copilot CLI product absent on the verification host; protocol filed in copilot-cli-user-windows.md.",
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
    details: "Prefer simple single-statement PowerShell commands in verification and troubleshooting steps. Retest pending 2026-09-28 — codex exec retest blocked by host usage quota; protocol filed in codex-cli-repo-windows.md.",
  },
]);

export const DEFAULT_PUBLIC_RELEASE_GATES = Object.freeze([
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
    checks: [
      "full JS suite",
      "compat-lab suite",
      "public docs present",
      "generated artifacts up to date",
      "release trust bundle structure",
    ],
    required_for_release: true,
    notes:
      "Release promotion must not proceed unless this gate is green. Protected CI may additionally run the live-signed release-trust verification lane when signing secrets are configured.",
  },
]);
