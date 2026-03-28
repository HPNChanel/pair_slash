function toPosix(value) {
  return value.split("\\").join("/");
}

function normalizeString(value, markers) {
  if (typeof value !== "string") {
    return value;
  }
  let normalized = value;
  for (const [actual, token] of markers) {
    if (!actual) {
      continue;
    }
    normalized = normalized.split(actual).join(token);
    normalized = normalized.split(toPosix(actual)).join(token);
  }
  return normalized;
}

function sortByKey(items, selector) {
  return items
    .slice()
    .sort((left, right) => selector(left).localeCompare(selector(right)));
}

export function buildPathMarkers({
  workspaceRoot,
  repoRoot,
  homeRoot,
  runtimeBinRoot = null,
} = {}) {
  const hostHome = process.env.USERPROFILE || process.env.HOME || null;
  const currentWorkingDir = process.cwd();
  return [
    [workspaceRoot, "<workspace>"],
    [currentWorkingDir, "<workspace>"],
    [repoRoot, "<repo>"],
    [homeRoot, "<home>"],
    [hostHome, "<host-home>"],
    [runtimeBinRoot, "<runtime-bin>"],
  ].filter(([value]) => Boolean(value));
}

export function normalizeCompiledPack(compiledPack, markers) {
  return {
    runtime: compiledPack.runtime,
    bundle_kind: compiledPack.bundle_kind,
    pack_id: compiledPack.pack_id,
    version: compiledPack.version,
    canonical_entrypoint: compiledPack.canonical_entrypoint,
    direct_invocation: compiledPack.direct_invocation,
    digest: compiledPack.digest,
    normalized_ir_digest: compiledPack.normalized_ir_digest,
    output_dir: normalizeString(compiledPack.output_dir, markers),
    files: sortByKey(compiledPack.files, (file) => file.relative_path).map((file) => ({
      asset_id: file.asset_id,
      generator: file.generator,
      required: file.required,
      owner: file.owner,
      uninstall_behavior: file.uninstall_behavior,
      relative_path: file.relative_path,
      sha256: file.sha256,
      generated: file.generated,
      override_eligible: file.override_eligible,
      write_authority_guarded: file.write_authority_guarded,
      asset_kind: file.asset_kind,
      install_surface: file.install_surface,
      runtime_selector: file.runtime_selector,
    })),
  };
}

export function normalizePreviewPlan(plan, markers) {
  return {
    action: plan.action,
    runtime: plan.runtime,
    target: plan.target,
    can_apply: plan.can_apply,
    requires_confirmation: plan.requires_confirmation,
    install_root: normalizeString(plan.install_root, markers),
    state_path: normalizeString(plan.state_path, markers),
    selected_packs: plan.selected_packs.slice(),
    summary: { ...plan.summary },
    warnings: plan.warnings.map((warning) => normalizeString(warning, markers)),
    errors: plan.errors.map((error) => normalizeString(error, markers)),
    operations: plan.operations.map((operation) => ({
      kind: operation.kind,
      pack_id: operation.pack_id,
      relative_path: operation.relative_path ?? null,
      absolute_path: normalizeString(operation.absolute_path, markers),
      asset_kind: operation.asset_kind ?? null,
      install_surface: operation.install_surface ?? null,
      ownership: operation.ownership ?? null,
      override_eligible:
        typeof operation.override_eligible === "boolean" ? operation.override_eligible : null,
      reason: normalizeString(operation.reason, markers),
    })),
  };
}

export function normalizeInstallState(state, markers) {
  return {
    runtime: state.runtime,
    target: state.target,
    config_home: normalizeString(state.config_home, markers),
    install_root: normalizeString(state.install_root, markers),
    packs: sortByKey(state.packs, (pack) => pack.id).map((pack) => ({
      id: pack.id,
      version: pack.version,
      previous_version: pack.previous_version,
      install_dir: normalizeString(pack.install_dir, markers),
      manifest_digest: pack.manifest_digest,
      compiler_version: pack.compiler_version,
      files: sortByKey(pack.files, (file) => file.relative_path).map((file) => ({
        asset_id: file.asset_id ?? null,
        generator: file.generator ?? null,
        required: "required" in file ? file.required : null,
        declared_owner: file.declared_owner ?? null,
        uninstall_behavior: file.uninstall_behavior ?? null,
        relative_path: file.relative_path,
        absolute_path: normalizeString(file.absolute_path, markers),
        owned_by_pairslash: file.owned_by_pairslash,
        override_eligible: file.override_eligible,
        local_override: file.local_override,
        asset_kind: file.asset_kind,
        install_surface: file.install_surface,
        runtime_selector: file.runtime_selector,
        generated: file.generated,
        write_authority_guarded: file.write_authority_guarded,
        last_operation: file.last_operation,
      })),
    })),
  };
}

function normalizeCheck(check, markers) {
  return {
    id: check.id,
    group: check.group,
    severity: check.severity,
    status: check.status,
    summary: normalizeString(check.summary, markers),
    remediation: normalizeString(check.remediation, markers),
    blocking_for_install: check.blocking_for_install,
    evidence: JSON.parse(JSON.stringify(check.evidence), (key, value) =>
      typeof value === "string" ? normalizeString(value, markers) : value
    ),
  };
}

export function normalizeDoctorReport(report, markers) {
  const runtimeMarkers = [
    ...markers,
    [report.environment_summary.os, "<host-os>"],
    [report.environment_summary.shell, "<host-shell>"],
  ];
  return {
    runtime: report.runtime,
    target: report.target,
    support_verdict: report.support_verdict,
    install_blocked: report.install_blocked,
    environment_summary: {
      os: normalizeString(report.environment_summary.os, runtimeMarkers),
      shell: normalizeString(report.environment_summary.shell, runtimeMarkers),
      shell_profile_candidates: report.environment_summary.shell_profile_candidates.map((candidate) =>
        normalizeString(candidate, runtimeMarkers),
      ),
      cwd: normalizeString(report.environment_summary.cwd, runtimeMarkers),
      repo_root: normalizeString(report.environment_summary.repo_root, runtimeMarkers),
      config_home: normalizeString(report.environment_summary.config_home, runtimeMarkers),
      install_root: normalizeString(report.environment_summary.install_root, runtimeMarkers),
      state_path: normalizeString(report.environment_summary.state_path, runtimeMarkers),
      runtime_executable: normalizeString(report.environment_summary.runtime_executable, runtimeMarkers),
      runtime_version: report.environment_summary.runtime_version,
      runtime_available: report.environment_summary.runtime_available,
    },
    scope_probes: {
      repo: {
        ...report.scope_probes.repo,
        config_home: normalizeString(report.scope_probes.repo.config_home, runtimeMarkers),
        install_root: normalizeString(report.scope_probes.repo.install_root, runtimeMarkers),
        state_path: normalizeString(report.scope_probes.repo.state_path, runtimeMarkers),
      },
      user: {
        ...report.scope_probes.user,
        config_home: normalizeString(report.scope_probes.user.config_home, runtimeMarkers),
        install_root: normalizeString(report.scope_probes.user.install_root, runtimeMarkers),
        state_path: normalizeString(report.scope_probes.user.state_path, runtimeMarkers),
      },
    },
    support_lane: {
      ...report.support_lane,
      evidence_source: normalizeString(report.support_lane.evidence_source, runtimeMarkers),
      summary: normalizeString(report.support_lane.summary, runtimeMarkers),
    },
    runtime_compatibility: { ...report.runtime_compatibility },
    checks: report.checks.map((check) => normalizeCheck(check, runtimeMarkers)),
    issues: report.issues.map((issue) => ({
      code: issue.code,
      verdict: issue.verdict,
      severity: issue.severity,
      check_id: issue.check_id,
      summary: normalizeString(issue.summary, runtimeMarkers),
      evidence: JSON.parse(JSON.stringify(issue.evidence), (key, value) =>
        typeof value === "string" ? normalizeString(value, runtimeMarkers) : value
      ),
      suggested_fix: normalizeString(issue.suggested_fix, runtimeMarkers),
      blocking_for_install: issue.blocking_for_install,
      message: normalizeString(issue.message, runtimeMarkers),
      remediation: normalizeString(issue.remediation, runtimeMarkers),
    })),
    next_actions: report.next_actions.map((action) => normalizeString(action, runtimeMarkers)),
    installed_packs: report.installed_packs.map((pack) => ({
      id: pack.id,
      version: pack.version,
      install_dir: normalizeString(pack.install_dir, runtimeMarkers),
      local_overrides: pack.local_overrides,
    })),
    first_workflow_guidance: {
      ready: report.first_workflow_guidance.ready,
      recommended_pack_id: report.first_workflow_guidance.recommended_pack_id,
      rationale: normalizeString(report.first_workflow_guidance.rationale, runtimeMarkers),
      commands: report.first_workflow_guidance.commands.map((command) =>
        normalizeString(command, runtimeMarkers),
      ),
    },
  };
}
