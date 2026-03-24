#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

import {
  normalizeRuntime,
  normalizeTarget,
  stableJson,
  writeTextFile,
} from "@pairslash/spec-core";
import { runLintBridge } from "@pairslash/lint-bridge";
import {
  applyInstall,
  applyUninstall,
  applyUpdate,
  planInstall,
  planUninstall,
  planUpdate,
} from "@pairslash/installer";
import { runDoctor } from "@pairslash/doctor";

import {
  formatDoctorText,
  formatInstallResult,
  formatLintText,
  formatPreviewPlanText,
} from "../formatters.js";

function printUsage(stdout) {
  stdout.write(
    [
      "Usage:",
      "  pairslash preview <install|update|uninstall> [pack-id...] [--runtime <codex|copilot|auto>] [--target repo|user] [--packs a,b] [--plan-out path]",
      "  pairslash install [pack-id...] [--runtime <codex|copilot|auto>] [--target repo|user] [--packs a,b] [--apply] [--dry-run] [--yes] [--non-interactive] [--plan-out path]",
      "  pairslash update [pack-id...] [--runtime <codex|copilot|auto>] [--target repo|user] [--packs a,b] [--from <version|manifest-digest>] [--to <pack.manifest.yaml>] [--apply] [--dry-run] [--yes] [--non-interactive] [--plan-out path]",
      "  pairslash uninstall [pack-id...] [--runtime <codex|copilot|auto>] [--target repo|user] [--packs a,b] [--apply] [--dry-run] [--yes] [--non-interactive] [--plan-out path]",
      "  pairslash doctor [--runtime <codex|copilot|auto>] [--target repo|user] [--packs a,b] [--format text|json] [--strict]",
      "  pairslash lint --phase4 [pack-id...] [--runtime <codex|copilot|auto|all>] [--target repo|user] [--packs a,b] [--format text|json] [--strict]",
      "",
    ].join("\n"),
  );
}

function parseOptions(argv) {
  const options = {
    runtime: "auto",
    target: "repo",
    packs: [],
    format: "text",
    apply: false,
    preview: false,
    dryRun: false,
    phase4: false,
    yes: false,
    nonInteractive: false,
    planOut: null,
    from: null,
    to: null,
    force: false,
    strict: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--runtime") {
      const runtime = argv[index + 1];
      options.runtime = runtime === "auto" || runtime === "all" ? runtime : normalizeRuntime(runtime);
      index += 1;
      continue;
    }
    if (token === "--target") {
      options.target = normalizeTarget(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--packs") {
      options.packs = argv[index + 1]
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }
    if (token === "--format") {
      options.format = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--apply") {
      options.apply = true;
      continue;
    }
    if (token === "--yes") {
      options.yes = true;
      continue;
    }
    if (token === "--non-interactive") {
      options.nonInteractive = true;
      continue;
    }
    if (token === "--preview") {
      options.preview = true;
      continue;
    }
    if (token === "--dry-run") {
      options.preview = true;
      options.dryRun = true;
      continue;
    }
    if (token === "--plan-out") {
      options.planOut = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--from") {
      options.from = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--to") {
      options.to = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--force") {
      options.force = true;
      continue;
    }
    if (token === "--phase4") {
      options.phase4 = true;
      continue;
    }
    if (token === "--strict") {
      options.strict = true;
      continue;
    }
    if (!token.startsWith("--")) {
      options.packs.push(token);
    }
  }
  options.packs = [...new Set(options.packs)];
  return options;
}

function emit(stdout, value, formatters) {
  if (formatters.format === "json") {
    stdout.write(stableJson(value));
    return;
  }
  stdout.write(formatters.text(value));
}

function assertRuntime(runtime) {
  if (!runtime) {
    throw new Error("--runtime is required");
  }
}

function materializePlan(repoRoot, plan, planOut) {
  if (!planOut) {
    return plan;
  }
  const planPath = resolve(repoRoot, planOut);
  const persisted = { ...plan, plan_path: planPath };
  writeTextFile(planPath, stableJson(persisted));
  return persisted;
}

async function confirmApply({ action, stdin, stdout, options }) {
  if (options.yes) {
    return;
  }
  if (options.nonInteractive || !stdin?.isTTY || !stdout?.isTTY) {
    throw new Error("confirmation-required: rerun with --yes or use an interactive terminal");
  }
  const rl = createInterface({
    input: stdin,
    output: stdout,
  });
  try {
    const answer = await rl.question(`Type '${action}' to confirm: `);
    if (answer.trim() !== action) {
      throw new Error(`confirmation-denied: expected '${action}'`);
    }
  } finally {
    rl.close();
  }
}

function handlePreview(action, repoRoot, options, stdout) {
  assertRuntime(options.runtime);
  if (options.force) {
    throw new Error("unsupported-flag: --force is not available in Phase 4");
  }
  const envelope =
    action === "install"
      ? planInstall({ repoRoot, runtime: options.runtime, target: options.target, packs: options.packs })
      : action === "update"
        ? planUpdate({
            repoRoot,
            runtime: options.runtime,
            target: options.target,
            packs: options.packs,
            from: options.from,
            to: options.to,
          })
        : planUninstall({
            repoRoot,
            runtime: options.runtime,
            target: options.target,
            packs: options.packs,
          });
  const plan = materializePlan(repoRoot, envelope.plan, options.planOut);
  emit(stdout, plan, {
    format: options.format,
    text: formatPreviewPlanText,
  });
  return plan.can_apply ? 0 : 1;
}

async function handleApply(action, repoRoot, options, stdout, stdin) {
  assertRuntime(options.runtime);
  if (options.apply && options.dryRun) {
    throw new Error("--apply and --dry-run cannot be used together");
  }
  if (options.force) {
    throw new Error("unsupported-flag: --force is not available in Phase 4");
  }
  const envelope =
    action === "install"
      ? planInstall({ repoRoot, runtime: options.runtime, target: options.target, packs: options.packs })
      : action === "update"
        ? planUpdate({
            repoRoot,
            runtime: options.runtime,
            target: options.target,
            packs: options.packs,
            from: options.from,
            to: options.to,
          })
        : planUninstall({
            repoRoot,
            runtime: options.runtime,
            target: options.target,
            packs: options.packs,
          });
  const plan = materializePlan(repoRoot, envelope.plan, options.planOut);
  if (!options.apply || options.preview) {
    emit(stdout, plan, {
      format: options.format,
      text: formatPreviewPlanText,
    });
    return plan.can_apply ? 0 : 1;
  }
  if (!plan.can_apply) {
    emit(stdout, plan, {
      format: options.format,
      text: formatPreviewPlanText,
    });
    return 1;
  }
  await confirmApply({ action, stdin, stdout, options });
  const result =
    action === "install"
      ? applyInstall(envelope)
      : action === "update"
        ? applyUpdate(envelope)
        : applyUninstall(envelope);
  emit(stdout, result, {
    format: options.format,
    text:
      action === "install" || action === "update" || action === "uninstall"
        ? formatInstallResult
        : (value) => `${stableJson(value)}`,
  });
  return 0;
}

export async function runCli({
  argv = process.argv.slice(2),
  cwd = process.cwd(),
  stdout = process.stdout,
  stdin = process.stdin,
} = {}) {
  if (argv.length === 0 || argv.includes("--help")) {
    printUsage(stdout);
    return 0;
  }
  const repoRoot = resolve(cwd);
  const command = argv[0];
  const options = parseOptions(argv.slice(command === "preview" ? 2 : 1));

  if (command === "preview") {
    const action = argv[1];
    return handlePreview(action, repoRoot, options, stdout);
  }
  if (command === "install" || command === "update" || command === "uninstall") {
    return handleApply(command, repoRoot, options, stdout, stdin);
  }
  if (command === "doctor") {
    const report = runDoctor({
      repoRoot,
      runtime: options.runtime,
      target: options.target,
      packs: options.packs,
    });
    emit(stdout, report, {
      format: options.format,
      text: formatDoctorText,
    });
    if (report.support_verdict === "fail") {
      return 1;
    }
    if (options.strict && ["warn", "degraded"].includes(report.support_verdict)) {
      return 1;
    }
    return 0;
  }
  if (command === "lint") {
    if (!options.phase4) {
      throw new Error("lint requires --phase4 in this release");
    }
    const report = runLintBridge({
      repoRoot,
      runtime: options.runtime,
      target: options.target,
      packs: options.packs,
    });
    emit(stdout, report, {
      format: options.format,
      text: formatLintText,
    });
    if (!report.ok) {
      return 1;
    }
    if (options.strict && report.summary.warning_count > 0) {
      return 1;
    }
    return 0;
  }
  throw new Error(`unknown command: ${command}`);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  runCli().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    },
  );
}
