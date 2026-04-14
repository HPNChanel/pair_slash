import { join } from "node:path";

import { ensureDir, relativeFrom, stableJson, writeTextFile } from "@pairslash/spec-core";

import { buildPhase19Paths } from "./paths.js";
import { loadCapturedRunRecords } from "./score.js";

function buildEvidenceEntries(records) {
  return records.map((record) => {
    const artifactManifest = record._artifact_manifest ?? null;
    return {
      run_id: record.run_id,
      task_card_id: record.task_card_id,
      workflow_id: record.workflow_id,
      scenario_id: record.scenario_id,
      runtime_id: record.runtime_id,
      lane_id: record.lane_id,
      lane_support_level: record.lane_support_level,
      workflow_maturity: record.workflow_maturity,
      claim_status: record.claim_status,
      reporting_mode: record.reporting_mode,
      include_in_rollup: record.include_in_rollup === true,
      exclude_reason: record.include_in_rollup === true ? null : (record.exclude_reason ?? "include_in_rollup=false"),
      repo_snapshot_ref: record.repo_snapshot_ref,
      task_success: record.task_success === true,
      trust_boundary_result: record.trust_boundary_result,
      preview_fidelity_result: record.preview_fidelity_result ?? "not_applicable",
      issue_reproduced: Object.prototype.hasOwnProperty.call(record, "issue_reproduced")
        ? record.issue_reproduced
        : null,
      baseline_manual_rescue_count: record.baseline_manual_rescue_count,
      pairslash_manual_rescue_count: record.pairslash_manual_rescue_count,
      baseline_rework_units: record.baseline_rework_units,
      pairslash_rework_units: record.pairslash_rework_units,
      weekly_reuse_answer: record.weekly_reuse_answer,
      weekly_reuse_reason: record.weekly_reuse_reason,
      negative_evidence_note: record.negative_evidence_note,
      evidence_links: [...(record.artifact_refs ?? [])],
      artifact_count: artifactManifest?.artifact_count ?? (record.artifact_refs ?? []).length,
      missing_artifact_count: artifactManifest?.missing_artifact_count ?? Number.MAX_SAFE_INTEGER,
      captured_at: record.validation_timestamp ?? null,
    };
  });
}

function renderEvidenceLogMarkdown(entries) {
  const lines = [
    "# Phase 19 Evidence Log (Generated)",
    "",
    "Generated from captured benchmark run records.",
    "",
    "| Run ID | Task | Runtime lane | Rollup | Task success | Trust boundary | Missing artifacts |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const entry of entries) {
    lines.push(
      `| ${entry.run_id} | ${entry.task_card_id} | ${entry.runtime_id}/${entry.lane_id} | ${entry.include_in_rollup} | ${entry.task_success} | ${entry.trust_boundary_result} | ${entry.missing_artifact_count} |`,
    );
  }

  lines.push("");
  lines.push("## Entry Notes");
  lines.push("");
  for (const entry of entries) {
    lines.push(`### ${entry.run_id}`);
    lines.push(`- reporting_mode: ${entry.reporting_mode}`);
    lines.push(`- weekly_reuse_answer: ${entry.weekly_reuse_answer}`);
    lines.push(`- negative_evidence_note: ${entry.negative_evidence_note}`);
    if (entry.include_in_rollup !== true) {
      lines.push(`- exclude_reason: ${entry.exclude_reason}`);
    }
    lines.push("- evidence_links:");
    for (const link of entry.evidence_links) {
      lines.push(`  - ${link}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

export function writeEvidenceLogArtifacts({ repoRoot = process.cwd(), runIds = null } = {}) {
  const { records } = loadCapturedRunRecords({ repoRoot, runIds });
  const paths = buildPhase19Paths(repoRoot);
  ensureDir(paths.runsDir);

  const entries = buildEvidenceEntries(records);
  const jsonPath = join(paths.runsDir, "evidence-log.json");
  const markdownPath = join(paths.runsDir, "evidence-log.md");

  const jsonPayload = {
    kind: "phase19-evidence-log",
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    run_count: entries.length,
    entries,
  };

  writeTextFile(jsonPath, stableJson(jsonPayload));
  writeTextFile(markdownPath, renderEvidenceLogMarkdown(entries));

  return {
    kind: "phase19-evidence-log-write",
    generated_at: jsonPayload.generated_at,
    run_count: entries.length,
    json_path: relativeFrom(repoRoot, jsonPath),
    markdown_path: relativeFrom(repoRoot, markdownPath),
  };
}

export function formatEvidenceLogReportText(report) {
  return [
    "Phase 19 evidence-log write",
    `Runs: ${report.run_count}`,
    `JSON: ${report.json_path}`,
    `Markdown: ${report.markdown_path}`,
  ].join("\n").concat("\n");
}
