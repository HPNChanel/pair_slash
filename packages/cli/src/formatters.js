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
  const lines = [
    `Runtime: ${report.runtime}`,
    `Target: ${report.target}`,
    `Verdict: ${report.support_verdict}`,
    "",
    "Environment summary:",
    `- OS: ${report.environment_summary.os}`,
    `- Shell: ${report.environment_summary.shell}`,
    `- Config home: ${report.environment_summary.config_home}`,
    `- Install root: ${report.environment_summary.install_root}`,
    `- State path: ${report.environment_summary.state_path}`,
    `- Runtime executable: ${report.environment_summary.runtime_executable ?? "none"}`,
    `- Runtime version: ${report.environment_summary.runtime_version ?? "unknown"}`,
    `- Runtime available: ${report.environment_summary.runtime_available ? "yes" : "no"}`,
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
    "Issues:",
  ];
  if (report.issues.length === 0) {
    lines.push("- none");
  } else {
    for (const issue of report.issues) {
      lines.push(`- ${issue.severity} ${issue.code}: ${issue.message}`);
    }
  }
  lines.push("", "Checks:");
  for (const check of report.checks) {
    lines.push(`- ${check.status} ${check.id}: ${check.summary}`);
  }
  lines.push("", "Next actions:");
  for (const action of report.next_actions) {
    lines.push(`- ${action}`);
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
    `Phase 4 lint bridge: ${report.ok ? "pass" : "fail"}`,
    `Target: ${report.target}`,
    `Runtime scope: ${report.runtime_scope}`,
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
  ];
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
