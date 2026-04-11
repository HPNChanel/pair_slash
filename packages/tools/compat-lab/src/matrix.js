import {
  loadPackCatalogRecords,
  loadPublicSupportSnapshot,
  stableYaml,
  WORKFLOW_MATURITY_STRENGTH_ORDER,
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

function fakeEvidenceRefsForLane(lane) {
  if (Array.isArray(lane.fake_evidence_refs)) {
    return lane.fake_evidence_refs;
  }
  if (!Array.isArray(lane.shim_evidence_refs)) {
    return [];
  }
  return lane.shim_evidence_refs.filter((ref) => typeof ref === "string" && ref.includes("acceptance.js"));
}

function shimEvidenceRefsForLane(lane) {
  if (Array.isArray(lane.fake_evidence_refs)) {
    return Array.isArray(lane.shim_evidence_refs) ? lane.shim_evidence_refs : [];
  }
  if (!Array.isArray(lane.shim_evidence_refs)) {
    return [];
  }
  return lane.shim_evidence_refs.filter((ref) => typeof ref === "string" && !ref.includes("acceptance.js"));
}

function formatStringList(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return "none recorded";
  }
  return values.map((value) => `\`${value}\``).join(", ");
}

function workflowMaturityRank(level) {
  if (typeof level !== "string") {
    return WORKFLOW_MATURITY_STRENGTH_ORDER.canary;
  }
  return WORKFLOW_MATURITY_STRENGTH_ORDER[level] ?? WORKFLOW_MATURITY_STRENGTH_ORDER.canary;
}

export function buildCompatibilityMatrixArtifact({
  repoRoot = process.cwd(),
  version = "0.4.0",
} = {}) {
  const fixtures = listCompatFixtures();
  const supportSnapshot = loadPublicSupportSnapshot(repoRoot, { version });
  const workflowMaturity = loadPackCatalogRecords(repoRoot, { includeAdvanced: false })
    .map((record) => ({
      pack_id: record.id,
      workflow_maturity: record.workflow_maturity,
      effective_workflow_maturity: record.effective_workflow_maturity,
      default_recommendation: record.default_recommendation === true,
      blocked: record.workflow_maturity_blocked === true,
      blockers: Array.isArray(record.workflow_maturity_blockers) ? record.workflow_maturity_blockers : [],
      support_scope: record.support_scope ?? null,
      overclaimed:
        workflowMaturityRank(record.workflow_maturity) >
        workflowMaturityRank(record.effective_workflow_maturity),
    }))
    .sort((left, right) => {
      if (
        workflowMaturityRank(left.effective_workflow_maturity) !==
        workflowMaturityRank(right.effective_workflow_maturity)
      ) {
        return workflowMaturityRank(right.effective_workflow_maturity) - workflowMaturityRank(left.effective_workflow_maturity);
      }
      if (left.default_recommendation !== right.default_recommendation) {
        return left.default_recommendation ? -1 : 1;
      }
      return left.pack_id.localeCompare(right.pack_id);
    });
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
    workflow_maturity: workflowMaturity,
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
    [
      "Lane",
      "Deterministic evidence",
      "Fake acceptance evidence",
      "Shim acceptance evidence",
      "Live evidence",
      "Evidence records / guard rails",
    ],
    artifact.runtime_lanes.map((lane) => [
      `${lane.runtime} / ${lane.target} / ${lane.os_lane}`,
      formatRefList(lane.deterministic_evidence_refs),
      formatRefList(fakeEvidenceRefsForLane(lane)),
      formatRefList(shimEvidenceRefsForLane(lane)),
      formatRefList([...(lane.live_evidence_refs ?? []), ...(lane.negative_evidence_refs ?? [])]),
      formatRefList([lane.evidence_source, lane.evidence_data_ref, ...(lane.claim_guard_refs ?? [])]),
    ]),
  );
  const workflowMaturityTable = formatTable(
    ["Workflow", "Assigned", "Effective", "Default selection candidate", "Blocked", "Blockers"],
    artifact.workflow_maturity.map((workflow) => [
      workflow.pack_id,
      workflow.workflow_maturity,
      workflow.effective_workflow_maturity,
      workflow.default_recommendation ? "yes" : "no",
      workflow.blocked ? "yes" : "no",
      workflow.blockers.length > 0 ? workflow.blockers.join("<br>") : "none",
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
    "- `canary`: workflow exists with narrow deterministic confidence and explicit caveats.",
    "- `preview`: workflow has at least one fresh canonical `/skills` live verification",
    "  on the claimed runtime lanes.",
    "- `beta`: workflow has repeated live verification on documented default lanes.",
    "- `stable`: workflow has repeated live verification plus `stable-tested` lane",
    "  support on the documented lanes.",
    "- `deprecated`: workflow is retired for new use and must include migration or",
    "  replacement guidance.",
    "- `publicly supported`: this matrix still lists runtime lanes PairSlash can claim",
    "  publicly today.",
    "",
    "Implementation existence, doctor output, preview output, or deterministic",
    "coverage outside the rows below do not widen public support, product-validation",
    "status, or release scope by themselves.",
    "They also do not assign workflow maturity; that stays with",
    "`docs/architecture/phase-18-workflow-maturity-charter.md`,",
    "`docs/architecture/phase-18-workflow-maturity-wording-system.md`, plus",
    "canonical core pack manifests.",
    "",
    "## Evidence classes",
    "",
    "- `deterministic evidence`: repeatable tests, release gates, and generated",
    "  artifacts that prove implementation and regression control.",
    "- `fake acceptance evidence`: deterministic compat-lab scenario outputs that",
    "  exercise install and doctor logic under fixture control.",
    "- `shim acceptance evidence`: fake runtime binaries and host overrides that",
    "  make deterministic compat-lab lanes reproducible.",
    "- `fake acceptance` and `shim acceptance` are regression confidence only.",
    "  They never widen public support claims.",
    "- `live evidence`: real runtime, target, OS, and version observations from",
    "  `/skills` interaction or live install behavior on the documented lane.",
    "",
    "## Evidence policy",
    "",
    `- Canonical entrypoint: \`${artifact.evidence_policy.canonical_entrypoint}\``,
    `- Registry schema: \`${artifact.evidence_policy.registry_schema_ref}\``,
    "- `live_smoke` can document feasibility or failure, but it cannot promote a",
    "  lane beyond `degraded` or `prep`.",
    "- `live_verification` is the minimum evidence for public lane claims on the",
    "  exact lane.",
    "- `repeated_live_verification` is the minimum evidence for `stable-tested`.",
    "- One-off runs are not enough for `stable-tested`.",
    `- Scripted live-run steps allowed: ${formatStringList(
      artifact.evidence_policy.runbook_policy?.manual_vs_scripted_boundary?.scripted_steps_allowed,
    )}`,
    `- Manual live-run steps required: ${formatStringList(
      artifact.evidence_policy.runbook_policy?.manual_vs_scripted_boundary?.manual_steps_required,
    )}`,
    `- Copilot required tool presence: ${formatStringList(
      artifact.evidence_policy.runbook_policy?.runtime_runbooks?.copilot_cli?.required_tool_presence,
    )}`,
    `- Windows promotion gate requires: ${formatStringList(
      artifact.evidence_policy.runbook_policy?.windows_promotion_gate?.requires,
    )}`,
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
    "They do not promote workflow maturity, product-validation status, program",
    "phase, or release scope by themselves.",
    "They also do not change repository licensing, `NOTICE` posture, or package",
    "publishability. Legal/package truth stays with",
    "`docs/releases/legal-packaging-status.md`, root/package manifests, `LICENSE`,",
    "and `NOTICE`.",
    "",
    "## Workflow label display convention",
    "",
    "- If workflow labels are shown on this page, show them in a separate workflow",
    "  field, note, or row.",
    "- Keep `supported` for runtime lanes and keep install ordering language",
    "  separate from maturity labels.",
    "- Do not restate a lane label as a workflow label.",
    "- Do not let advanced workflows or advanced lanes appear as core-default or",
    "  core-stable by layout alone.",
    "- If assigned and effective maturity differ, display both and treat the",
    "  effective label as the public claim ceiling.",
    "",
    "Approved examples:",
    "",
    "- \"Codex CLI repo macOS lane: degraded. Workflow `pairslash-plan`: canary.\"",
    "- \"GitHub Copilot CLI user Linux lane: prep. Workflow `pairslash-memory-write-global`: canary.\"",
    "",
    "Forbidden examples:",
    "",
    "- \"Codex CLI repo macOS: stable\" when that is only a lane statement",
    "- \"Copilot Linux preview means the workflow is beta\"",
    "- \"Advanced lane\" shown under a shared core-stable badge",
    "",
    "## Workflow maturity snapshot (core packs)",
    "",
    "This section is derived from canonical core manifests through the pack",
    "catalog and must stay consistent with doctor/lint outputs.",
    "",
    workflowMaturityTable,
    "",
    "Interpretation rules:",
    "",
    "- `Assigned` is manifest intent; `Effective` is evidence-backed truth after",
    "  blockers, demotion rules, and lane constraints.",
    "- Public and onboarding wording must follow `Effective`, not `Assigned`.",
    "- A `yes` value under `Default selection candidate` means install/onboarding",
    "  may choose that workflow first; it is not a blanket support claim or",
    "  maturity recommendation.",
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
    "- Do not reuse runtime-lane labels as workflow maturity labels; workflow",
    "  maturity is governed separately by the Phase 18 charter.",
    "- Reproduce issues through compat-lab fixtures and behavior evals before broadening support claims.",
    "",
  ].join("\n");
}

export function renderRuntimeSurfaceMatrixYaml({
  repoRoot = process.cwd(),
  version = "0.4.0",
} = {}) {
  const artifact = buildCompatibilityMatrixArtifact({ repoRoot, version });
  const {
    workflow_maturity: _workflowMaturity,
    ...runtimeSurfaceArtifact
  } = artifact;
  return stableYaml(runtimeSurfaceArtifact);
}
