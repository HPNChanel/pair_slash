import { stableYaml } from "@pairslash/spec-core";

import { DEFAULT_ACCEPTANCE_LANES } from "./acceptance.js";
import { DEFAULT_COMPAT_EVALS } from "./evals.js";
import { listCompatFixtures } from "./fixtures.js";
import { DEFAULT_SMOKE_LANES } from "./smoke.js";

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

function formatTable(headers, rows) {
  const headerLine = `| ${headers.join(" | ")} |`;
  const separatorLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const rowLines = rows.map((row) => `| ${row.join(" | ")} |`);
  return [headerLine, separatorLine, ...rowLines].join("\n");
}

export function buildCompatibilityMatrixArtifact({ version = "0.4.0" } = {}) {
  const fixtures = listCompatFixtures();
  return {
    version,
    generated_from: {
      fixtures: fixtures.map((fixture) => fixture.id),
      smoke_lanes: DEFAULT_SMOKE_LANES.map((lane) => lane.id),
      acceptance_lanes: DEFAULT_ACCEPTANCE_LANES.map((lane) => lane.id),
      evals: DEFAULT_COMPAT_EVALS.map((entry) => entry.id),
    },
    support_policy: {
      stable_tested:
        "Deterministic compat-lab gates are green and a matching live runtime lane has recorded evidence.",
      degraded:
        "Deterministic compat-lab gates are green, but support is reduced by missing or partial live evidence or by documented caveats.",
      prep:
        "Doctor and preview are expected to work, but install claims are not yet recorded as live evidence.",
      known_broken:
        "PairSlash has an explicit known issue or blocked surface. No silent fallback is allowed.",
    },
    runtime_lanes: PUBLIC_COMPATIBILITY_LANES.map((lane) => ({ ...lane })),
    known_issues: PUBLIC_KNOWN_ISSUES.map((issue) => ({ ...issue })),
    release_gates: PUBLIC_RELEASE_GATES.map((gate) => ({ ...gate })),
    fixture_catalog: fixtures.map((fixture) => ({
      id: fixture.id,
      repo_archetype: fixture.repo_archetype,
      primary_pack_id: fixture.primary_pack_id,
      supported_workflows: fixture.supported_workflows.slice(),
      modeled_risks: fixture.modeled_risks.slice(),
    })),
  };
}

export function renderCompatibilityMatrixMarkdown({ version = "0.4.0" } = {}) {
  const artifact = buildCompatibilityMatrixArtifact({ version });
  const laneTable = formatTable(
    [
      "Runtime",
      "Target",
      "OS lane",
      "Support level",
      "Recommended version",
      "Live tested range",
      "Deterministic baseline",
      "Release gate",
    ],
    artifact.runtime_lanes.map((lane) => [
      lane.runtime,
      lane.target,
      lane.os_lane,
      lane.support_level,
      lane.recommended_version,
      lane.live_tested_range,
      lane.deterministic_lab_baseline,
      lane.release_gate,
    ]),
  );
  const issueTable = formatTable(
    ["Issue", "Surface", "Status", "Affected lanes", "Details"],
    artifact.known_issues.map((issue) => [
      issue.id,
      issue.surface,
      issue.status,
      issue.affected_lanes,
      issue.details,
    ]),
  );
  const gateTable = formatTable(
    ["Gate", "Trigger", "Checks", "Required", "Notes"],
    artifact.release_gates.map((gate) => [
      gate.id,
      gate.trigger,
      gate.checks.join(", "),
      gate.required_for_release ? "yes" : "no",
      gate.notes,
    ]),
  );
  const fixtureTable = formatTable(
    ["Fixture", "Archetype", "Primary workflow", "Modeled risks"],
    artifact.fixture_catalog.map((fixture) => [
      fixture.id,
      fixture.repo_archetype,
      fixture.primary_pack_id,
      fixture.modeled_risks.join(", "),
    ]),
  );

  return [
    "# PairSlash Compatibility Matrix",
    "",
    `Generated from compat-lab metadata and deterministic release gates for PairSlash ${artifact.version}.`,
    "",
    "## Support semantics",
    "",
    "- `stable-tested`: deterministic compat-lab gates are green and matching live runtime evidence exists.",
    "- `degraded`: deterministic gates are green, but support has caveats or incomplete live evidence.",
    "- `prep`: doctor and preview are expected, but install support is not yet claimed as live evidence.",
    "- `known-broken`: PairSlash has an explicit blocked or broken surface. No silent fallback is allowed.",
    "",
    "## Runtime lanes",
    "",
    laneTable,
    "",
    "## Known issues",
    "",
    issueTable,
    "",
    "## Release-gating matrix",
    "",
    gateTable,
    "",
    "## Fixture coverage",
    "",
    fixtureTable,
    "",
    "## How to use this matrix",
    "",
    "- Choose `stable-tested` when you need the strongest support claim for release or rollout decisions.",
    "- Treat `degraded` as supported with caveats, not as a silent fallback lane.",
    "- Treat `prep` as preview/doctor coverage only until live install evidence is recorded.",
    "- Reproduce issues through compat-lab fixtures and behavior evals before broadening support claims.",
    "",
  ].join("\n");
}

export function renderRuntimeSurfaceMatrixYaml({ version = "0.4.0" } = {}) {
  return stableYaml(buildCompatibilityMatrixArtifact({ version }));
}
