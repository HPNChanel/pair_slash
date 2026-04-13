import { existsSync, readFileSync } from "node:fs";

import { buildPhase19Paths, listRunIds, resolveRunFile } from "./paths.js";
import { validateBenchmarkRunRecord } from "./run-record.js";
import { buildScenarioIndex, loadScenarioDefinitions, validateScenarioDefinitions } from "./scenarios.js";
import { loadPhase19BenchmarkContext } from "./truth.js";

export function validatePhase19BenchmarkConfig({ repoRoot = process.cwd() } = {}) {
  const context = loadPhase19BenchmarkContext(repoRoot);
  const paths = buildPhase19Paths(repoRoot);
  const scenarios = loadScenarioDefinitions(repoRoot);
  const scenarioValidation = validateScenarioDefinitions(scenarios, context);
  const scenarioIndex = buildScenarioIndex(scenarios);

  const runValidationErrors = [];
  const runValidationWarnings = [];

  for (const runId of listRunIds(repoRoot)) {
    const runPath = resolveRunFile(repoRoot, runId);
    if (!existsSync(runPath)) {
      runValidationErrors.push(`P19-VAL-001 missing run.json for ${runId}`);
      continue;
    }
    const parsed = JSON.parse(readFileSync(runPath, "utf8"));
    const validation = validateBenchmarkRunRecord(parsed, context, scenarioIndex);
    if (!validation.ok) {
      runValidationErrors.push(...validation.errors.map((error) => `${runId} ${error}`));
    }
    if (validation.warnings.length > 0) {
      runValidationWarnings.push(...validation.warnings.map((warning) => `${runId} ${warning}`));
    }
  }

  const ok = scenarioValidation.ok && runValidationErrors.length === 0;

  return {
    kind: "phase19-benchmark-validation",
    ok,
    errors: [...scenarioValidation.errors, ...runValidationErrors],
    warnings: [...scenarioValidation.warnings, ...runValidationWarnings],
    summary: {
      scenario_count: scenarios.length,
      run_count: listRunIds(repoRoot).length,
      lane_count: context.publicSupport.runtime_lanes.length,
      runtime_count: context.benchmarkDocuments.benchmarkTruth?.fixed_boundary?.supported_runtimes?.length ?? 0,
    },
  };
}

export function formatValidationReportText(report) {
  const lines = [
    "Phase 19 benchmark validation",
    `Status: ${report.ok ? "PASS" : "FAIL"}`,
    `Scenarios: ${report.summary.scenario_count}`,
    `Runs: ${report.summary.run_count}`,
    `Lanes: ${report.summary.lane_count}`,
    `Errors: ${report.errors.length}`,
    `Warnings: ${report.warnings.length}`,
  ];

  if (report.errors.length > 0) {
    lines.push("Validation errors:");
    for (const error of report.errors) {
      lines.push(`- ${error}`);
    }
  }

  if (report.warnings.length > 0) {
    lines.push("Validation warnings:");
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return `${lines.join("\n")}\n`;
}
