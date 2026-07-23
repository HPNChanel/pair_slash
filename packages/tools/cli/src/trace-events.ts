// PairSlash CLI trace-event helpers.
//
// Phase M1 (modernization foundation): extracted from bin/pairslash.js.
// No behavioral change — the existing cli.test.js suite is the contract.

import { resolve } from "node:path";

import { emitTraceEvent } from "@pairslash/trace";

const SOURCE_PACKAGE = "@pairslash/cli";
const SOURCE_MODULE = "bin/pairslash.ts";

export function collectArtifactPaths(value) {
  if (!value || typeof value !== "object") {
    return [];
  }
  const paths = [];
  for (const key of ["plan_path", "target_file", "audit_log_path", "output_dir", "output_path", "debug_report_path", "context_explanation_path", "policy_explanation_path", "doctor_report_path", "issue_template_path", "privacy_note_path", "reproducibility_template_path", "triage_template_path", "readme_path"]) {
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

export function emitCommandLifecycleStart(traceContext, command) {
  emitTraceEvent(traceContext, {
    eventType: "session.started",
    outcome: "started",
    sourcePackage: SOURCE_PACKAGE,
    sourceModule: SOURCE_MODULE,
    payload: { command },
    summary: `CLI session started for ${command}`,
  });
  emitTraceEvent(traceContext, {
    eventType: "workflow.started",
    outcome: "started",
    sourcePackage: SOURCE_PACKAGE,
    sourceModule: SOURCE_MODULE,
    payload: { command },
    summary: `Workflow started for ${command}`,
  });
  emitTraceEvent(traceContext, {
    eventType: "command.started",
    outcome: "started",
    sourcePackage: SOURCE_PACKAGE,
    sourceModule: SOURCE_MODULE,
    payload: { command },
    summary: `Command started: ${command}`,
  });
}

export function emitCommandLifecycleFinish(traceContext, {
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
    sourcePackage: SOURCE_PACKAGE,
    sourceModule: SOURCE_MODULE,
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
    sourcePackage: SOURCE_PACKAGE,
    sourceModule: SOURCE_MODULE,
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
    sourcePackage: SOURCE_PACKAGE,
    sourceModule: SOURCE_MODULE,
    payload: {
      command,
      exit_code: exitCode,
    },
    summary: summary ?? `${command} session finished`,
    artifactPaths,
  });
}

export function emitDerivedArtifactEvents(traceContext, result) {
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
