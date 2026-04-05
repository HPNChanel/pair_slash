import {
  loadPublicSupportSnapshot,
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

function uniqueRefs(refs) {
  if (!Array.isArray(refs)) {
    return [];
  }
  return [...new Set(refs.filter((ref) => typeof ref === "string" && ref.trim() !== ""))];
}

function formatRefList(refs) {
  const normalizedRefs = uniqueRefs(refs);
  if (normalizedRefs.length === 0) {
    return "none recorded";
  }
  return normalizedRefs.map((ref) => `\`${ref}\``).join("<br>");
}

export function buildCompatibilityMatrixArtifact({
  repoRoot = process.cwd(),
  version = "0.4.0",
} = {}) {
  const fixtures = listCompatFixtures();
  const supportSnapshot = loadPublicSupportSnapshot(repoRoot, { version });
  return {
    version: supportSnapshot.version ?? version,
    generated_from: {
      fixtures: fixtures.map((fixture) => fixture.id),
      smoke_lanes: DEFAULT_SMOKE_LANES.map((lane) => lane.id),
      acceptance_lanes: DEFAULT_ACCEPTANCE_LANES.map((lane) => lane.id),
      evals: DEFAULT_COMPAT_EVALS.map((entry) => entry.id),
    },
    evidence_policy: { ...supportSnapshot.evidence_policy },
    support_policy: { ...supportSnapshot.support_policy },
    runtime_lanes: supportSnapshot.runtime_lanes.map((lane) => ({ ...lane })),
    known_issues: supportSnapshot.known_issues.map((issue) => ({ ...issue })),
    release_gates: supportSnapshot.release_gates.map((gate) => ({ ...gate })),
    fixture_catalog: fixtures.map((fixture) => ({
      id: fixture.id,
      repo_archetype: fixture.repo_archetype,
      primary_pack_id: fixture.primary_pack_id,
      supported_workflows: fixture.supported_workflows.slice(),
      modeled_risks: fixture.modeled_risks.slice(),
    })),
  };
}

export function renderCompatibilityMatrixMarkdown({
  repoRoot = process.cwd(),
  version = "0.4.0",
} = {}) {
  const artifact = buildCompatibilityMatrixArtifact({ repoRoot, version });
  const laneTable = formatTable(
    [
      "Runtime",
      "Target",
      "OS lane",
      "Support level",
      "Required evidence",
      "Best live evidence",
      "Freshness",
      "Last verified",
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
      lane.required_evidence_class,
      lane.actual_evidence_class ?? "none recorded",
      lane.freshness_state,
      lane.last_verified_at ?? "none recorded",
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
  const evidenceTable = formatTable(
    ["Lane", "Deterministic evidence", "Fake/shim evidence", "Live evidence", "Evidence records / guard rails"],
    artifact.runtime_lanes.map((lane) => [
      `${lane.runtime} / ${lane.target} / ${lane.os_lane}`,
      formatRefList(lane.deterministic_evidence_refs),
      formatRefList(lane.shim_evidence_refs),
      formatRefList([...(lane.live_evidence_refs ?? []), ...(lane.negative_evidence_refs ?? [])]),
      formatRefList([lane.evidence_source, lane.evidence_data_ref, ...(lane.claim_guard_refs ?? [])]),
    ]),
  );

  return [
    "# PairSlash Compatibility Matrix",
    "",
    `Generated from docs/compatibility/runtime-surface-matrix.yaml and compat-lab metadata for PairSlash ${artifact.version}.`,
    "",
    "This matrix is the public markdown rendering of the runtime-support catalog PairSlash consumes today.",
    "It is narrower than implementation truth and narrower than deterministic test",
    "coverage.",
    "",
    "## Claim boundary",
    "",
    "- `implemented`: code, manifests, or adapters exist in the repo.",
    "- `deterministic-tested`: compat-lab or release gates cover the surface",
    "  repeatably.",
    "- `live-evidence-backed`: manual runtime verification is recorded for the exact",
    "  runtime/target/OS lane.",
    "- `publicly supported`: this matrix lists the lanes PairSlash can claim",
    "  publicly today.",
    "",
    "Implementation existence, doctor output, preview output, or deterministic",
    "coverage outside the rows below do not widen public support, product-validation",
    "status, or release scope by themselves.",
    "",
    "## Evidence classes",
    "",
    "- `deterministic evidence`: repeatable tests, release gates, and generated",
    "  artifacts that prove implementation and regression control.",
    "- `fake/shim evidence`: compat-lab coverage that uses fake runtime",
    "  binaries or host overrides. Useful for regression control, never enough",
    "  for live support promotion.",
    "- `live evidence`: real runtime, target, OS, and version observations from",
    "  `/skills` interaction or live install behavior on the documented lane.",
    "",
    "## Evidence policy",
    "",
    `- Canonical entrypoint: \`${artifact.evidence_policy.canonical_entrypoint}\``,
    "- `live_smoke` can document feasibility or failure, but it cannot promote a",
    "  lane beyond `degraded` or `prep`.",
    "- `live_verification` is the minimum evidence for public lane claims on the",
    "  exact lane.",
    "- `repeated_live_verification` is the minimum evidence for `stable-tested`.",
    "- One-off runs are not enough for `stable-tested`.",
    "",
    "## Support semantics",
    "",
    "- `blocked`: fresh negative live evidence blocks the documented lane or surface until newer live verification supersedes it.",
    "- `prep`: deterministic coverage or live smoke may exist, but canonical `/skills` verification is not yet recorded for the documented lane.",
    "- `preview`: one fresh canonical live verification exists for the exact lane, but repeated live verification is not recorded yet.",
    "- `degraded`: real runtime evidence exists, but the canonical `/skills` path is missing, partial, or caveated for the documented lane.",
    "- `stable-tested`: repeated fresh canonical live verification exists for the exact lane.",
    "",
    "These labels are runtime-support truth only.",
    "They do not promote product-validation status, program phase, or release scope by themselves.",
    "They also do not change repository licensing, `NOTICE` posture, or package",
    "publishability. Legal/package truth stays with",
    "`docs/releases/legal-packaging-status.md`, root/package manifests, `LICENSE`,",
    "and `NOTICE`.",
    "",
    "## Runtime lanes",
    "",
    laneTable,
    "",
    "## Known issues",
    "",
    issueTable,
    "",
    "## Lane evidence records",
    "",
    evidenceTable,
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
    "- Choose `stable-tested` only when repeated fresh canonical live verification is checked in.",
    "- Treat `degraded` as supported with explicit caveats, not as a silent fallback lane.",
    "- Treat `prep` as deterministic or smoke coverage only until canonical live verification is recorded.",
    "- Reproduce issues through compat-lab fixtures and behavior evals before broadening support claims.",
    "",
  ].join("\n");
}

export function renderRuntimeSurfaceMatrixYaml({
  repoRoot = process.cwd(),
  version = "0.4.0",
} = {}) {
  return stableYaml(buildCompatibilityMatrixArtifact({ repoRoot, version }));
}
