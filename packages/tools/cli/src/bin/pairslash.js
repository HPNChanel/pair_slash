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
import {
  applyMemoryWrite,
  loadRequestFile,
  loadStagedMemoryWritePreview,
  previewMemoryWrite,
  rejectMemoryWrite,
} from "@pairslash/memory-engine";
import { runDoctor } from "@pairslash/doctor";

import {
  formatDoctorText,
  formatInstallResult,
  formatLintText,
  formatMemoryWritePreviewBlockedText,
  formatMemoryWritePreviewText,
  formatMemoryWriteResultText,
  formatPreviewPlanText,
} from "../formatters.js";

const LIFECYCLE_ACTIONS = ["install", "update", "uninstall"];
const INSTALL_PACK_SETS = {
  bootstrap: ["pairslash-plan"],
  core: [],
};
const INSTALL_PACK_SET_VALUES = Object.keys(INSTALL_PACK_SETS);

function printUsage(stdout) {
  stdout.write(
    [
      "Usage:",
      "  pairslash preview <install|update|uninstall|memory-write-global> [pack-id...] [--runtime <codex|copilot|auto>] [--target repo|user] [--packs a,b] [--pack-set bootstrap|core] [--all] [--format text|json] [--plan-out path]",
      "  pairslash install [pack-id...] [--runtime <codex|copilot|auto>] [--target repo|user] [--packs a,b] [--pack-set bootstrap|core] [--all] [--format text|json] [--apply] [--dry-run] [--yes] [--non-interactive] [--plan-out path]",
      "  pairslash update [pack-id...] [--runtime <codex|copilot|auto>] [--target repo|user] [--packs a,b] [--from <version|manifest-digest>] [--to <pack.manifest.yaml>] [--format text|json] [--apply] [--dry-run] [--yes] [--non-interactive] [--plan-out path]",
      "  pairslash uninstall [pack-id...] [--runtime <codex|copilot|auto>] [--target repo|user] [--packs a,b] [--format text|json] [--apply] [--dry-run] [--yes] [--non-interactive] [--plan-out path]",
      "  pairslash doctor [--runtime <codex|copilot|auto>] [--target repo|user] [--packs a,b] [--format text|json] [--strict]",
      "  pairslash lint [pack-id...] [--runtime <codex|copilot|auto|all>] [--target repo|user] [--packs a,b] [--format text|json] [--strict]",
      "  pairslash memory write-global [--request path] [--kind <kind>] [--title text] [--statement text] [--evidence text] [--scope <whole-project|subsystem|path-prefix>] [--scope-detail text] [--confidence <low|medium|high>] [--action <append|supersede|reject-candidate-if-conflict>] [--tags a,b] [--source-refs a,b] [--supersedes kind/title] [--updated-by text] [--format text|json] [--apply] [--yes]",
      "",
      "Defaults:",
      "  install/update/uninstall preview by default; add --apply to mutate.",
      "  memory write-global previews by default; add --apply and explicit approval to commit.",
      "  install with no pack-id selects bootstrap pack-set (pairslash-plan).",
      "  use --pack-set core or --all to select all valid manifests under packs/core.",
      "  update/uninstall with no pack-id select all installed packs for the chosen runtime and target.",
      "  --runtime auto fails if more than one runtime is detected and no state disambiguates the lane.",
      "  Exit code 1 means invalid usage, blocked preview, or failed apply/doctor/lint.",
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
    packSet: "bootstrap",
    packSetProvided: false,
    requestPath: null,
    recordKind: null,
    title: null,
    statement: null,
    evidence: null,
    scope: null,
    scopeDetail: null,
    confidence: null,
    recordAction: null,
    tags: [],
    sourceRefs: [],
    supersedes: null,
    updatedBy: null,
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
    if (token === "--pack-set") {
      const packSet = argv[index + 1];
      if (!INSTALL_PACK_SET_VALUES.includes(packSet)) {
        throw new Error(`invalid --pack-set value: ${packSet}; expected one of ${INSTALL_PACK_SET_VALUES.join(", ")}`);
      }
      options.packSet = packSet;
      options.packSetProvided = true;
      index += 1;
      continue;
    }
    if (token === "--all") {
      options.packSet = "core";
      options.packSetProvided = true;
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
    if (token === "--request") {
      options.requestPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--kind") {
      options.recordKind = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--title") {
      options.title = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--statement") {
      options.statement = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--evidence") {
      options.evidence = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--scope") {
      options.scope = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--scope-detail") {
      options.scopeDetail = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--confidence") {
      options.confidence = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--action") {
      options.recordAction = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--tags") {
      options.tags = argv[index + 1]
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }
    if (token === "--source-refs") {
      options.sourceRefs = argv[index + 1]
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }
    if (token === "--supersedes") {
      options.supersedes = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--updated-by") {
      options.updatedBy = argv[index + 1];
      index += 1;
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

function assertLifecycleAction(action, { command = "command" } = {}) {
  if (LIFECYCLE_ACTIONS.includes(action)) {
    return;
  }
  const received = action ?? "(missing)";
  throw new Error(
    `unknown ${command} action: ${received}; expected one of ${LIFECYCLE_ACTIONS.join(", ")}`,
  );
}

function resolveInstallPacks(options) {
  if (options.packs.length > 0) {
    return options.packs;
  }
  return INSTALL_PACK_SETS[options.packSet] ?? INSTALL_PACK_SETS.bootstrap;
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

async function confirmMemoryWrite({ stdin, stdout, options }) {
  if (options.yes) {
    return true;
  }
  if (options.nonInteractive || !stdin?.isTTY || !stdout?.isTTY) {
    throw new Error("confirmation-required: rerun with --yes or use an interactive terminal");
  }
  const rl = createInterface({
    input: stdin,
    output: stdout,
  });
  try {
    const answer = await rl.question("Type 'write-global' to confirm: ");
    return answer.trim() === "write-global";
  } finally {
    rl.close();
  }
}

function buildMemoryRequest(repoRoot, options) {
  const requestFromFile = options.requestPath ? loadRequestFile(resolve(repoRoot, options.requestPath)) : {};
  return {
    ...requestFromFile,
    ...(options.recordKind ? { kind: options.recordKind } : {}),
    ...(options.title ? { title: options.title } : {}),
    ...(options.statement ? { statement: options.statement } : {}),
    ...(options.evidence ? { evidence: options.evidence } : {}),
    ...(options.scope ? { scope: options.scope } : {}),
    ...(options.scopeDetail ? { scope_detail: options.scopeDetail } : {}),
    ...(options.confidence ? { confidence: options.confidence } : {}),
    ...(options.recordAction ? { action: options.recordAction } : {}),
    ...(options.tags.length > 0 ? { tags: options.tags } : {}),
    ...(options.sourceRefs.length > 0 ? { source_refs: options.sourceRefs } : {}),
    ...(options.supersedes ? { supersedes: options.supersedes } : {}),
    ...(options.updatedBy ? { updated_by: options.updatedBy } : {}),
  };
}

function buildLifecycleEnvelope(action, repoRoot, options) {
  assertLifecycleAction(action, { command: "preview" });
  if (action !== "install" && options.packSetProvided) {
    throw new Error("--pack-set and --all are only available for install");
  }
  const packs = action === "install" ? resolveInstallPacks(options) : options.packs;
  return action === "install"
    ? planInstall({ repoRoot, runtime: options.runtime, target: options.target, packs })
    : action === "update"
      ? planUpdate({
          repoRoot,
          runtime: options.runtime,
          target: options.target,
          packs,
          from: options.from,
          to: options.to,
        })
      : planUninstall({
          repoRoot,
          runtime: options.runtime,
          target: options.target,
          packs,
        });
}

function handlePreview(action, repoRoot, options, stdout) {
  if (action === "memory-write-global") {
    throw new Error("memory-write-global preview requires interactive handler");
  }
  assertRuntime(options.runtime);
  if (options.force) {
    throw new Error("unsupported-flag: --force is not available in Phase 4");
  }
  const envelope = buildLifecycleEnvelope(action, repoRoot, options);
  const plan = materializePlan(repoRoot, envelope.plan, options.planOut);
  emit(stdout, plan, {
    format: options.format,
    text: formatPreviewPlanText,
  });
  return plan.can_apply ? 0 : 1;
}

async function handleApply(action, repoRoot, options, stdout, stdin) {
  assertRuntime(options.runtime);
  assertLifecycleAction(action);
  if (options.apply && options.dryRun) {
    throw new Error("--apply and --dry-run cannot be used together");
  }
  if (options.force) {
    throw new Error("unsupported-flag: --force is not available in Phase 4");
  }
  const envelope = buildLifecycleEnvelope(action, repoRoot, options);
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

async function handleMemoryWrite(repoRoot, options, stdout, stdin, { forcePreview = false } = {}) {
  const request = buildMemoryRequest(repoRoot, options);
  const runtime = options.runtime === "auto" ? "codex_cli" : options.runtime;
  const target = options.target;
  if (!options.apply || options.preview || forcePreview) {
    try {
      const preview = previewMemoryWrite({
        repoRoot,
        request,
        runtime,
        target,
      });
      emit(stdout, preview, {
        format: options.format,
        text: formatMemoryWritePreviewText,
      });
      return preview.ready_for_apply ? 0 : 1;
    } catch (error) {
      const blockedPreview = {
        kind: "memory-write-preview-blocked",
        runtime,
        target,
        blocked: true,
        no_silent_fallback: true,
        errors: [error.message],
        notes: ["invalid request source data blocks preview; no silent fallback"],
        request,
      };
      emit(stdout, blockedPreview, {
        format: options.format,
        text: formatMemoryWritePreviewBlockedText,
      });
      return 1;
    }
  }
  const stagedPreview = loadStagedMemoryWritePreview({
    repoRoot,
    request,
    runtime,
    target,
  });
  if (stagedPreview && options.format === "text") {
    emit(stdout, stagedPreview, {
      format: options.format,
      text: formatMemoryWritePreviewText,
    });
  }
  if (!stagedPreview?.ready_for_apply) {
    const blocked = applyMemoryWrite({
      repoRoot,
      request,
      runtime,
      target,
    });
    emit(stdout, blocked, {
      format: options.format,
      text: formatMemoryWriteResultText,
    });
    return blocked.committed ? 0 : 1;
  }
  const confirmed = await confirmMemoryWrite({ stdin, stdout, options });
  if (!confirmed) {
    const rejected = rejectMemoryWrite({
      repoRoot,
      request,
      runtime,
      target,
    });
    emit(stdout, rejected, {
      format: options.format,
      text: formatMemoryWriteResultText,
    });
    return 1;
  }
  const result = applyMemoryWrite({
    repoRoot,
    request,
    runtime,
    target,
  });
  emit(stdout, result, {
    format: options.format,
    text: formatMemoryWriteResultText,
  });
  return result.committed ? 0 : 1;
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
  const options = parseOptions(
    argv.slice(command === "preview" ? 2 : command === "memory" ? 2 : 1),
  );

  if (command === "preview") {
    const action = argv[1];
    if (action === "memory-write-global") {
      return handleMemoryWrite(repoRoot, options, stdout, stdin, { forcePreview: true });
    }
    return handlePreview(action, repoRoot, options, stdout);
  }
  if (command === "memory") {
    if (argv[1] !== "write-global") {
      throw new Error(`unknown memory command: ${argv[1] ?? "(missing)"}`);
    }
    return handleMemoryWrite(repoRoot, options, stdout, stdin);
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
    if (["fail", "unsupported"].includes(report.support_verdict)) {
      return 1;
    }
    if (options.strict && report.support_verdict !== "pass") {
      return 1;
    }
    return 0;
  }
  if (command === "lint") {
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
