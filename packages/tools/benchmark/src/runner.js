import { stableJson, writeTextFile } from "@pairslash/spec-core";

import { renderCaseStudyArtifacts } from "./case-study.js";
import { writeEvidenceLogArtifacts } from "./evidence-log.js";
import { buildPhase19Paths } from "./paths.js";
import { replayBenchmarkRuns } from "./replay.js";
import { formatScoreReportText, scoreBenchmarkRuns } from "./score.js";
import { formatValidationReportText, validatePhase19BenchmarkConfig } from "./validate.js";

export function runPhase19RoundOne({
  repoRoot = process.cwd(),
  scoreOutPath = null,
  renderCaseStudies = true,
  replayArtifacts = true,
} = {}) {
  const validation = validatePhase19BenchmarkConfig({ repoRoot });
  if (!validation.ok) {
    throw new Error(`phase19-validation-failed:${validation.errors.join("|")}`);
  }

  const scoreReport = scoreBenchmarkRuns({ repoRoot });
  const paths = buildPhase19Paths(repoRoot);
  const effectiveScoreOutPath = scoreOutPath ? scoreOutPath : paths.roundOneScorePath;
  writeTextFile(effectiveScoreOutPath, stableJson(scoreReport));

  const evidenceLogReport = writeEvidenceLogArtifacts({ repoRoot });
  const caseStudyReport = renderCaseStudies ? renderCaseStudyArtifacts({ repoRoot }) : null;
  const replayReport = replayArtifacts ? replayBenchmarkRuns({ repoRoot }) : null;

  return {
    kind: "phase19-round1-report",
    generated_at: new Date().toISOString(),
    status:
      scoreReport.claim_decision.claimable && (!replayReport || replayReport.fail_count === 0)
        ? "pass"
        : "fail",
    validation,
    score: scoreReport,
    evidence_log: evidenceLogReport,
    case_studies: caseStudyReport,
    replay: replayReport,
    score_path: effectiveScoreOutPath,
  };
}

export function formatRoundOneReportText(report) {
  const lines = [
    "Phase 19 round-one benchmark run",
    `Status: ${report.status.toUpperCase()}`,
    "",
    formatValidationReportText(report.validation).trimEnd(),
    "",
    formatScoreReportText(report.score).trimEnd(),
  ];

  if (report.evidence_log) {
    lines.push(
      "",
      `Evidence log: ${report.evidence_log.json_path} (${report.evidence_log.run_count} runs)`,
    );
  }

  if (report.case_studies) {
    lines.push("", `Case studies generated: ${report.case_studies.output_count}`);
  }
  if (report.replay) {
    lines.push("", `Replay pass/fail: ${report.replay.pass_count}/${report.replay.fail_count}`);
  }

  return `${lines.join("\n")}\n`;
}
