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

function renderCaseStudyMarkdown(context, runRecord) {
  const ttfs = Number.isFinite(runRecord.ttfs_delta_vs_baseline) ? runRecord.ttfs_delta_vs_baseline : "n/a";
  const rework = Number.isFinite(runRecord.rework_reduction_pct_vs_baseline)
    ? runRecord.rework_reduction_pct_vs_baseline
    : "n/a";

  const lines = [
    `# Phase 19 Case Study - ${runRecord.run_id}`,
    "",
    "## Lane truth",
    `- Runtime: ${runRecord.runtime_id}`,
    `- Lane: ${runRecord.lane_id}`,
    `- Lane support level: ${runRecord.lane_support_level}`,
    `- Workflow maturity: ${runRecord.workflow_maturity}`,
    `- Claim status: ${runRecord.claim_status}`,
    `- Reporting mode: ${runRecord.reporting_mode}`,
    `- ${laneSentence(context, runRecord)}`,
    "",
    "## Task",
    `- Task card: ${runRecord.task_card_id}`,
    `- Workflow: ${runRecord.workflow_id}`,
    `- Scenario: ${runRecord.scenario_id}`,
    `- Statement: ${runRecord.task_statement}`,
    "",
    "## Outcome",
    `- Task success: ${runRecord.task_success}`,
    `- PairSlash manual rescue count: ${runRecord.pairslash_manual_rescue_count}`,
    `- Trust boundary result: ${runRecord.trust_boundary_result}`,
    `- Weekly reuse answer: ${runRecord.weekly_reuse_answer}`,
    `- Weekly reuse reason: ${runRecord.weekly_reuse_reason}`,
    `- TTFS delta vs baseline: ${ttfs}`,
    `- Rework reduction vs baseline: ${rework}`,
    "",
    "## Evidence",
    ...runRecord.artifact_refs.map((ref) => `- ${ref}`),
    "",
    "## Guardrails",
    "- This case study is lane-scoped and must not be blended into cross-runtime parity wording.",
    "- Advanced lanes remain excluded from round-one benchmark claims.",
    "- If hard-fail conditions are active in scoring, this case study is evidence-only, not claim-enabling.",
    "",
  ];

  return lines.join("\n");
}

export function renderCaseStudyArtifacts({ repoRoot = process.cwd(), runIds = null } = {}) {
  const { context, records } = loadCapturedRunRecords({ repoRoot, runIds });
  const paths = buildPhase19Paths(repoRoot);
  ensureDir(paths.caseStudiesDir);

  const outputs = [];

  for (const runRecord of records) {
    const markdownPath = join(paths.caseStudiesDir, `${runRecord.run_id}.md`);
    const redactedJsonPath = join(paths.caseStudiesDir, `${runRecord.run_id}.redacted.json`);

    writeTextFile(markdownPath, `${renderCaseStudyMarkdown(context, runRecord)}\n`);

    const redacted = redactTraceEvents([runRecord], { repoRoot });
    writeTextFile(
      redactedJsonPath,
      stableJson({
        run_id: runRecord.run_id,
        redaction_report: redacted.report,
        record: redacted.events[0],
      }),
    );

    outputs.push({
      run_id: runRecord.run_id,
      markdown_path: relativeFrom(repoRoot, markdownPath),
      redacted_json_path: relativeFrom(repoRoot, redactedJsonPath),
      redaction_state: redacted.report.redaction_state,
    });
  }

  const indexPath = join(paths.caseStudiesDir, "index.md");
  const indexLines = [
    "# Phase 19 Case Studies",
    "",
    "Generated artifacts from captured benchmark runs.",
    "",
  ];

  for (const output of outputs) {
    indexLines.push(`- ${output.run_id}: ${output.markdown_path} (redaction_state=${output.redaction_state})`);
  }
  indexLines.push("");

  writeTextFile(indexPath, `${indexLines.join("\n")}\n`);

  return {
    kind: "phase19-case-study-render",
    generated_at: new Date().toISOString(),
    output_count: outputs.length,
    index_path: relativeFrom(repoRoot, indexPath),
    outputs,
  };
}

export function formatCaseStudyReportText(report) {
  const lines = [
    "Phase 19 case-study rendering",
    `Generated: ${report.output_count}`,
    `Index: ${report.index_path}`,
  ];

  for (const output of report.outputs) {
    lines.push(`- ${output.run_id}: ${output.markdown_path}`);
  }

  return `${lines.join("\n")}\n`;
}
