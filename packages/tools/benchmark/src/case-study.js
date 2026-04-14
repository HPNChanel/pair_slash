import { join } from "node:path";

import { ensureDir, relativeFrom, stableJson, writeTextFile } from "@pairslash/spec-core";
import { redactTraceEvents } from "@pairslash/trace";

import { buildPhase19Paths } from "./paths.js";
import { loadCapturedRunRecords } from "./score.js";

function laneSentence(context, runRecord) {
  const template = context.laneTemplateById.get(runRecord.lane_id);
  if (template?.required_sentence) {
    return template.required_sentence;
  }
  return `Results are lane-specific to ${runRecord.lane_id}.`;
}

function deriveClaimabilityStatus(runRecord) {
  if (runRecord.include_in_rollup !== true) {
    return "blocked";
  }
  if (runRecord.task_success !== true || runRecord.trust_boundary_result !== "pass") {
    return "blocked";
  }
  if (runRecord.task_card_id === "W2a" && runRecord.preview_fidelity_result !== "pass") {
    return "blocked";
  }
  if (runRecord.task_card_id === "W2b" && runRecord.blocking_explanation_clear !== true) {
    return "blocked";
  }
  if (runRecord.task_card_id === "W3") {
    return "blocked";
  }
  return "claimable";
}

function buildCaseStudySourceRecord(context, runRecord) {
  const artifactManifest = runRecord._artifact_manifest ?? null;
  return {
    kind: "phase19-case-study-source-record",
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    source_id: `${runRecord.run_id}.source`,
    run_id: runRecord.run_id,
    task_card_id: runRecord.task_card_id,
    workflow_id: runRecord.workflow_id,
    scenario_id: runRecord.scenario_id,
    runtime_id: runRecord.runtime_id,
    lane_id: runRecord.lane_id,
    lane_support_level: runRecord.lane_support_level,
    workflow_maturity: runRecord.workflow_maturity,
    claim_status: runRecord.claim_status,
    reporting_mode: runRecord.reporting_mode,
    lane_required_sentence: laneSentence(context, runRecord),
    claimability_status: deriveClaimabilityStatus(runRecord),
    outcome: {
      run_verdict: runRecord.task_success === true ? "success" : "fail",
      task_success: runRecord.task_success === true,
      trust_boundary_result: runRecord.trust_boundary_result,
      preview_fidelity_result: runRecord.preview_fidelity_result ?? "not_applicable",
      issue_reproduced: Object.prototype.hasOwnProperty.call(runRecord, "issue_reproduced")
        ? runRecord.issue_reproduced
        : null,
      baseline_ttfs_seconds: runRecord.baseline_ttfs_seconds,
      pairslash_ttfs_seconds: runRecord.pairslash_ttfs_seconds,
      ttfs_delta_vs_baseline: runRecord.ttfs_delta_vs_baseline,
      baseline_manual_rescue_count: runRecord.baseline_manual_rescue_count,
      pairslash_manual_rescue_count: runRecord.pairslash_manual_rescue_count,
      baseline_rework_units: runRecord.baseline_rework_units,
      pairslash_rework_units: runRecord.pairslash_rework_units,
      rework_reduction_pct_vs_baseline: runRecord.rework_reduction_pct_vs_baseline,
      weekly_reuse_answer: runRecord.weekly_reuse_answer,
      weekly_reuse_reason: runRecord.weekly_reuse_reason,
    },
    evidence_links: [...(runRecord.artifact_refs ?? [])],
    negative_evidence_note: runRecord.negative_evidence_note,
    internal: {
      repo_snapshot_ref: runRecord.repo_snapshot_ref,
      task_statement: runRecord.task_statement,
      success_criteria: [...(runRecord.success_criteria ?? [])],
      baseline_method: runRecord.baseline_method,
      pairslash_method: runRecord.pairslash_method,
      arm_order: runRecord.arm_order,
      include_in_rollup: runRecord.include_in_rollup === true,
      exclude_reason: runRecord.exclude_reason ?? null,
      validation_timestamp: runRecord.validation_timestamp ?? null,
      artifact_manifest: artifactManifest
        ? {
            artifact_count: artifactManifest.artifact_count,
            missing_artifact_count: artifactManifest.missing_artifact_count,
          }
        : null,
    },
  };
}

function renderInternalCaseStudyMarkdown(sourceRecord) {
  const lines = [
    `# Phase 19 Internal Case Study - ${sourceRecord.run_id}`,
    "",
    "## Metadata",
    `- Task card: ${sourceRecord.task_card_id}`,
    `- Workflow: ${sourceRecord.workflow_id}`,
    `- Scenario: ${sourceRecord.scenario_id}`,
    `- Runtime: ${sourceRecord.runtime_id}`,
    `- Lane: ${sourceRecord.lane_id}`,
    `- Lane support level: ${sourceRecord.lane_support_level}`,
    `- Workflow maturity: ${sourceRecord.workflow_maturity}`,
    `- Claim status: ${sourceRecord.claim_status}`,
    `- Reporting mode: ${sourceRecord.reporting_mode}`,
    `- Claimability status: ${sourceRecord.claimability_status}`,
    "",
    "## Runtime-Lane Disclaimer",
    `- ${sourceRecord.lane_required_sentence}`,
    "",
    "## Scenario",
    `- Task statement: ${sourceRecord.internal.task_statement}`,
    "- Success criteria:",
    ...sourceRecord.internal.success_criteria.map((criterion) => `  - ${criterion}`),
    "",
    "## Baseline Arm",
    `- Method: ${sourceRecord.internal.baseline_method}`,
    `- TTFS: ${sourceRecord.outcome.baseline_ttfs_seconds}`,
    `- Manual rescue count: ${sourceRecord.outcome.baseline_manual_rescue_count}`,
    `- Rework units: ${sourceRecord.outcome.baseline_rework_units}`,
    "",
    "## PairSlash Arm",
    `- Method: ${sourceRecord.internal.pairslash_method}`,
    `- TTFS: ${sourceRecord.outcome.pairslash_ttfs_seconds}`,
    `- Manual rescue count: ${sourceRecord.outcome.pairslash_manual_rescue_count}`,
    `- Rework units: ${sourceRecord.outcome.pairslash_rework_units}`,
    "",
    "## Benchmark Delta Summary",
    `- Task success: ${sourceRecord.outcome.task_success}`,
    `- Trust boundary result: ${sourceRecord.outcome.trust_boundary_result}`,
    `- Preview fidelity result: ${sourceRecord.outcome.preview_fidelity_result}`,
    `- Issue reproduced: ${sourceRecord.outcome.issue_reproduced}`,
    `- TTFS delta vs baseline: ${sourceRecord.outcome.ttfs_delta_vs_baseline}`,
    `- Rework reduction vs baseline: ${sourceRecord.outcome.rework_reduction_pct_vs_baseline}`,
    `- Weekly reuse answer: ${sourceRecord.outcome.weekly_reuse_answer}`,
    `- Weekly reuse reason: ${sourceRecord.outcome.weekly_reuse_reason}`,
    "",
    "## Evidence",
    ...sourceRecord.evidence_links.map((link) => `- ${link}`),
    "",
    "## Caveats",
    `- Negative evidence: ${sourceRecord.negative_evidence_note}`,
    `- Include in rollup: ${sourceRecord.internal.include_in_rollup}`,
    `- Exclude reason: ${sourceRecord.internal.exclude_reason ?? "none"}`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function renderPublicCaseStudyMarkdown(sourceRecord) {
  const lines = [
    `# Phase 19 Public-Safe Case Study - ${sourceRecord.run_id}`,
    "",
    "## What Was Tested",
    `- Task card: ${sourceRecord.task_card_id}`,
    `- Workflow: ${sourceRecord.workflow_id}`,
    `- Runtime: ${sourceRecord.runtime_id}`,
    `- Lane: ${sourceRecord.lane_id}`,
    "",
    "## Runtime-Lane Disclaimer",
    `- ${sourceRecord.lane_required_sentence}`,
    "",
    "## Measured Outcome",
    `- Task success: ${sourceRecord.outcome.task_success}`,
    `- TTFS delta vs baseline: ${sourceRecord.outcome.ttfs_delta_vs_baseline}`,
    `- Rework reduction vs baseline: ${sourceRecord.outcome.rework_reduction_pct_vs_baseline}`,
    `- Weekly reuse answer: ${sourceRecord.outcome.weekly_reuse_answer}`,
    `- Trust boundary result: ${sourceRecord.outcome.trust_boundary_result}`,
    `- Preview fidelity result: ${sourceRecord.outcome.preview_fidelity_result}`,
    "",
    "## Evidence Used",
    ...sourceRecord.evidence_links.map((link) => `- ${link}`),
    "",
    "## Caveats",
    `- Workflow maturity: ${sourceRecord.workflow_maturity}`,
    `- Claim status: ${sourceRecord.claim_status}`,
    `- Reporting mode: ${sourceRecord.reporting_mode}`,
    `- Negative evidence: ${sourceRecord.negative_evidence_note}`,
    "",
    "## Claimability",
    `- ${sourceRecord.claimability_status}`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function buildPublicCaseStudyJson(sourceRecord, redactionReport) {
  return {
    kind: "phase19-public-case-study-record",
    schema_version: "1.0.0",
    run_id: sourceRecord.run_id,
    task_card_id: sourceRecord.task_card_id,
    workflow_id: sourceRecord.workflow_id,
    runtime_id: sourceRecord.runtime_id,
    lane_id: sourceRecord.lane_id,
    lane_support_level: sourceRecord.lane_support_level,
    workflow_maturity: sourceRecord.workflow_maturity,
    claim_status: sourceRecord.claim_status,
    reporting_mode: sourceRecord.reporting_mode,
    lane_required_sentence: sourceRecord.lane_required_sentence,
    outcome: {
      task_success: sourceRecord.outcome.task_success,
      ttfs_delta_vs_baseline: sourceRecord.outcome.ttfs_delta_vs_baseline,
      rework_reduction_pct_vs_baseline: sourceRecord.outcome.rework_reduction_pct_vs_baseline,
      trust_boundary_result: sourceRecord.outcome.trust_boundary_result,
      preview_fidelity_result: sourceRecord.outcome.preview_fidelity_result,
      weekly_reuse_answer: sourceRecord.outcome.weekly_reuse_answer,
    },
    evidence_links: sourceRecord.evidence_links,
    negative_evidence_note: sourceRecord.negative_evidence_note,
    claimability_status: sourceRecord.claimability_status,
    redaction_report: redactionReport,
  };
}

export function writeCaseStudySourceRecords({ repoRoot = process.cwd(), runIds = null } = {}) {
  const { context, records } = loadCapturedRunRecords({ repoRoot, runIds });
  const paths = buildPhase19Paths(repoRoot);
  const sourcesDir = join(paths.caseStudiesDir, "sources");
  ensureDir(sourcesDir);

  const outputs = [];
  for (const runRecord of records) {
    const sourceRecord = buildCaseStudySourceRecord(context, runRecord);
    const sourcePath = join(sourcesDir, `${runRecord.run_id}.source.json`);
    writeTextFile(sourcePath, stableJson(sourceRecord));
    outputs.push({
      run_id: runRecord.run_id,
      source_path: relativeFrom(repoRoot, sourcePath),
      source_record: sourceRecord,
      run_record: runRecord,
    });
  }

  return {
    kind: "phase19-case-study-source-write",
    generated_at: new Date().toISOString(),
    output_count: outputs.length,
    outputs,
  };
}

export function renderCaseStudyArtifacts({ repoRoot = process.cwd(), runIds = null } = {}) {
  const paths = buildPhase19Paths(repoRoot);
  ensureDir(paths.caseStudiesDir);

  const sourcesReport = writeCaseStudySourceRecords({ repoRoot, runIds });
  const internalDir = join(paths.caseStudiesDir, "internal");
  const publicDir = join(paths.caseStudiesDir, "public");
  ensureDir(internalDir);
  ensureDir(publicDir);

  const outputs = [];
  for (const output of sourcesReport.outputs) {
    const { run_id: runId, source_record: sourceRecord, run_record: runRecord } = output;
    const internalPath = join(internalDir, `${runId}.internal.md`);
    const publicMarkdownPath = join(publicDir, `${runId}.public.md`);
    const publicJsonPath = join(publicDir, `${runId}.public.json`);

    writeTextFile(internalPath, renderInternalCaseStudyMarkdown(sourceRecord));
    writeTextFile(publicMarkdownPath, renderPublicCaseStudyMarkdown(sourceRecord));

    const redaction = redactTraceEvents([runRecord], { repoRoot });
    const publicJson = buildPublicCaseStudyJson(sourceRecord, redaction.report);
    writeTextFile(publicJsonPath, stableJson(publicJson));

    outputs.push({
      run_id: runId,
      source_path: output.source_path,
      internal_markdown_path: relativeFrom(repoRoot, internalPath),
      public_markdown_path: relativeFrom(repoRoot, publicMarkdownPath),
      public_json_path: relativeFrom(repoRoot, publicJsonPath),
      redaction_state: redaction.report.redaction_state,
    });
  }

  const indexPath = join(paths.caseStudiesDir, "index.md");
  const lines = [
    "# Phase 19 Case Studies",
    "",
    "Generated artifacts from captured benchmark runs.",
    "",
  ];
  for (const output of outputs) {
    lines.push(`- ${output.run_id}`);
    lines.push(`  - source: ${output.source_path}`);
    lines.push(`  - internal: ${output.internal_markdown_path}`);
    lines.push(`  - public: ${output.public_markdown_path}`);
    lines.push(`  - public_json: ${output.public_json_path} (redaction_state=${output.redaction_state})`);
  }
  lines.push("");
  writeTextFile(indexPath, `${lines.join("\n")}\n`);

  return {
    kind: "phase19-case-study-render",
    generated_at: new Date().toISOString(),
    source_count: sourcesReport.output_count,
    internal_output_count: outputs.length,
    public_output_count: outputs.length,
    output_count: outputs.length,
    index_path: relativeFrom(repoRoot, indexPath),
    outputs,
  };
}

export function formatCaseStudyReportText(report) {
  const lines = [
    "Phase 19 case-study rendering",
    `Sources: ${report.source_count}`,
    `Internal outputs: ${report.internal_output_count}`,
    `Public outputs: ${report.public_output_count}`,
    `Index: ${report.index_path}`,
  ];

  for (const output of report.outputs) {
    lines.push(`- ${output.run_id}: ${output.internal_markdown_path} | ${output.public_markdown_path}`);
  }

  return `${lines.join("\n")}\n`;
}
