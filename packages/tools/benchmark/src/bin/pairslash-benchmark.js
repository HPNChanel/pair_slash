#!/usr/bin/env node
import { resolve } from "node:path";

import { stableJson, writeTextFile } from "@pairslash/spec-core";

import {
  captureBenchmarkRun,
  formatCaseStudyReportText,
  formatReplayReportText,
  formatRoundOneReportText,
  formatScoreReportText,
  formatValidationReportText,
  renderCaseStudyArtifacts,
  replayBenchmarkRun,
  replayBenchmarkRuns,
  runPhase19RoundOne,
  scoreBenchmarkRuns,
  validatePhase19BenchmarkConfig,
} from "../index.js";

function printUsage() {
  process.stdout.write(
    [
      "Usage:",
      "  pairslash-benchmark validate [--format text|json]",
      "  pairslash-benchmark capture --input <path> [--allow-overwrite] [--format text|json]",
      "  pairslash-benchmark score [--out path] [--run-ids id1,id2] [--format text|json]",
      "  pairslash-benchmark case [--run-id id] [--run-ids id1,id2] [--format text|json]",
      "  pairslash-benchmark replay [--run-id id | --run-ids id1,id2] [--format text|json]",
      "  pairslash-benchmark round1 [--score-out path] [--no-case-studies] [--no-replay] [--format text|json]",
      "",
      "Defaults:",
      "  --format text",
      "  repo root = current working directory",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { command: "help", options: {} };
  }

  const command = argv[0];
  const options = {
    format: "text",
    inputPath: null,
    outPath: null,
    scoreOutPath: null,
    runId: null,
    runIds: null,
    allowOverwrite: false,
    renderCaseStudies: true,
    replayArtifacts: true,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--format") {
      options.format = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--input") {
      options.inputPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--out") {
      options.outPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--score-out") {
      options.scoreOutPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--run-id") {
      options.runId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--run-ids") {
      options.runIds = (argv[index + 1] ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }
    if (token === "--allow-overwrite") {
      options.allowOverwrite = true;
      continue;
    }
    if (token === "--no-case-studies") {
      options.renderCaseStudies = false;
      continue;
    }
    if (token === "--no-replay") {
      options.replayArtifacts = false;
      continue;
    }
    throw new Error(`unknown flag: ${token}`);
  }

  if (!["text", "json"].includes(options.format)) {
    throw new Error(`unsupported format: ${options.format}`);
  }

  if (options.runId) {
    options.runIds = [options.runId];
  }

  return { command, options };
}

function emitReport(report, format, textFormatter) {
  if (format === "json") {
    process.stdout.write(stableJson(report));
    return;
  }
  process.stdout.write(textFormatter(report));
}

try {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (command === "help") {
    printUsage();
    process.exit(0);
  }

  if (command === "validate") {
    const report = validatePhase19BenchmarkConfig({ repoRoot: process.cwd() });
    emitReport(report, options.format, formatValidationReportText);
    process.exit(report.ok ? 0 : 1);
  }

  if (command === "capture") {
    if (!options.inputPath) {
      throw new Error("capture requires --input <path>");
    }
    const report = captureBenchmarkRun({
      repoRoot: process.cwd(),
      inputPath: options.inputPath,
      allowOverwrite: options.allowOverwrite,
    });
    emitReport(report, options.format, (value) => `${stableJson(value)}`);
    process.exit(report.ok ? 0 : 1);
  }

  if (command === "score") {
    const report = scoreBenchmarkRuns({
      repoRoot: process.cwd(),
      runIds: options.runIds,
    });
    if (options.outPath) {
      writeTextFile(resolve(process.cwd(), options.outPath), stableJson(report));
    }
    emitReport(report, options.format, formatScoreReportText);
    process.exit(report.claim_decision.claimable ? 0 : 1);
  }

  if (command === "case") {
    const report = renderCaseStudyArtifacts({
      repoRoot: process.cwd(),
      runIds: options.runIds,
    });
    emitReport(report, options.format, formatCaseStudyReportText);
    process.exit(0);
  }

  if (command === "replay") {
    const report = options.runId
      ? replayBenchmarkRun({ repoRoot: process.cwd(), runId: options.runId })
      : replayBenchmarkRuns({ repoRoot: process.cwd(), runIds: options.runIds });
    emitReport(report, options.format, formatReplayReportText);
    const ok = report.kind === "phase19-benchmark-replay" ? report.ok : report.fail_count === 0;
    process.exit(ok ? 0 : 1);
  }

  if (command === "round1") {
    const report = runPhase19RoundOne({
      repoRoot: process.cwd(),
      scoreOutPath: options.scoreOutPath ? resolve(process.cwd(), options.scoreOutPath) : null,
      renderCaseStudies: options.renderCaseStudies,
      replayArtifacts: options.replayArtifacts,
    });
    emitReport(report, options.format, formatRoundOneReportText);
    process.exit(report.status === "pass" ? 0 : 1);
  }

  throw new Error(`unknown command: ${command}`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  printUsage();
  process.exit(2);
}
