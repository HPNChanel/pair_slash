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
  return [
    [workspaceRoot, "<workspace>"],
    [repoRoot, "<repo>"],
    [homeRoot, "<home>"],
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
    evidence: JSON.parse(JSON.stringify(check.evidence), (key, value) =>
      typeof value === "string" ? normalizeString(value, markers) : value
    ),
  };
}

export function normalizeDoctorReport(report, markers) {
  return {
    runtime: report.runtime,
    target: report.target,
    support_verdict: report.support_verdict,
    environment_summary: {
      os: report.environment_summary.os,
      shell: normalizeString(report.environment_summary.shell, markers),
      cwd: normalizeString(report.environment_summary.cwd, markers),
      repo_root: normalizeString(report.environment_summary.repo_root, markers),
      config_home: normalizeString(report.environment_summary.config_home, markers),
      install_root: normalizeString(report.environment_summary.install_root, markers),
      state_path: normalizeString(report.environment_summary.state_path, markers),
      runtime_executable: normalizeString(report.environment_summary.runtime_executable, markers),
      runtime_version: report.environment_summary.runtime_version,
      runtime_available: report.environment_summary.runtime_available,
    },
    runtime_compatibility: { ...report.runtime_compatibility },
    checks: report.checks.map((check) => normalizeCheck(check, markers)),
    issues: report.issues.map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      check_id: issue.check_id,
      message: normalizeString(issue.message, markers),
      remediation: normalizeString(issue.remediation, markers),
    })),
    next_actions: report.next_actions.map((action) => normalizeString(action, markers)),
    installed_packs: report.installed_packs.map((pack) => ({
      id: pack.id,
      version: pack.version,
      install_dir: normalizeString(pack.install_dir, markers),
      local_overrides: pack.local_overrides,
    })),
  };
}
