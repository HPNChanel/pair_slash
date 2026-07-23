#!/usr/bin/env node
// PairSlash CLI entrypoint.
//
// Phase M1 (modernization foundation): this file was previously 1650 lines.
// Pure helpers, artifact builders, trace-event emitters, confirmation
// prompts, and command handlers now live in dedicated modules:
//
//   - src/internals.js ............ runtime/lifecycle helpers, asserts
//   - src/options.js .............. argument parser, option defaults
//   - src/explain.js .............. explain-context / explain-policy artifacts
//   - src/trace-events.js ......... lifecycle + derived artifact trace events
//   - src/handlers.js ............. preview/apply/memory command handlers
//
// This file is now the dispatcher only. No behavioral change — the existing
// cli.test.js suite is the contract.

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeRuntime } from "@pairslash/spec-core";
import { runLintBridge } from "@pairslash/lint-bridge";
import { runDoctor } from "@pairslash/doctor";
import {
  buildDebugReport,
  buildTelemetrySummary,
  createSupportBundle,
  createTraceContext,
  emitFailureEvent,
  emitTraceEvent,
  exportTelemetrySummary,
  exportTrace,
} from "@pairslash/trace";

import {
  formatContextExplanationText,
  formatDebugReportText,
  formatDoctorText,
  formatLintText,
  formatPolicyExplanationText,
  formatSupportBundleText,
  formatTelemetrySummaryText,
  formatTraceExportText,
} from "../formatters.ts";
import {
  emit,
  selectorFromOptions,
} from "../internals.ts";
import { parseOptions } from "../options.ts";
import {
  buildContextExplanationArtifact,
  buildPolicyExplanationArtifact,
  emitRuntimeHostProbed,
  tryBuildPolicyExplanationArtifact,
} from "../explain.ts";
import {
  collectArtifactPaths,
  emitCommandLifecycleFinish,
  emitCommandLifecycleStart,
  emitDerivedArtifactEvents,
} from "../trace-events.ts";
import {
  handleApply,
  handleMemoryAudit,
  handleMemoryCandidate,
  handleMemoryWrite,
  handlePreview,
} from "../handlers.ts";

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
      "  pairslash memory candidate --task-scope <text> [--runtime <codex|copilot|auto>] [--target repo|user] [--evidence-sources a,b] [--strictness <strict-gate-fail-fast|balanced|lenient>] [--max-candidates <n>] [--format text|json]",
      "  pairslash memory audit --audit-scope <full|project-memory-only|index-only> [--runtime <codex|copilot|auto>] [--target repo|user] [--mode <report-only|fix-proposal>] [--focus a,b] [--format text|json]",
      "  pairslash explain-context [pack-id] [--runtime <codex|copilot|auto>] [--target repo|user] [--format text|json]",
      "  pairslash explain-policy [pack-id] [--runtime <codex|copilot|auto>] [--target repo|user] [--apply] [--preview] [--surface <canonical_skill|direct_invocation|hook>] [--format text|json]",
      "  pairslash debug [--latest] [--session <id>] [--runtime <codex|copilot>] [--target repo|user] [--bundle] [--out path] [--format text|json]",
      "  pairslash trace export [--latest] [--session <id>] [--runtime <codex|copilot>] [--target repo|user] [--support-bundle] [--include-doctor] [--out path] [--format text|json]",
      "  pairslash telemetry summary [--runtime <codex|copilot>] [--target repo|user] [--out path] [--format text|json]",
      "",
      "Defaults:",
      "  install/update/uninstall preview by default; add --apply to mutate.",
      "  memory write-global previews by default; add --apply and explicit approval to commit.",
      "  memory candidate is read-only and never writes project-memory, index, audit, or staging.",
      "  memory audit is read-only and never mutates project-memory, index, audit, or staging.",
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
  const subcommand = command === "preview" || command === "memory" || command === "trace" || command === "telemetry" ? argv[1] : null;
  const observedCommand = subcommand ? `${command} ${subcommand}` : command;
  const options = parseOptions(
    argv.slice(command === "preview" || command === "memory" || command === "trace" || command === "telemetry" ? 2 : 1),
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
      if (argv[1] === "write-global") {
        result = await handleMemoryWrite(repoRoot, options, stdout, stdin);
      } else if (argv[1] === "candidate") {
        result = handleMemoryCandidate(repoRoot, options, stdout);
      } else if (argv[1] === "audit") {
        result = handleMemoryAudit(repoRoot, options, stdout);
      } else {
        throw new Error(`unknown memory command: ${argv[1] ?? "(missing)"}`);
      }
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
          debugReport,
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
        const debugReport = buildDebugReport({
          repoRoot,
          sessionId: traceExport.selector.session_id,
          selector: selectorFromOptions(options, traceContext),
        });
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
          debugReport,
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
    } else if (command === "telemetry") {
      if (argv[1] !== "summary") {
        throw new Error(`unknown telemetry command: ${argv[1] ?? "(missing)"}`);
      }
      const summary = options.out
        ? exportTelemetrySummary({
            repoRoot,
            runtime: options.runtime && options.runtime !== "auto" && options.runtime !== "all" ? normalizeRuntime(options.runtime) : null,
            target: options.target ?? null,
            outPath: options.out,
          })
        : buildTelemetrySummary({
            repoRoot,
            runtime: options.runtime && options.runtime !== "auto" && options.runtime !== "all" ? normalizeRuntime(options.runtime) : null,
            target: options.target ?? null,
          });
      emit(stdout, summary, {
        format: options.format,
        text: formatTelemetrySummaryText,
      });
        result = {
          exitCode: 0,
          artifact: summary,
          runtime:
            options.runtime === "auto" || options.runtime === "all" ? null : normalizeRuntime(options.runtime),
          target: options.target,
          summary: options.out ? "telemetry summary exported" : "telemetry summary created",
        };
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
