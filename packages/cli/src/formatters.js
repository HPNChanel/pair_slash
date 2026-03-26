export function formatPreviewPlanText(plan) {
  const lines = [
    `Action: ${plan.action}`,
    `Runtime: ${plan.runtime}`,
    `Target: ${plan.target}`,
    `Install root: ${plan.install_root}`,
    `State path: ${plan.state_path}`,
    `Can apply: ${plan.can_apply ? "yes" : "no"}`,
    `Requires confirmation: ${plan.requires_confirmation ? "yes" : "no"}`,
    `Selected packs: ${plan.selected_packs.length > 0 ? plan.selected_packs.join(", ") : "none"}`,
    "",
    "Summary:",
  ];
  for (const [kind, count] of Object.entries(plan.summary)) {
    lines.push(`- ${kind}: ${count}`);
  }
  if (plan.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of plan.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  if (plan.errors.length > 0) {
    lines.push("", "Errors:");
    for (const error of plan.errors) {
      lines.push(`- ${error}`);
    }
  }
  lines.push("", "Operations:");
  if (plan.operations.length === 0) {
    lines.push("- no file changes required");
  } else {
    for (const operation of plan.operations) {
      const rel = operation.relative_path ? `/${operation.relative_path}` : "";
      const details = [
        operation.asset_kind ? `kind=${operation.asset_kind}` : null,
        operation.install_surface ? `surface=${operation.install_surface}` : null,
        operation.ownership ? `owner=${operation.ownership}` : null,
        typeof operation.override_eligible === "boolean"
          ? `override=${operation.override_eligible ? "yes" : "no"}`
          : null,
      ].filter(Boolean);
      lines.push(`- ${operation.kind} [${operation.pack_id}${rel}] ${operation.absolute_path}`);
      lines.push(`  ${operation.reason}${details.length > 0 ? ` :: ${details.join(", ")}` : ""}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function formatDoctorText(report) {
  const blockingIssues = report.issues.filter((issue) => issue.blocking_for_install);
  const advisoryIssues = report.issues.filter((issue) => !issue.blocking_for_install);
  const selectedScope = report.scope_probes[report.target];
  const alternateScope = report.scope_probes[report.target === "repo" ? "user" : "repo"];
  const presenceCheck = report.checks.find((check) => check.id === "runtime.presence_matrix");
  const immediateNextAction = report.next_actions[0] ?? report.first_workflow_guidance.commands[0] ?? "No action required.";
  const lines = [
    `Runtime: ${report.runtime}`,
    `Target: ${report.target}`,
    `Verdict: ${report.support_verdict.toUpperCase()}`,
    `Install blocked: ${report.install_blocked ? "yes" : "no"}`,
    "",
    "Environment summary:",
    `- OS: ${report.environment_summary.os}`,
    `- Shell: ${report.environment_summary.shell}`,
    `- Shell profiles: ${
      report.environment_summary.shell_profile_candidates.length > 0
        ? report.environment_summary.shell_profile_candidates.join(", ")
        : "none"
    }`,
    `- Config home: ${report.environment_summary.config_home}`,
    `- Install root: ${report.environment_summary.install_root}`,
    `- State path: ${report.environment_summary.state_path}`,
    `- Runtime executable: ${report.environment_summary.runtime_executable ?? "none"}`,
    `- Runtime version: ${report.environment_summary.runtime_version ?? "unknown"}`,
    `- Runtime available: ${report.environment_summary.runtime_available ? "yes" : "no"}`,
  ];
  if (presenceCheck?.evidence?.runtimes) {
    const runtimes = presenceCheck.evidence.runtimes;
    lines.push(
      `- Codex present: ${runtimes.codex_cli?.available ? "yes" : "no"}${runtimes.codex_cli?.version ? ` (${runtimes.codex_cli.version})` : ""}`,
    );
    lines.push(
      `- Copilot present: ${runtimes.copilot_cli?.available ? "yes" : "no"}${runtimes.copilot_cli?.version ? ` (${runtimes.copilot_cli.version})` : ""}`,
    );
  }
  lines.push(
    "",
    `Immediate next action: ${immediateNextAction}`,
    "",
    "Support lane:",
    `- Lane status: ${report.support_lane.lane_status}`,
    `- Tested range status: ${report.support_lane.tested_range_status}`,
    `- Tested version range: ${report.support_lane.tested_version_range ?? "none recorded"}`,
    `- Evidence source: ${report.support_lane.evidence_source}`,
    `- Summary: ${report.support_lane.summary}`,
    "",
    "Scope probes:",
    `- Selected scope (${selectedScope.target}): verdict=${selectedScope.verdict}, writable=${selectedScope.writable ? "yes" : "no"}, config_home=${selectedScope.config_home}, install_root=${selectedScope.install_root}`,
    `- Alternate scope (${alternateScope.target}): verdict=${alternateScope.verdict}, writable=${alternateScope.writable ? "yes" : "no"}, config_home=${alternateScope.config_home}, install_root=${alternateScope.install_root}`,
    "",
    "Runtime compatibility:",
    `- Requested packs: ${report.runtime_compatibility.selected_pack_count}`,
    `- Compatible packs: ${report.runtime_compatibility.compatible_pack_count}`,
    `- Runtime range status: ${report.runtime_compatibility.requested_runtime_range_max_status}`,
    `- Incompatible packs: ${
      report.runtime_compatibility.incompatible_pack_ids.length > 0
        ? report.runtime_compatibility.incompatible_pack_ids.join(", ")
        : "none"
    }`,
    "",
    "Blocking issues:",
  );
  if (blockingIssues.length === 0) {
    lines.push("- none");
  } else {
    for (const issue of blockingIssues) {
      lines.push(`- ${issue.verdict} ${issue.code}: ${issue.summary}`);
      if (issue.suggested_fix) {
        lines.push(`  fix: ${issue.suggested_fix}`);
      }
    }
  }
  lines.push("", "Advisory issues:");
  if (advisoryIssues.length === 0) {
    lines.push("- none");
  } else {
    for (const issue of advisoryIssues) {
      lines.push(`- ${issue.verdict} ${issue.code}: ${issue.summary}`);
      if (issue.suggested_fix) {
        lines.push(`  fix: ${issue.suggested_fix}`);
      }
    }
  }
  lines.push("", "Checks:");
  for (const check of report.checks) {
    lines.push(
      `- ${check.status} ${check.id}: ${check.summary}${check.blocking_for_install ? " [blocking]" : ""}`,
    );
  }
  lines.push("", "Next actions:");
  for (const action of report.next_actions) {
    lines.push(`- ${action}`);
  }
  lines.push("", "First workflow:");
  lines.push(`- Ready now: ${report.first_workflow_guidance.ready ? "yes" : "no"}`);
  lines.push(
    `- Recommended pack: ${report.first_workflow_guidance.recommended_pack_id ?? "none"}`,
  );
  lines.push(`- Rationale: ${report.first_workflow_guidance.rationale}`);
  for (const command of report.first_workflow_guidance.commands) {
    lines.push(`- ${command}`);
  }
  lines.push("", "Installed packs:");
  if (report.installed_packs.length === 0) {
    lines.push("- none");
  } else {
    for (const pack of report.installed_packs) {
      lines.push(
        `- ${pack.id}: version=${pack.version}, local_overrides=${pack.local_overrides}, install_dir=${pack.install_dir}`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

export function formatLintText(report) {
  const lines = [
    `PairSlash lint: ${report.ok ? "pass" : "fail"}`,
    `Phase: ${report.phase}`,
    `Target: ${report.target}`,
    `Runtime scope: ${report.runtime_scope}`,
  ];
  if (report.contract_schema_version && report.policy_schema_version) {
    lines.push(
      `Contract schema: ${report.contract_schema_version}`,
      `Policy schema: ${report.policy_schema_version}`,
    );
  }
  lines.push(
    "",
    "Summary:",
    `- packs: ${report.summary.pack_count}`,
    `- runtimes: ${report.summary.runtime_count}`,
    `- checks: ${report.summary.check_count}`,
    `- errors: ${report.summary.error_count}`,
    `- warnings: ${report.summary.warning_count}`,
    `- notes: ${report.summary.note_count}`,
    "",
    "Issues:",
  );
  if (report.issues.length === 0) {
    lines.push("- none");
  } else {
    for (const issue of report.issues) {
      const location = [issue.pack_id ?? "global", issue.runtime, issue.path ?? "n/a"].join(" :: ");
      lines.push(`- [${issue.result}] ${issue.code} ${location}`);
      lines.push(`  ${issue.message}`);
      if (issue.remediation) {
        lines.push(`  remediation: ${issue.remediation}`);
      }
    }
  }
  if (Array.isArray(report.policy_verdicts)) {
    lines.push("", "Policy Verdicts:");
    if (report.policy_verdicts.length === 0) {
      lines.push("- none");
    } else {
      for (const verdict of report.policy_verdicts) {
        lines.push(`- ${verdict.pack_id ?? "global"} :: ${verdict.runtime} :: ${verdict.overall_verdict}`);
        if (verdict.explanation?.summary) {
          lines.push(`  ${verdict.explanation.summary}`);
        }
      }
    }
  }
  lines.push("", "Next actions:");
  for (const action of report.next_actions) {
    lines.push(`- ${action}`);
  }
  return `${lines.join("\n")}\n`;
}

export function formatInstallResult(result) {
  const lines = [
    `Action: ${result.action}`,
    `Runtime: ${result.runtime}`,
    `Target: ${result.target}`,
    `State path: ${result.state_path}`,
    `Journal path: ${result.journal_path ?? "none"}`,
    `Selected packs: ${result.selected_packs.join(", ")}`,
    "",
    "Summary:",
  ];
  for (const [kind, count] of Object.entries(result.summary)) {
    if (count > 0) {
      lines.push(`- ${kind}: ${count}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function formatMemoryWritePreviewText(preview) {
  const lines = [
    "Action: memory.write-global",
    `Runtime: ${preview.runtime}`,
    `Target: ${preview.target}`,
    `Disposition: ${preview.record_disposition}`,
    `Policy verdict: ${preview.policy_verdict.overall_verdict}`,
    `Ready for apply: ${preview.ready_for_apply ? "yes" : "no"}`,
    `Requires confirmation: ${preview.requires_confirmation ? "yes" : "no"}`,
    `Target file: ${preview.preview_patch.target_file ?? "unresolved"}`,
    `Staging artifact: ${preview.staging_artifact.path} (${preview.staging_artifact.exists ? "present" : "missing"})`,
  ];
  if (preview.related_records.length > 0) {
    lines.push(`Related records: ${preview.related_records.length}`);
  }
  if (preview.duplicate_matches.length > 0) {
    lines.push(`Duplicate matches: ${preview.duplicate_matches.length}`);
  }
  if (preview.conflict_matches.length > 0) {
    lines.push(`Conflict matches: ${preview.conflict_matches.length}`);
  }
  if (preview.policy_verdict.explanation?.summary) {
    lines.push(`Policy summary: ${preview.policy_verdict.explanation.summary}`);
  }
  if (preview.policy_verdict.reasons?.length > 0) {
    lines.push("", "Policy reasons:");
    for (const reason of preview.policy_verdict.reasons) {
      lines.push(`- ${reason.code}: ${reason.message}`);
    }
  }
  if (preview.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of preview.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  if (preview.errors.length > 0) {
    lines.push("", "Errors:");
    for (const error of preview.errors) {
      lines.push(`- ${error}`);
    }
  }
  lines.push("", preview.preview_patch.text || "Preview unavailable.");
  return `${lines.join("\n")}\n`;
}

export function formatMemoryWriteResultText(result) {
  const lines = [
    "Action: memory.write-global",
    `Status: ${result.status}`,
    `Runtime: ${result.runtime}`,
    `Target: ${result.target}`,
    `Disposition: ${result.record_disposition}`,
    `Committed: ${result.committed ? "yes" : "no"}`,
    `Policy verdict: ${result.policy_verdict.overall_verdict}`,
    `Target file: ${result.target_file ?? "none"}`,
    `Staging artifact: ${result.staging_artifact.path} (${result.staging_artifact.exists ? "present" : "missing"})`,
    `Audit log: ${result.audit_log_path ?? "none"}`,
    `Index updated: ${result.index_updated ? "yes" : "no"}`,
  ];
  if (result.related_records.length > 0) {
    lines.push(`Related records: ${result.related_records.length}`);
  }
  if (result.duplicate_matches.length > 0) {
    lines.push(`Duplicate matches: ${result.duplicate_matches.length}`);
  }
  if (result.conflict_matches.length > 0) {
    lines.push(`Conflict matches: ${result.conflict_matches.length}`);
  }
  if (result.policy_verdict.explanation?.summary) {
    lines.push(`Policy summary: ${result.policy_verdict.explanation.summary}`);
  }
  if (result.policy_verdict.reasons?.length > 0) {
    lines.push("", "Policy reasons:");
    for (const reason of result.policy_verdict.reasons) {
      lines.push(`- ${reason.code}: ${reason.message}`);
    }
  }
  if (result.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  if (result.errors.length > 0) {
    lines.push("", "Errors:");
    for (const error of result.errors) {
      lines.push(`- ${error}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
