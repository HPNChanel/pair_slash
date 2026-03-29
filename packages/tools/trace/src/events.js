import {
  TRACE_EVENT_SCHEMA_VERSION,
  stableJson,
} from "@pairslash/spec-core";

import { inferFailureDomain, inferSeverity } from "./classify.js";
import { createCorrelationId, createEventId, createSessionId, createWorkflowId } from "./ids.js";
import { pruneTraceStore } from "./retention.js";
import { appendTraceEvent } from "./store.js";

const NON_FAILURE_OUTCOMES = new Set(["started", "ok", "pass", "allow", "finished", "exported"]);

export function createTraceContext({
  repoRoot,
  runtime = null,
  target = null,
  commandName,
  sessionId = null,
  workflowId = null,
  correlationId = null,
  actor = "pairslash-cli",
} = {}) {
  return {
    repoRoot,
    runtime,
    target,
    commandName,
    actor,
    sessionId: sessionId ?? createSessionId(),
    workflowId: workflowId ?? createWorkflowId(),
    correlationId: correlationId ?? createCorrelationId(),
  };
}

export function emitTraceEvent(context, {
  eventType,
  outcome,
  severity = inferSeverity(outcome),
  failureDomain = undefined,
  sourcePackage,
  sourceModule,
  payload = {},
  summary = null,
  redactionTags = [],
  telemetryEligible = false,
  artifactPaths = [],
  error = null,
  runtime = context.runtime,
  target = context.target,
  packId = null,
  contractId = null,
}) {
  const resolvedFailureDomain =
    failureDomain ??
    (NON_FAILURE_OUTCOMES.has(outcome)
      ? "none"
      : inferFailureDomain({
          commandName: context.commandName,
          eventType,
          message: summary ?? "",
          error,
          sourcePackage,
        }));
  const event = {
    kind: "pairslash-trace-event",
    schema_version: TRACE_EVENT_SCHEMA_VERSION,
    event_id: createEventId(),
    event_type: eventType,
    timestamp: new Date().toISOString(),
    session_id: context.sessionId,
    workflow_id: context.workflowId,
    correlation_id: context.correlationId,
    runtime,
    target,
    severity,
    failure_domain: resolvedFailureDomain,
    command_name: context.commandName,
    actor: context.actor,
    source_package: sourcePackage,
    source_module: sourceModule,
    outcome,
    payload,
    redaction_tags: [...new Set(redactionTags)].sort((left, right) => left.localeCompare(right)),
    telemetry_eligible: telemetryEligible,
    pack_id: packId,
    contract_id: contractId,
    error_code: error?.code ?? null,
    summary,
    artifact_paths: artifactPaths,
  };
  appendTraceEvent({
    repoRoot: context.repoRoot,
    event,
  });
  if (event.event_type === "session.finished") {
    try {
      pruneTraceStore({
        repoRoot: context.repoRoot,
        skipSessionIds: [event.session_id],
      });
    } catch {
      // Retention best-effort: trace writes must not fail due to prune maintenance.
    }
  }
  return event;
}

export function emitFailureEvent(context, error, details = {}) {
  return emitTraceEvent(context, {
    eventType: "error.raised",
    outcome: "failed",
    severity: "error",
    failureDomain: inferFailureDomain({
      error,
      commandName: context.commandName,
      sourcePackage: details.sourcePackage,
    }),
    sourcePackage: details.sourcePackage ?? "@pairslash/cli",
    sourceModule: details.sourceModule ?? "bin/pairslash.js",
    payload: {
      message: error?.message ?? String(error),
    },
    summary: error?.message ?? String(error),
    error,
    redactionTags: ["freeform-user-text"],
  });
}

export function formatTraceLine(value) {
  return stableJson(value);
}
