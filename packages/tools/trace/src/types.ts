// Shared trace record typings.
//
// TraceEvent mirrors the pairslash-trace-event document produced by
// emitTraceEvent (events.ts) and enforced by validateTraceEvent in
// @pairslash/spec-core. TraceIndex mirrors the session index documents
// written by buildSessionIndex (store.ts). Fields are optional unless the
// writers always emit them.

export type TraceEvent = {
  kind?: string;
  schema_version?: string;
  event_id?: string;
  event_type?: string;
  timestamp: string;
  session_id: string;
  workflow_id?: string | null;
  correlation_id?: string | null;
  runtime?: string | null;
  target?: string | null;
  severity?: string;
  failure_domain?: string;
  command_name?: string;
  actor?: string;
  source_package?: string;
  source_module?: string;
  outcome?: string;
  payload?: Record<string, unknown>;
  redaction_tags?: string[];
  telemetry_eligible?: boolean;
  pack_id?: string | null;
  contract_id?: string | null;
  error_code?: string | null;
  summary?: string | null;
  artifact_paths?: string[];
};

export type TraceIndex = {
  session_id: string;
  event_file: string;
  event_count?: number;
  runtime?: string | null;
  target?: string | null;
  command_name?: string;
  started_at?: string | null;
  finished_at?: string | null;
  last_outcome?: string | null;
  decisive_failure_domain?: string;
  decisive_reason?: string | null;
  related_artifacts?: string[];
};
