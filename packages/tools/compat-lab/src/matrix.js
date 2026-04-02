import {
  PUBLIC_COMPATIBILITY_LANES,
  PUBLIC_KNOWN_ISSUES,
  PUBLIC_RELEASE_GATES,
  PUBLIC_SUPPORT_POLICY,
  stableYaml,
} from "@pairslash/spec-core";

import { DEFAULT_ACCEPTANCE_LANES } from "./acceptance.js";
import { DEFAULT_COMPAT_EVALS } from "./evals.js";
import { listCompatFixtures } from "./fixtures.js";
import { DEFAULT_SMOKE_LANES } from "./smoke.js";

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
    support_policy: { ...PUBLIC_SUPPORT_POLICY },
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
    "These labels are runtime-support truth only.",
    "They do not promote product-validation status, program phase, or release scope by themselves.",
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
