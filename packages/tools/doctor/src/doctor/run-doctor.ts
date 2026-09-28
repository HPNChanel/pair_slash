import {
  collectLifecycleReasonCodes,
} from "@pairslash/installer";
import {
  DOCTOR_REPORT_SCHEMA_VERSION,
  SUPPORT_VERDICTS,
  isOneOf,
  validateDoctorReport,
} from "@pairslash/spec-core";
import {
  CHECKS,
} from "./checks/index.ts";
import {
  ISSUE_STATUSES,
  buildBaseContext,
} from "./helpers.ts";
import {
  aggregateVerdict,
  buildDoctorRemediation,
  buildEnvironmentSummary,
  buildFirstWorkflowGuidance,
  buildInstalledPacks,
  buildIssues,
  buildNextActions,
  buildObservabilityHealth,
  buildRecentTraceSummary,
  buildRemediationActions,
  buildRuntimeCompatibility,
  buildScopeProbes,
  buildWorkflowMaturitySummary,
} from "./report.ts";

export function runDoctor({
  repoRoot,
  runtime,
  target = "repo",
  packs = [],
  skillRoot = "runtime-default",
  emit = "skill",
  _adapter_override = null,
  _runtime_selection_override = null,
  _os_override = null,
  _shell_override = null,
  _cwd_override = null,
}) {
  const context = buildBaseContext({
    repoRoot,
    runtime,
    target,
    packs,
    skillRoot,
    emit,
    adapterOverride: _adapter_override,
    runtimeSelectionOverride: _runtime_selection_override,
    osOverride: _os_override,
    shellOverride: _shell_override,
    cwdOverride: _cwd_override,
  });
  const checks = CHECKS.map((check) => check(context));
  const issues = buildIssues(checks);
  const remediationActions = buildRemediationActions(checks, issues);
  const installBlocked = checks.some(
    (check) => check.blocking_for_install && ISSUE_STATUSES.has(check.status),
  );
  const reasonCodes = collectLifecycleReasonCodes({
    checks,
    issues,
  });
  const remediation = buildDoctorRemediation({
    remediationActions,
    activeReasonCodes: reasonCodes,
    installBlocked,
    issues,
  });
  const workflowMaturity = buildWorkflowMaturitySummary(context);
  const report = {
    kind: "doctor-report",
    schema_version: DOCTOR_REPORT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    runtime: context.runtime,
    target: context.target,
    support_verdict: aggregateVerdict(checks),
    install_blocked: installBlocked,
    environment_summary: buildEnvironmentSummary(context),
    scope_probes: buildScopeProbes(context),
    support_lane: { ...context.supportLane },
    runtime_compatibility: buildRuntimeCompatibility(context, checks),
    recent_trace_summary: buildRecentTraceSummary(context.repoRoot, context.runtime, context.target),
    observability_health: buildObservabilityHealth(context.repoRoot, context.runtime, context.target),
    reason_codes: reasonCodes,
    remediation,
    remediation_actions: remediationActions,
    checks,
    issues,
    next_actions: buildNextActions(issues, remediationActions),
    workflow_maturity: workflowMaturity,
    installed_packs: buildInstalledPacks(context.state),
    first_workflow_guidance: buildFirstWorkflowGuidance(context, {
      installBlocked,
      workflowMaturity,
    }),
  };
  const errors = validateDoctorReport(report);
  if (errors.length > 0) {
    throw new Error(`invalid doctor report :: ${errors.join("; ")}`);
  }
  if (!isOneOf(report.support_verdict, SUPPORT_VERDICTS)) {
    throw new Error(`unsupported verdict emitted: ${report.support_verdict}`);
  }
  return report;
}
