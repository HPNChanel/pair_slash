#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

import {
  exists,
  loadPackManifestRecords,
  normalizeRuntime,
  normalizeTarget,
  relativeFrom,
  selectPackManifestRecords,
  stableJson,
  validateContextExplanation,
  validatePolicyExplanation,
  walkFiles,
  writeTextFile,
} from "@pairslash/spec-core";
import { buildContractEnvelope, buildMemoryWriteContract } from "@pairslash/contract-engine";
import { runLintBridge } from "@pairslash/lint-bridge";
import {
  applyInstall,
  applyUninstall,
  applyUpdate,
  planInstall,
  planUninstall,
  planUpdate,
  resolveStatePath,
} from "@pairslash/installer";
import {
  applyMemoryWrite,
  loadRequestFile,
  loadStagedMemoryWritePreview,
  previewMemoryWrite,
  rejectMemoryWrite,
} from "@pairslash/memory-engine";
import { evaluatePolicy } from "@pairslash/policy-engine";
import * as codexAdapter from "@pairslash/runtime-codex-adapter";
import * as copilotAdapter from "@pairslash/runtime-copilot-adapter";
import { runDoctor } from "@pairslash/doctor";
import {
  buildDebugReport,
  createSupportBundle,
  createTraceContext,
  emitFailureEvent,
  emitTraceEvent,
  exportTrace,
  resolveTelemetryMode,
  resolveTraceRoot,
} from "@pairslash/trace";

import {
  formatContextExplanationText,
  formatDebugReportText,
  formatDoctorText,
  formatInstallResult,
  formatLintText,
  formatMemoryWritePreviewBlockedText,
  formatMemoryWritePreviewText,
  formatMemoryWriteResultText,
  formatPolicyExplanationText,
  formatPreviewPlanText,
  formatSupportBundleText,
  formatTraceExportText,
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
      "  pairslash explain-context [pack-id] [--runtime <codex|copilot|auto>] [--target repo|user] [--format text|json]",
      "  pairslash explain-policy [pack-id] [--runtime <codex|copilot|auto>] [--target repo|user] [--apply] [--preview] [--surface <canonical_skill|direct_invocation|hook>] [--format text|json]",
      "  pairslash debug [--latest] [--session <id>] [--runtime <codex|copilot>] [--target repo|user] [--bundle] [--out path] [--format text|json]",
      "  pairslash trace export [--latest] [--session <id>] [--runtime <codex|copilot>] [--target repo|user] [--support-bundle] [--include-doctor] [--out path] [--format text|json]",
      "",
      "Defaults:",
      "  install/update/uninstall preview by default; add --apply to mutate.",
      "  memory write-global previews by default; add --apply and explicit approval to commit.",
      "  debug/trace export select the latest matching recorded session unless --session is provided.",
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
    sessionId: null,
    latest: false,
    out: null,
    bundle: false,
    supportBundle: false,
    includeDoctor: false,
    surface: null,
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
    if (token === "--session") {
      options.sessionId = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--latest") {
      options.latest = true;
      continue;
    }
    if (token === "--out") {
      options.out = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--bundle") {
      options.bundle = true;
      continue;
    }
    if (token === "--support-bundle") {
      options.supportBundle = true;
      continue;
    }
    if (token === "--include-doctor") {
      options.includeDoctor = true;
      continue;
    }
    if (token === "--surface") {
      options.surface = argv[index + 1];
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

function getRuntimeAdapter(runtime) {
  const normalized = normalizeRuntime(runtime);
  return normalized === "codex_cli" ? codexAdapter : copilotAdapter;
}

function resolveSelectedPackRecord(repoRoot, requestedPacks = []) {
  const records = loadPackManifestRecords(repoRoot);
  const selection = selectPackManifestRecords(records, requestedPacks, { includeInvalid: true });
  if (selection.missing.length > 0) {
    throw new Error(`pack-not-found: ${selection.missing.join(", ")}`);
  }
  if (requestedPacks.length > 0 && selection.valid.length === 0 && selection.invalid.length > 0) {
    throw new Error(`invalid-pack-manifest: ${selection.invalid[0].manifestPath} :: ${selection.invalid[0].error}`);
  }
  const record =
    selection.valid[0] ??
    records.find((candidate) => candidate.packId === "pairslash-plan" && candidate.isValid) ??
    records.find((candidate) => candidate.isValid) ??
    null;
  return {
    record,
    selection,
  };
}

function deriveToolAvailability(report, packId, manifest) {
  const check = report.checks.find((entry) => entry.id === "dependencies.required_tools");
  const failures = [
    ...(check?.evidence?.failures ?? []),
    ...(check?.evidence?.warnings ?? []),
  ];
  return (manifest?.required_tools ?? []).map((tool) => ({
    id: tool.id,
    available: !failures.some((failure) => failure.pack_id === packId && failure.tool_id === tool.id),
    required_for: tool.required_for ?? [],
  }));
}

function listContextArtifacts(repoRoot, relativeRoot) {
  const absoluteRoot = resolve(repoRoot, relativeRoot);
  if (!exists(absoluteRoot)) {
    return [];
  }
  return walkFiles(absoluteRoot)
    .map((path) => {
      const relativePath = relativeFrom(repoRoot, path);
      return relativePath.startsWith(".")
        ? relativePath
        : `.${relativePath.startsWith("/") ? "" : "/"}${relativePath}`;
    })
    .sort((left, right) => left.localeCompare(right));
}

function buildMemoryReadArtifacts(repoRoot) {
  return {
    global_project_memory: listContextArtifacts(repoRoot, ".pairslash/project-memory"),
    task_memory: listContextArtifacts(repoRoot, ".pairslash/task-memory"),
    session_artifacts: [
      ...listContextArtifacts(repoRoot, ".pairslash/sessions"),
      ...listContextArtifacts(repoRoot, ".pairslash/staging"),
    ].sort((left, right) => left.localeCompare(right)),
  };
}

function buildContextExplanationArtifact({ repoRoot, options }) {
  const { record } = resolveSelectedPackRecord(repoRoot, options.packs);
  const packId = record?.packId ?? null;
  const report = runDoctor({
    repoRoot,
    runtime: options.runtime,
    target: options.target,
    packs: packId ? [packId] : [],
  });
  const adapter = getRuntimeAdapter(report.runtime);
  const manifest = record?.manifest ?? null;
  const artifact = {
    kind: "context-explanation",
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    runtime: report.runtime,
    target: report.target,
    pack_id: packId,
    manifest_path: record?.manifestPath ?? null,
    canonical_entrypoint: manifest?.canonical_entrypoint ?? "/skills",
    direct_invocation: manifest?.runtime_bindings?.[report.runtime]?.direct_invocation ?? null,
    supported_trigger_surfaces: adapter.listSupportedTriggerSurfaces({ manifest }),
    config_home: report.environment_summary.config_home,
    install_root: report.environment_summary.install_root,
    state_path: report.environment_summary.state_path,
    trace_root: resolveTraceRoot(repoRoot),
    telemetry_mode: resolveTelemetryMode(repoRoot),
    runtime_executable: report.environment_summary.runtime_executable,
    runtime_version: report.environment_summary.runtime_version,
    runtime_available: report.environment_summary.runtime_available,
    cwd: report.environment_summary.cwd,
    repo_root: report.environment_summary.repo_root,
    os: report.environment_summary.os,
    shell: report.environment_summary.shell,
    tool_availability: deriveToolAvailability(report, packId, manifest),
    memory_reads: buildMemoryReadArtifacts(repoRoot),
  };
  const validationErrors = validateContextExplanation(artifact);
  if (validationErrors.length > 0) {
    throw new Error(`invalid context explanation :: ${validationErrors.join("; ")}`);
  }
  return artifact;
}

function buildPolicyExplanationArtifact({ repoRoot, options }) {
  const { record } = resolveSelectedPackRecord(repoRoot, options.packs);
  if (!record) {
    throw new Error("policy-explain-requires-pack: no valid pack manifest found");
  }
  const report = runDoctor({
    repoRoot,
    runtime: options.runtime,
    target: options.target,
    packs: [record.packId],
  });
  const action =
    record.packId === "pairslash-memory-write-global" || record.manifest.workflow_class === "write-authority"
      ? "memory.write-global"
      : "run";
  const contract =
    action === "memory.write-global"
      ? buildMemoryWriteContract({
          manifest: record.manifest,
          runtime: report.runtime,
          target: report.target,
        })
      : buildContractEnvelope({
          manifest: record.manifest,
          runtime: report.runtime,
          target: report.target,
          action,
          sourceType: "workflow",
          sourcePath: record.manifestPath,
        });
  const requiredSurface = options.surface ?? "canonical_skill";
  const verdict = evaluatePolicy({
    contract,
    request: {
      action,
      apply: options.apply,
      preview_requested: options.apply ? options.preview : true,
      requested_runtime: report.runtime,
      requested_target: report.target,
      required_surface: requiredSurface,
      trigger_surface: requiredSurface,
    },
  });
  const artifact = {
    kind: "policy-explanation",
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    runtime: report.runtime,
    target: report.target,
    action,
    contract_id: contract.contract_id ?? null,
    overall_verdict: verdict.overall_verdict,
    summary: verdict.explanation?.summary ?? "No policy summary available.",
    decisive_reason_codes: verdict.explanation?.decisive_reason_codes ?? [],
    decisive_contract_fields: verdict.explanation?.decisive_contract_fields ?? [],
    decisive_runtime_factors: verdict.explanation?.decisive_runtime_factors ?? [],
    preview_required: verdict.preview_required,
    approval_required: verdict.approval_required,
    no_silent_fallback: verdict.explanation?.no_silent_fallback === true,
    allowed_operations: verdict.allowed_operations ?? [],
    blocked_operations: verdict.blocked_operations ?? [],
    reasons: verdict.reasons ?? [],
    capability_negotiation: verdict.capability_negotiation ?? [],
    verdict,
  };
  const validationErrors = validatePolicyExplanation(artifact);
  if (validationErrors.length > 0) {
    throw new Error(`invalid policy explanation :: ${validationErrors.join("; ")}`);
  }
  return {
    artifact,
    runtimeProbe: {
      runtime: report.runtime,
      target: report.target,
      executable: report.environment_summary.runtime_executable,
      version: report.environment_summary.runtime_version,
      available: report.environment_summary.runtime_available,
    },
  };
}

function selectorFromOptions(options, traceContext = null) {
  return {
    runtime: options.runtime && options.runtime !== "auto" ? normalizeRuntime(options.runtime) : null,
    target: options.target ?? null,
    exclude_session_id: traceContext?.sessionId ?? null,
  };
}

function emitRuntimeHostProbed(traceContext, probe) {
  emitTraceEvent(traceContext, {
    eventType: "runtime.host_probed",
    outcome: probe.available ? "pass" : "failed",
    runtime: probe.runtime ?? traceContext.runtime,
    target: probe.target ?? traceContext.target,
    failureDomain: probe.available ? "none" : "runtime_host",
    sourcePackage: "@pairslash/cli",
    sourceModule: "bin/pairslash.js",
    payload: {
      executable: probe.executable ?? null,
      version: probe.version ?? null,
      available: probe.available === true,
    },
    summary: probe.available
      ? `runtime host probe passed for ${probe.runtime}`
      : `runtime host probe failed for ${probe.runtime}`,
  });
}

function tryBuildPolicyExplanationArtifact({ repoRoot, options }) {
  try {
    return buildPolicyExplanationArtifact({ repoRoot, options });
  } catch {
    return null;
  }
}

function collectArtifactPaths(value) {
  if (!value || typeof value !== "object") {
    return [];
  }
  const paths = [];
  for (const key of ["plan_path", "target_file", "audit_log_path", "output_dir", "context_explanation_path", "policy_explanation_path", "doctor_report_path", "readme_path"]) {
    if (typeof value[key] === "string" && value[key].trim() !== "") {
      paths.push(value[key]);
    }
  }
  if (typeof value?.staging_artifact?.path === "string") {
    paths.push(resolve(value.staging_artifact.path));
  }
  if (Array.isArray(value?.files)) {
    for (const file of value.files) {
      if (typeof file?.path === "string") {
        paths.push(file.path);
      }
    }
  }
  return [...new Set(paths)];
}

function emitCommandLifecycleStart(traceContext, command) {
  emitTraceEvent(traceContext, {
    eventType: "session.started",
    outcome: "started",
    sourcePackage: "@pairslash/cli",
    sourceModule: "bin/pairslash.js",
    payload: { command },
    summary: `CLI session started for ${command}`,
  });
  emitTraceEvent(traceContext, {
    eventType: "workflow.started",
    outcome: "started",
    sourcePackage: "@pairslash/cli",
    sourceModule: "bin/pairslash.js",
    payload: { command },
    summary: `Workflow started for ${command}`,
  });
  emitTraceEvent(traceContext, {
    eventType: "command.started",
    outcome: "started",
    sourcePackage: "@pairslash/cli",
    sourceModule: "bin/pairslash.js",
    payload: { command },
    summary: `Command started: ${command}`,
  });
}

function emitCommandLifecycleFinish(traceContext, {
  command,
  exitCode,
  runtime = traceContext.runtime,
  target = traceContext.target,
  summary,
  artifact = null,
}) {
  const outcome = exitCode === 0 ? "ok" : "blocked";
  const artifactPaths = collectArtifactPaths(artifact);
  emitTraceEvent(traceContext, {
    eventType: "command.finished",
    outcome,
    runtime,
    target,
    failureDomain: exitCode === 0 ? "none" : null,
    sourcePackage: "@pairslash/cli",
    sourceModule: "bin/pairslash.js",
    payload: {
      command,
      exit_code: exitCode,
    },
    summary: summary ?? `${command} ${outcome}`,
    artifactPaths,
  });
  emitTraceEvent(traceContext, {
    eventType: "workflow.finished",
    outcome: exitCode === 0 ? "finished" : "failed",
    runtime,
    target,
    sourcePackage: "@pairslash/cli",
    sourceModule: "bin/pairslash.js",
    payload: {
      command,
      exit_code: exitCode,
    },
    summary: summary ?? `${command} finished`,
    artifactPaths,
  });
  emitTraceEvent(traceContext, {
    eventType: "session.finished",
    outcome: exitCode === 0 ? "finished" : "failed",
    runtime,
    target,
    sourcePackage: "@pairslash/cli",
    sourceModule: "bin/pairslash.js",
    payload: {
      command,
      exit_code: exitCode,
    },
    summary: summary ?? `${command} session finished`,
    artifactPaths,
  });
}

function emitDerivedArtifactEvents(traceContext, result) {
  const artifact = result?.artifact;
  if (!artifact || typeof artifact !== "object") {
    return;
  }
  if (artifact.policy_verdict?.overall_verdict) {
    emitTraceEvent(traceContext, {
      eventType: "policy.evaluated",
      outcome:
        artifact.policy_verdict.overall_verdict === "allow"
          ? "allow"
          : artifact.policy_verdict.overall_verdict === "deny"
            ? "denied"
            : "blocked",
      runtime: artifact.runtime ?? result.runtime ?? traceContext.runtime,
      target: artifact.target ?? result.target ?? traceContext.target,
      failureDomain: artifact.policy_verdict.overall_verdict === "allow" ? "none" : "policy",
      sourcePackage: "@pairslash/policy-engine",
      sourceModule: "src/index.js",
      payload: {
        overall_verdict: artifact.policy_verdict.overall_verdict,
      },
      summary: artifact.policy_verdict.explanation?.summary ?? `policy ${artifact.policy_verdict.overall_verdict}`,
      artifactPaths: collectArtifactPaths(artifact),
    });
  }
  if (artifact.kind === "memory-write-preview" || artifact.kind === "memory-write-preview-blocked") {
    emitTraceEvent(traceContext, {
      eventType: "memory.previewed",
      outcome: result.exitCode === 0 ? "ok" : "blocked",
      runtime: artifact.runtime ?? result.runtime ?? traceContext.runtime,
      target: artifact.target ?? result.target ?? traceContext.target,
      failureDomain: result.exitCode === 0 ? "none" : "memory",
      sourcePackage: "@pairslash/memory-engine",
      sourceModule: "src/index.js",
      payload: {
        ready_for_apply: artifact.ready_for_apply ?? false,
      },
      summary: result.summary,
      artifactPaths: collectArtifactPaths(artifact),
    });
  }
  if (artifact.kind === "memory-write-result") {
    const eventType =
      artifact.status === "committed"
        ? "memory.committed"
        : artifact.status === "rejected"
          ? "memory.rejected"
          : "memory.apply_attempted";
    emitTraceEvent(traceContext, {
      eventType,
      outcome: artifact.committed ? "ok" : artifact.status === "denied" ? "denied" : "blocked",
      runtime: artifact.runtime ?? result.runtime ?? traceContext.runtime,
      target: artifact.target ?? result.target ?? traceContext.target,
      failureDomain: artifact.committed ? "none" : artifact.policy_verdict?.overall_verdict === "deny" ? "policy" : "memory",
      sourcePackage: "@pairslash/memory-engine",
      sourceModule: "src/index.js",
      payload: {
        status: artifact.status,
        committed: artifact.committed,
      },
      summary: result.summary,
      artifactPaths: collectArtifactPaths(artifact),
    });
  }
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
  return {
    exitCode: plan.can_apply ? 0 : 1,
    artifact: plan,
    runtime: plan.runtime ?? options.runtime,
    target: plan.target ?? options.target,
    summary: `${action} preview ${plan.can_apply ? "ready" : "blocked"}`,
  };
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
    return {
      exitCode: plan.can_apply ? 0 : 1,
      artifact: plan,
      runtime: plan.runtime ?? options.runtime,
      target: plan.target ?? options.target,
      summary: `${action} preview ${plan.can_apply ? "ready" : "blocked"}`,
    };
  }
  if (!plan.can_apply) {
    emit(stdout, plan, {
      format: options.format,
      text: formatPreviewPlanText,
    });
    return {
      exitCode: 1,
      artifact: plan,
      runtime: plan.runtime ?? options.runtime,
      target: plan.target ?? options.target,
      summary: `${action} blocked by preview plan`,
    };
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
  return {
    exitCode: 0,
    artifact: result,
    runtime: result.runtime ?? options.runtime,
    target: result.target ?? options.target,
    summary: `${action} applied`,
  };
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
      return {
        exitCode: preview.ready_for_apply ? 0 : 1,
        artifact: preview,
        runtime: preview.runtime,
        target: preview.target,
        summary: `memory preview ${preview.ready_for_apply ? "ready" : "blocked"}`,
      };
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
      return {
        exitCode: 1,
        artifact: blockedPreview,
        runtime,
        target,
        summary: "memory preview blocked",
      };
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
    return {
      exitCode: blocked.committed ? 0 : 1,
      artifact: blocked,
      runtime: blocked.runtime,
      target: blocked.target,
      summary: `memory apply ${blocked.status}`,
    };
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
    return {
      exitCode: 1,
      artifact: rejected,
      runtime: rejected.runtime,
      target: rejected.target,
      summary: "memory preview rejected",
    };
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
  return {
    exitCode: result.committed ? 0 : 1,
    artifact: result,
    runtime: result.runtime,
    target: result.target,
    summary: `memory apply ${result.status}`,
  };
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
  const subcommand = command === "preview" || command === "memory" || command === "trace" ? argv[1] : null;
  const observedCommand = subcommand ? `${command} ${subcommand}` : command;
  const options = parseOptions(
    argv.slice(command === "preview" || command === "memory" || command === "trace" ? 2 : 1),
  );
  const traceContext = createTraceContext({
    repoRoot,
    runtime: options.runtime !== "auto" && options.runtime !== "all" ? normalizeRuntime(options.runtime) : null,
    target: options.target,
    commandName: observedCommand,
  });
  emitCommandLifecycleStart(traceContext, observedCommand);
  try {
    let result;
    if (command === "preview") {
      const action = argv[1];
      result =
        action === "memory-write-global"
          ? await handleMemoryWrite(repoRoot, options, stdout, stdin, { forcePreview: true })
          : handlePreview(action, repoRoot, options, stdout);
    } else if (command === "memory") {
      if (argv[1] !== "write-global") {
        throw new Error(`unknown memory command: ${argv[1] ?? "(missing)"}`);
      }
      result = await handleMemoryWrite(repoRoot, options, stdout, stdin);
    } else if (command === "install" || command === "update" || command === "uninstall") {
      result = await handleApply(command, repoRoot, options, stdout, stdin);
    } else if (command === "doctor") {
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
      emitTraceEvent(traceContext, {
        eventType: "doctor.check_completed",
        outcome: ["fail", "unsupported"].includes(report.support_verdict) ? "failed" : report.support_verdict === "pass" ? "pass" : "warn",
        runtime: report.runtime,
        target: report.target,
        sourcePackage: "@pairslash/doctor",
        sourceModule: "src/index.js",
        payload: {
          support_verdict: report.support_verdict,
          install_blocked: report.install_blocked,
        },
        summary: `doctor completed with verdict ${report.support_verdict}`,
      });
      const exitCode =
        ["fail", "unsupported"].includes(report.support_verdict) || (options.strict && report.support_verdict !== "pass")
          ? 1
          : 0;
      result = {
        exitCode,
        artifact: report,
        runtime: report.runtime,
        target: report.target,
        summary: `doctor ${report.support_verdict}`,
      };
    } else if (command === "lint") {
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
      const exitCode = !report.ok || (options.strict && report.summary.warning_count > 0) ? 1 : 0;
      result = {
        exitCode,
        artifact: report,
        runtime: options.runtime === "auto" || options.runtime === "all" ? null : normalizeRuntime(options.runtime),
        target: options.target,
        summary: `lint ${report.ok ? "pass" : "fail"}`,
      };
    } else if (command === "explain-context") {
      const artifact = buildContextExplanationArtifact({ repoRoot, options });
      emitRuntimeHostProbed(traceContext, {
        runtime: artifact.runtime,
        target: artifact.target,
        executable: artifact.runtime_executable,
        version: artifact.runtime_version,
        available: artifact.runtime_available,
      });
      emit(stdout, artifact, {
        format: options.format,
        text: formatContextExplanationText,
      });
      result = {
        exitCode: 0,
        artifact,
        runtime: artifact.runtime,
        target: artifact.target,
        summary: `context explained for ${artifact.pack_id ?? "repository"}`,
      };
    } else if (command === "explain-policy") {
      const { artifact, runtimeProbe } = buildPolicyExplanationArtifact({ repoRoot, options });
      emitRuntimeHostProbed(traceContext, runtimeProbe);
      emit(stdout, artifact, {
        format: options.format,
        text: formatPolicyExplanationText,
      });
      emitTraceEvent(traceContext, {
        eventType: "policy.evaluated",
        outcome:
          artifact.overall_verdict === "allow"
            ? "allow"
            : artifact.overall_verdict === "deny"
              ? "denied"
              : "blocked",
        runtime: artifact.runtime,
        target: artifact.target,
        failureDomain: artifact.overall_verdict === "allow" ? "none" : "policy",
        sourcePackage: "@pairslash/policy-engine",
        sourceModule: "src/index.js",
        payload: {
          action: artifact.action,
          overall_verdict: artifact.overall_verdict,
        },
        summary: artifact.summary,
        artifactPaths: [],
      });
      result = {
        exitCode: 0,
        artifact,
        runtime: artifact.runtime,
        target: artifact.target,
        summary: `policy explained for ${artifact.contract_id ?? "workflow"}`,
      };
    } else if (command === "debug") {
      const debugReport = buildDebugReport({
        repoRoot,
        sessionId: options.sessionId,
        selector: selectorFromOptions(options, traceContext),
      });
      if (options.bundle) {
        const traceExport = exportTrace({
          repoRoot,
          sessionId: debugReport.session_id,
          selector: selectorFromOptions(options, traceContext),
          outDir: options.out,
        });
        emitTraceEvent(traceContext, {
          eventType: "trace.exported",
          outcome: "exported",
          runtime: debugReport.runtime,
          target: debugReport.target,
          sourcePackage: "@pairslash/trace",
          sourceModule: "src/export.js",
          payload: {
            session_id: debugReport.session_id,
            output_dir: traceExport.output_dir,
          },
          summary: `trace exported for ${debugReport.session_id}`,
          artifactPaths: collectArtifactPaths(traceExport),
        });
        const contextExplanation = buildContextExplanationArtifact({ repoRoot, options });
        emitRuntimeHostProbed(traceContext, {
          runtime: contextExplanation.runtime,
          target: contextExplanation.target,
          executable: contextExplanation.runtime_executable,
          version: contextExplanation.runtime_version,
          available: contextExplanation.runtime_available,
        });
        const doctorReport = runDoctor({
          repoRoot,
          runtime: contextExplanation.runtime,
          target: contextExplanation.target,
          packs: options.packs,
        });
        const policyExplanationRecord = tryBuildPolicyExplanationArtifact({ repoRoot, options });
        const supportBundle = createSupportBundle({
          repoRoot,
          traceExport,
          doctorReport,
          contextExplanation,
          policyExplanation: policyExplanationRecord?.artifact ?? null,
          outDir: options.out ? resolve(repoRoot, options.out, "bundle") : null,
        });
        emitTraceEvent(traceContext, {
          eventType: "support.bundle_created",
          outcome: "exported",
          runtime: debugReport.runtime,
          target: debugReport.target,
          sourcePackage: "@pairslash/trace",
          sourceModule: "src/export.js",
          payload: {
            session_id: debugReport.session_id,
            output_dir: supportBundle.output_dir,
          },
          summary: `support bundle created for ${debugReport.session_id}`,
          artifactPaths: collectArtifactPaths(supportBundle),
        });
        const payload = {
          debug_report: debugReport,
          support_bundle: supportBundle,
        };
        emit(stdout, payload, {
          format: options.format,
          text: (value) => `${formatDebugReportText(value.debug_report)}\n${formatSupportBundleText(value.support_bundle)}`,
        });
        result = {
          exitCode: 0,
          artifact: payload,
          runtime: debugReport.runtime,
          target: debugReport.target,
          summary: `debug bundle created for ${debugReport.session_id}`,
        };
      } else {
        emit(stdout, debugReport, {
          format: options.format,
          text: formatDebugReportText,
        });
        result = {
          exitCode: 0,
          artifact: debugReport,
          runtime: debugReport.runtime,
          target: debugReport.target,
          summary: `debug report created for ${debugReport.session_id}`,
        };
      }
    } else if (command === "trace") {
      if (argv[1] !== "export") {
        throw new Error(`unknown trace command: ${argv[1] ?? "(missing)"}`);
      }
      const traceExport = exportTrace({
        repoRoot,
        sessionId: options.sessionId,
        selector: selectorFromOptions(options, traceContext),
        outDir: options.out,
      });
      emitTraceEvent(traceContext, {
        eventType: "trace.exported",
        outcome: "exported",
        runtime: traceExport.selector.runtime,
        target: traceExport.selector.target,
        sourcePackage: "@pairslash/trace",
        sourceModule: "src/export.js",
        payload: {
          session_id: traceExport.selector.session_id,
          output_dir: traceExport.output_dir,
        },
        summary: `trace exported for ${traceExport.selector.session_id}`,
        artifactPaths: collectArtifactPaths(traceExport),
      });
      if (options.supportBundle) {
        const contextExplanation = buildContextExplanationArtifact({ repoRoot, options });
        emitRuntimeHostProbed(traceContext, {
          runtime: contextExplanation.runtime,
          target: contextExplanation.target,
          executable: contextExplanation.runtime_executable,
          version: contextExplanation.runtime_version,
          available: contextExplanation.runtime_available,
        });
        const doctorReport = options.includeDoctor
          ? runDoctor({
              repoRoot,
              runtime: contextExplanation.runtime,
              target: contextExplanation.target,
              packs: options.packs,
            })
          : null;
        const policyExplanationRecord = tryBuildPolicyExplanationArtifact({ repoRoot, options });
        const supportBundle = createSupportBundle({
          repoRoot,
          traceExport,
          doctorReport,
          contextExplanation,
          policyExplanation: policyExplanationRecord?.artifact ?? null,
          outDir: options.out ? resolve(repoRoot, options.out, "bundle") : null,
        });
        emitTraceEvent(traceContext, {
          eventType: "support.bundle_created",
          outcome: "exported",
          runtime: contextExplanation.runtime,
          target: contextExplanation.target,
          sourcePackage: "@pairslash/trace",
          sourceModule: "src/export.js",
          payload: {
            session_id: traceExport.selector.session_id,
            output_dir: supportBundle.output_dir,
          },
          summary: `support bundle created for ${traceExport.selector.session_id}`,
          artifactPaths: collectArtifactPaths(supportBundle),
        });
        const payload = {
          trace_export: traceExport,
          support_bundle: supportBundle,
        };
        emit(stdout, payload, {
          format: options.format,
          text: (value) => `${formatTraceExportText(value.trace_export)}\n${formatSupportBundleText(value.support_bundle)}`,
        });
        result = {
          exitCode: 0,
          artifact: payload,
          runtime: contextExplanation.runtime,
          target: contextExplanation.target,
          summary: `trace export and support bundle created`,
        };
      } else {
        emit(stdout, traceExport, {
          format: options.format,
          text: formatTraceExportText,
        });
        result = {
          exitCode: 0,
          artifact: traceExport,
          runtime: traceExport.selector.runtime,
          target: traceExport.selector.target,
          summary: `trace export created`,
        };
      }
    } else {
      throw new Error(`unknown command: ${command}`);
    }
    emitDerivedArtifactEvents(traceContext, result);
    emitCommandLifecycleFinish(traceContext, {
      command: observedCommand,
      ...result,
    });
    return result.exitCode;
  } catch (error) {
    emitFailureEvent(traceContext, error, {
      sourcePackage: "@pairslash/cli",
      sourceModule: "bin/pairslash.js",
    });
    emitCommandLifecycleFinish(traceContext, {
      command: observedCommand,
      exitCode: 1,
      summary: error.message,
    });
    throw error;
  }
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
