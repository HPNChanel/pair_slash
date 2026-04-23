import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildDebugReport,
  createSupportBundle,
  createTraceContext,
  emitTraceEvent,
  exportTrace,
  loadRetentionState,
  pruneTraceStore,
} from "../src/index.js";
import { createTempRepo } from "../../../../tests/phase4-helpers.js";

test("trace events build a debug report with decisive failure domain", () => {
  const fixture = createTempRepo();
  try {
    const context = createTraceContext({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      commandName: "doctor",
    });
    emitTraceEvent(context, {
      eventType: "command.started",
      outcome: "started",
      sourcePackage: "@pairslash/cli",
      sourceModule: "bin/pairslash.js",
      payload: {},
      summary: "doctor started",
    });
    emitTraceEvent(context, {
      eventType: "policy.evaluated",
      outcome: "denied",
      severity: "error",
      failureDomain: "policy",
      sourcePackage: "@pairslash/policy-engine",
      sourceModule: "src/index.js",
      payload: {
        overall_verdict: "deny",
      },
      summary: "Policy denied the requested operation.",
    });
    const report = buildDebugReport({
      repoRoot: fixture.tempRoot,
      sessionId: context.sessionId,
    });
    assert.equal(report.kind, "debug-report");
    assert.equal(report.decisive_failure_domain, "policy");
    assert.match(report.decisive_reason, /Policy denied/);
    assert.equal(report.timeline.length, 2);
  } finally {
    fixture.cleanup();
  }
});

test("trace export redacts sensitive fields and support bundle is shareable", () => {
  const fixture = createTempRepo();
  try {
    const context = createTraceContext({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      commandName: "memory write-global",
    });
    emitTraceEvent(context, {
      eventType: "memory.previewed",
      outcome: "blocked",
      severity: "warn",
      failureDomain: "memory",
      sourcePackage: "@pairslash/memory-engine",
      sourceModule: "src/index.js",
      payload: {
        statement: "secret memory statement",
        evidence: "sensitive evidence",
      },
      summary: "memory preview blocked",
      redactionTags: ["freeform-user-text"],
    });
    const traceExport = exportTrace({
      repoRoot: fixture.tempRoot,
      sessionId: context.sessionId,
    });
    assert.equal(traceExport.kind, "trace-export");
    assert.ok(traceExport.redaction_report.redacted_fields > 0);
    assert.equal(traceExport.redaction_report.redaction_state, "shareable");
    const eventsJsonl = readFileSync(join(traceExport.output_dir, "events.jsonl"), "utf8");
    assert.match(eventsJsonl, /\[HASH:/);

    const supportBundle = createSupportBundle({
      repoRoot: fixture.tempRoot,
      traceExport,
      contextExplanation: {
        kind: "context-explanation",
        runtime: "codex_cli",
        target: "repo",
      },
    });
    assert.equal(supportBundle.kind, "support-bundle");
    assert.equal(supportBundle.safe_to_share, true);
    assert.equal(supportBundle.privacy_descriptor.redaction_state, "shareable");
    assert.equal(supportBundle.failure_taxonomy.decisive_failure_domain, "memory");
    assert.equal(supportBundle.failure_taxonomy.recommended_surface_label, "surface:memory");
    assert.equal(supportBundle.failure_taxonomy.recommended_issue_template, ".github/ISSUE_TEMPLATE/memory-bug.md");
    assert.ok(supportBundle.debug_report_path);
    assert.ok(supportBundle.issue_template_path);
    assert.ok(supportBundle.privacy_note_path);
    assert.ok(supportBundle.failure_taxonomy_path);
    assert.ok(existsSync(join(supportBundle.output_dir, "bundle-manifest.json")));
    assert.ok(existsSync(join(supportBundle.output_dir, "issue-template.md")));
    assert.ok(existsSync(join(supportBundle.output_dir, "privacy-note.txt")));
    assert.ok(existsSync(join(supportBundle.output_dir, "failure-taxonomy.json")));
  } finally {
    fixture.cleanup();
  }
});

test("trace event classification keeps non-terminal lifecycle outcomes in failure_domain none", () => {
  const fixture = createTempRepo();
  try {
    const context = createTraceContext({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      commandName: "doctor",
    });
    const event = emitTraceEvent(context, {
      eventType: "command.started",
      outcome: "started",
      sourcePackage: "@pairslash/cli",
      sourceModule: "bin/pairslash.js",
      payload: {},
      summary: "policy checks are running",
    });
    assert.equal(event.failure_domain, "none");
  } finally {
    fixture.cleanup();
  }
});

test("support bundle is not shareable when unknown sensitive hits are present", () => {
  const fixture = createTempRepo();
  try {
    const context = createTraceContext({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      commandName: "doctor",
    });
    emitTraceEvent(context, {
      eventType: "error.raised",
      outcome: "failed",
      sourcePackage: "@pairslash/cli",
      sourceModule: "bin/pairslash.js",
      payload: {
        credential_blob: "Bearer ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
      },
      summary: "runtime host failure",
    });
    const traceExport = exportTrace({
      repoRoot: fixture.tempRoot,
      sessionId: context.sessionId,
    });
    assert.ok(traceExport.redaction_report.unknown_sensitive_hits > 0);
    const supportBundle = createSupportBundle({
      repoRoot: fixture.tempRoot,
      traceExport,
    });
    assert.equal(supportBundle.safe_to_share, false);
    assert.ok(supportBundle.share_safety_reasons.includes("unknown-sensitive-hits"));
    assert.equal(supportBundle.privacy_descriptor.redaction_state, "review-required");
    assert.equal(
      supportBundle.failure_taxonomy.decisive_failure_domain,
      supportBundle.trace_locator.decisive_failure_domain,
    );
  } finally {
    fixture.cleanup();
  }
});

test("retention pruning removes old index/event files and writes retention state", () => {
  const fixture = createTempRepo();
  try {
    const traceRoot = join(fixture.tempRoot, ".pairslash", "observability");
    const eventDir = join(traceRoot, "events", "2000", "01", "01");
    const indexesDir = join(traceRoot, "indexes");
    mkdirSync(eventDir, { recursive: true });
    mkdirSync(indexesDir, { recursive: true });
    const sessionId = "sess-20000101-old";
    const eventPath = join(eventDir, `${sessionId}.jsonl`);
    const indexPath = join(indexesDir, `${sessionId}.json`);
    writeFileSync(
      eventPath,
      `${JSON.stringify({
        kind: "pairslash-trace-event",
        schema_version: "1.0.0",
        event_id: "evt-old",
        event_type: "command.finished",
        timestamp: "2000-01-01T00:00:00.000Z",
        session_id: sessionId,
        workflow_id: "wf-old",
        correlation_id: "corr-old",
        runtime: "codex_cli",
        target: "repo",
        severity: "info",
        failure_domain: "none",
        command_name: "doctor",
        actor: "pairslash-cli",
        source_package: "@pairslash/cli",
        source_module: "bin/pairslash.js",
        outcome: "finished",
        payload: {},
        redaction_tags: [],
        telemetry_eligible: false,
      })}\n`,
    );
    writeFileSync(
      indexPath,
      JSON.stringify({
        session_id: sessionId,
        event_count: 1,
        runtime: "codex_cli",
        target: "repo",
        command_name: "doctor",
        started_at: "2000-01-01T00:00:00.000Z",
        finished_at: "2000-01-01T00:00:00.000Z",
        last_outcome: "finished",
        decisive_failure_domain: "none",
        decisive_reason: null,
        event_file: eventPath,
        related_artifacts: [],
      }),
    );

    const summary = pruneTraceStore({
      repoRoot: fixture.tempRoot,
      policy: {
        max_days: 1,
        max_sessions: 0,
        preserve_exports: true,
        preserve_bundles: true,
      },
      now: new Date("2026-03-29T00:00:00.000Z"),
    });
    assert.equal(summary.pruned_sessions, 1);
    assert.equal(existsSync(indexPath), false);
    assert.equal(existsSync(eventPath), false);
    const retentionState = loadRetentionState(fixture.tempRoot);
    assert.equal(retentionState.kind, "trace-retention-state");
    assert.equal(retentionState.pruned_sessions, 1);
  } finally {
    fixture.cleanup();
  }
});
