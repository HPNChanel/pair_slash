#!/usr/bin/env node

import process from "node:process";
import { resolve } from "node:path";

import { stableJson, writeTextFile } from "@pairslash/spec-core";

import {
  formatRoundOneReportText,
  runPhase19RoundOne,
} from "../packages/tools/benchmark/src/index.js";

function printUsage() {
  process.stdout.write(
    [
      "Usage:",
      "  node scripts/run-phase19-benchmark-round1.mjs [--format text|json] [--score-out path] [--no-case-studies] [--no-replay]",
      "",
      "Defaults:",
      "  --format text",
      "  --score-out docs-private/validation/phase-3-5/runs/round1-score.json",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const options = {
    format: "text",
    scoreOutPath: null,
    renderCaseStudies: true,
    replayArtifacts: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--format") {
      options.format = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--score-out") {
      options.scoreOutPath = argv[index + 1] ?? "";
      index += 1;
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
    if (token === "--help" || token === "-h") {
      options.help = true;
      continue;
    }
    throw new Error(`unknown flag: ${token}`);
  }

  if (!["text", "json"].includes(options.format)) {
    throw new Error(`unsupported format: ${options.format}`);
  }

  return options;
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    process.exit(0);
  }

  const report = runPhase19RoundOne({
    repoRoot: process.cwd(),
    scoreOutPath: options.scoreOutPath ? resolve(process.cwd(), options.scoreOutPath) : null,
    renderCaseStudies: options.renderCaseStudies,
    replayArtifacts: options.replayArtifacts,
  });

  if (options.format === "json") {
    process.stdout.write(stableJson(report));
  } else {
    process.stdout.write(formatRoundOneReportText(report));
  }

  if (options.scoreOutPath) {
    writeTextFile(resolve(process.cwd(), options.scoreOutPath), stableJson(report.score));
  }

  process.exit(report.status === "pass" ? 0 : 1);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  printUsage();
  process.exit(2);
}
