#!/usr/bin/env node

import process from "node:process";
import { resolve } from "node:path";

import { formatCompatAcceptanceText, runCompatAcceptance } from "@pairslash/compat-lab";
import { stableJson, writeTextFile } from "@pairslash/spec-core";

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/run-compat-lab-acceptance.mjs [--lane macos|linux|windows-prep|all] [--format text|json] [--report-out path]",
      "",
      "Defaults:",
      "  --lane all",
      "  --format text",
      "",
      "Exit codes:",
      "  0 = all required scenarios passed",
      "  1 = at least one acceptance lane or scenario failed",
      "  2 = invalid usage",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const options = {
    lane: "all",
    format: "text",
    reportOut: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--lane") {
      options.lane = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--format") {
      options.format = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--report-out") {
      options.reportOut = argv[index + 1] ?? "";
      index += 1;
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

function attachReportPath(report, reportPath) {
  if (!reportPath) {
    return report;
  }
  if (report.kind === "compat-lab-acceptance-suite") {
    return {
      ...report,
      artifact_paths: {
        report_path: reportPath,
      },
    };
  }
  return {
    ...report,
    artifact_paths: {
      ...report.artifact_paths,
      report_path: reportPath,
    },
  };
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    process.exit(0);
  }

  const reportPath = options.reportOut ? resolve(process.cwd(), options.reportOut) : null;
  const report = attachReportPath(
    runCompatAcceptance({
      repoRoot: process.cwd(),
      lane: options.lane,
    }),
    reportPath,
  );

  if (reportPath) {
    writeTextFile(reportPath, stableJson(report));
  }

  if (options.format === "json") {
    process.stdout.write(stableJson(report));
  } else {
    process.stdout.write(formatCompatAcceptanceText(report));
  }

  process.exit(report.status === "pass" ? 0 : 1);
} catch (error) {
  console.error(error.message);
  printUsage();
  process.exit(2);
}
