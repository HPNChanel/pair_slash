import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

import {
  applyInstall,
  applyUninstall,
  applyUpdate,
  planInstall,
  planUninstall,
  planUpdate,
  resolveStatePath,
} from "@pairslash/installer";
import { runDoctor } from "@pairslash/doctor";

import { materializeCompatFixture } from "./materialize.js";
import {
  COMPAT_RUNTIME_FIXTURE_BOUNDARY,
  COMPAT_RUNTIME_FIXTURE_EVIDENCE_CLASSES,
  COMPAT_RUNTIME_FIXTURE_MODE,
  COMPAT_RUNTIME_FIXTURE_REFS,
  installCompatRuntimeShims,
} from "./runtime-fixtures.js";

const SCHEMA_VERSION = "0.1.0";
const PRIMARY_PACK_ID = "pairslash-plan";
const LOCAL_OVERRIDE_MARKER = "\nAcceptance local override\n";

export const DEFAULT_ACCEPTANCE_LANES = [
  {
    key: "macos",
    id: "macos.codex.repo",
    os_lane: "macos",
    runtime: "codex_cli",
    target: "repo",
    os_override: "darwin",
    shell_override: "zsh",
  },
  {
    key: "linux",
    id: "linux.copilot.user",
    os_lane: "linux",
    runtime: "copilot_cli",
    target: "user",
    os_override: "linux",
    shell_override: "bash",
  },
  {
    key: "windows-prep",
    id: "windows.prep",
    os_lane: "windows",
    runtime: null,
    target: null,
    os_override: "win32",
    shell_override: "powershell",
  },
];

const RUNTIME_VERSIONS = Object.freeze({
  codex_cli: "0.116.0",
  copilot_cli: "2.50.0",
});

function buildAcceptanceEvidencePartition() {
  return {
    deterministic: {
      evidence_class: COMPAT_RUNTIME_FIXTURE_EVIDENCE_CLASSES.deterministic,
      refs: COMPAT_RUNTIME_FIXTURE_REFS.deterministic_refs.slice(),
      role: "regression-confidence-only",
    },
    fake: {
      evidence_class: COMPAT_RUNTIME_FIXTURE_EVIDENCE_CLASSES.fake,
      refs: COMPAT_RUNTIME_FIXTURE_REFS.fake_acceptance_refs.slice(),
      role: "regression-confidence-only",
    },
    shim: {
      evidence_class: COMPAT_RUNTIME_FIXTURE_EVIDENCE_CLASSES.shim,
      refs: COMPAT_RUNTIME_FIXTURE_REFS.shim_acceptance_refs.slice(),
      role: "regression-confidence-only",
    },
    live: {
      evidence_class: COMPAT_RUNTIME_FIXTURE_EVIDENCE_CLASSES.live,
      refs: COMPAT_RUNTIME_FIXTURE_REFS.live_evidence_refs.slice(),
      role: "not-collected-by-compat-lab-acceptance",
    },
  };
}

function buildSupportClaimBoundary() {
  return {
    live_evidence_collected: COMPAT_RUNTIME_FIXTURE_BOUNDARY.live_evidence_collected,
    public_support_promotion_allowed: COMPAT_RUNTIME_FIXTURE_BOUNDARY.public_support_promotion_allowed,
    live_registry_root: COMPAT_RUNTIME_FIXTURE_BOUNDARY.live_registry_root,
    live_runbook_ref: COMPAT_RUNTIME_FIXTURE_BOUNDARY.live_runbook_ref,
  };
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function runtimeFlag(runtime) {
  return runtime === "codex_cli" ? "codex" : "copilot";
}

function collectIssueCodes(report) {
  return uniqueSorted(report.issues.map((issue) => issue.code ?? issue.check_id));
}

function buildLifecycleCommand(action, runtime, target, { apply = false, dryRun = false } = {}) {
  const flags = [
    "node packages/tools/cli/src/bin/pairslash.js",
    action,
    PRIMARY_PACK_ID,
    "--runtime",
    runtimeFlag(runtime),
    "--target",
    target,
  ];
  if (dryRun) {
    flags.push("--dry-run");
  }
  if (apply) {
    flags.push("--apply", "--yes");
  }
  return flags.join(" ");
}

function buildDoctorCommand(runtime, target) {
  return [
    "node packages/tools/cli/src/bin/pairslash.js",
    "doctor",
    "--runtime",
    runtimeFlag(runtime),
    "--target",
    target,
  ].join(" ");
}

function buildReadAuthorityCommands(runtime, target) {
  return [
    [
      "node packages/tools/cli/src/bin/pairslash.js",
      "explain-context",
      "pairslash-plan",
      "--runtime",
      runtimeFlag(runtime),
      "--target",
      target,
      "--format",
      "json",
    ].join(" "),
    [
      "node packages/tools/cli/src/bin/pairslash.js",
      "memory",
      "candidate",
      "--task-scope",
      "phase17-read-authority-acceptance",
      "--runtime",
      runtimeFlag(runtime),
      "--target",
      target,
      "--format",
      "json",
    ].join(" "),
    [
      "node packages/tools/cli/src/bin/pairslash.js",
      "memory",
      "audit",
      "--audit-scope",
      "full",
      "--runtime",
      runtimeFlag(runtime),
      "--target",
      target,
      "--format",
      "json",
    ].join(" "),
  ];
}

function buildFirstWorkflowStep() {
  return "/skills -> select pairslash-plan -> ask for a repo plan";
}

function runCliJson({ workspaceRoot, cwd, args }) {
  const result = spawnSync(
    process.execPath,
    [join(workspaceRoot, "packages", "tools", "cli", "src", "bin", "pairslash.js"), ...args],
    {
      cwd,
      encoding: "utf8",
      env: { ...process.env },
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `cli command failed (${args.join(" ")}): ${result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`}`,
    );
  }
  return JSON.parse(result.stdout);
}

function laneCommandsFor(lane) {
  if (lane.key === "windows-prep") {
    return [
      buildDoctorCommand("codex_cli", "repo"),
      buildLifecycleCommand("preview install", "codex_cli", "repo"),
      buildDoctorCommand("copilot_cli", "user"),
      buildLifecycleCommand("preview install", "copilot_cli", "user"),
    ];
  }
  return [
    buildDoctorCommand(lane.runtime, lane.target),
    buildLifecycleCommand("preview install", lane.runtime, lane.target),
    buildLifecycleCommand("install", lane.runtime, lane.target, { apply: true }),
    buildFirstWorkflowStep(),
  ];
}

function doctorOptions(lane, runtime, target, packs = []) {
  return {
    runtime,
    target,
    packs,
    _os_override: lane.os_override,
    _shell_override: lane.shell_override,
  };
}

function withFixture({ repoRoot, fixtureId, runtimeHarness, target }, run) {
  const materialized = materializeCompatFixture({
    repoRoot,
    fixtureId,
  });
  try {
    if (target === "user") {
      runtimeHarness.setHome(materialized.homeRoot);
    } else {
      runtimeHarness.restoreHome();
    }
    return run(materialized);
  } finally {
    runtimeHarness.restoreHome();
    materialized.cleanup();
  }
}

function findInstalledSkillPath(state, packId = PRIMARY_PACK_ID) {
  const pack = state.packs.find((entry) => entry.id === packId);
  return pack?.files.find((file) => file.relative_path === "SKILL.md")?.absolute_path ?? null;
}

function buildScenarioResult(definition, payload, durationMs) {
  return {
    id: definition.id,
    runtime: definition.runtime ?? null,
    target: definition.target ?? null,
    fixture_id: definition.fixture_id,
    status: payload.success ? "pass" : "fail",
    summary: payload.summary,
    duration_ms: durationMs,
    install_success: payload.install_success ?? null,
    doctor_success: payload.doctor_success ?? null,
    update_success: payload.update_success ?? null,
    uninstall_success: payload.uninstall_success ?? null,
    time_to_first_success_ms: definition.milestone && payload.success ? durationMs : null,
    support_verdict: payload.support_verdict ?? null,
    issue_codes: uniqueSorted(payload.issue_codes ?? []),
    repro_key: payload.repro_key,
    commands: payload.commands ?? [],
    details: payload.details ?? {},
  };
}

function runScenario(definition, execute) {
  const startedAt = Date.now();
  try {
    const payload = execute();
    return buildScenarioResult(definition, payload, Date.now() - startedAt);
  } catch (error) {
    return buildScenarioResult(
      definition,
      {
        success: false,
        summary: error.message,
        issue_codes: ["acceptance-scenario-failed"],
        repro_key: `${definition.id}:exception`,
        commands: definition.commands ?? [],
        details: {
          error_message: error.message,
        },
      },
      Date.now() - startedAt,
    );
  }
}

function runFreshInstallScenario({ repoRoot, lane, runtimeHarness }) {
  const definition = {
    id: `fresh-install.${lane.os_lane}.${runtimeFlag(lane.runtime)}.${lane.target}`,
    runtime: lane.runtime,
    target: lane.target,
    fixture_id: "repo-basic-readonly",
    milestone: true,
    commands: laneCommandsFor(lane),
  };
  return runScenario(definition, () =>
    withFixture(
      {
        repoRoot,
        fixtureId: definition.fixture_id,
        runtimeHarness,
        target: lane.target,
      },
      ({ tempRoot }) => {
        const doctorBefore = runDoctor({
          repoRoot: tempRoot,
          ...doctorOptions(lane, lane.runtime, lane.target),
        });
        const preview = planInstall({
          repoRoot: tempRoot,
          runtime: lane.runtime,
          target: lane.target,
          packs: [PRIMARY_PACK_ID],
        });
        if (!preview.plan.can_apply) {
          throw new Error(`install preview blocked: ${preview.plan.errors.join("; ")}`);
        }
        const result = applyInstall(preview);
        const doctorAfter = runDoctor({
          ...doctorOptions(lane, lane.runtime, lane.target),
          repoRoot: tempRoot,
        });
        const installedPackIds = result.state.packs.map((pack) => pack.id).sort();
        const success =
          installedPackIds.includes(PRIMARY_PACK_ID) &&
          !doctorAfter.install_blocked &&
          doctorAfter.first_workflow_guidance.ready;
        return {
          success,
          summary: success
            ? `${lane.os_lane} ${runtimeFlag(lane.runtime)} ${lane.target} lane reaches first workflow readiness`
            : `${lane.os_lane} ${runtimeFlag(lane.runtime)} ${lane.target} lane did not reach first workflow readiness`,
          install_success: success,
          doctor_success: !doctorAfter.install_blocked,
          support_verdict: doctorAfter.support_verdict,
          issue_codes: [...collectIssueCodes(doctorBefore), ...collectIssueCodes(doctorAfter)],
          repro_key: `${definition.id}:${definition.fixture_id}:${lane.runtime}:${lane.target}`,
          commands: definition.commands,
          details: {
            preview_summary: { ...preview.plan.summary },
            pre_install_verdict: doctorBefore.support_verdict,
            post_install_verdict: doctorAfter.support_verdict,
            installed_packs: installedPackIds,
            first_workflow_ready: doctorAfter.first_workflow_guidance.ready,
            first_workflow_commands: doctorAfter.first_workflow_guidance.commands.slice(),
          },
        };
      },
    ),
  );
}

function seedReadAuthorityFixture(tempRoot) {
  mkdirSync(join(tempRoot, ".pairslash", "task-memory"), { recursive: true });
  mkdirSync(join(tempRoot, ".pairslash", "sessions"), { recursive: true });
  mkdirSync(join(tempRoot, ".pairslash", "staging"), { recursive: true });
  mkdirSync(join(tempRoot, ".pairslash", "audit-log"), { recursive: true });
  writeFileSync(
    join(tempRoot, ".pairslash", "task-memory", "acceptance-task.yaml"),
    [
      "kind: constraint",
      "title: Codex CLI read-only sandbox blocks complex PowerShell patterns",
      "statement: task-memory acceptance conflict",
      "evidence: compat acceptance task evidence",
      "scope: subsystem",
      "scope_detail: codex-cli",
    ].join("\n"),
  );
  writeFileSync(
    join(tempRoot, ".pairslash", "sessions", "acceptance-session.yaml"),
    [
      "kind: pattern",
      "title: Acceptance session-only supporting context",
      "statement: session layer stays supporting and never becomes authoritative",
      "evidence: compat acceptance session evidence",
      "scope: subsystem",
      "scope_detail: acceptance",
    ].join("\n"),
  );
  writeFileSync(
    join(tempRoot, ".pairslash", "staging", "acceptance-staging.yaml"),
    [
      "kind: pattern",
      "title: Acceptance staging candidate",
      "statement: staging stays read-only until explicit write workflow is used",
      "evidence: compat acceptance staging evidence",
      "scope: subsystem",
      "scope_detail: acceptance",
    ].join("\n"),
  );
  writeFileSync(
    join(tempRoot, ".pairslash", "audit-log", "acceptance-audit.yaml"),
    [
      "kind: constraint",
      "title: Codex CLI read-only sandbox blocks complex PowerShell patterns",
      "statement: audit-log acceptance conflict",
      "evidence: compat acceptance audit evidence",
      "scope: subsystem",
      "scope_detail: codex-cli",
    ].join("\n"),
  );
}

function runReadAuthorityScenario({ repoRoot, lane, runtimeHarness }) {
  const definition = {
    id: `read-authority.${lane.os_lane}.${runtimeFlag(lane.runtime)}.${lane.target}`,
    runtime: lane.runtime,
    target: lane.target,
    fixture_id: "repo-basic-readonly",
    commands: buildReadAuthorityCommands(lane.runtime, lane.target),
  };
  return runScenario(definition, () =>
    withFixture(
      {
        repoRoot,
        fixtureId: definition.fixture_id,
        runtimeHarness,
        target: lane.target,
      },
      ({ tempRoot }) => {
        seedReadAuthorityFixture(tempRoot);
        const beforeGlobal = readFileSync(join(tempRoot, ".pairslash", "project-memory", "50-constraints.yaml"), "utf8");
        const beforeIndex = readFileSync(join(tempRoot, ".pairslash", "project-memory", "90-memory-index.yaml"), "utf8");
        const beforeAudit = readFileSync(join(tempRoot, ".pairslash", "audit-log", "acceptance-audit.yaml"), "utf8");

        const explanation = runCliJson({
          workspaceRoot: repoRoot,
          cwd: tempRoot,
          args: ["explain-context", "pairslash-plan", "--runtime", runtimeFlag(lane.runtime), "--target", lane.target, "--format", "json"],
        });
        const candidate = runCliJson({
          workspaceRoot: repoRoot,
          cwd: tempRoot,
          args: [
            "memory",
            "candidate",
            "--task-scope",
            "phase17-read-authority-acceptance",
            "--runtime",
            runtimeFlag(lane.runtime),
            "--target",
            lane.target,
            "--format",
            "json",
          ],
        });
        const audit = runCliJson({
          workspaceRoot: repoRoot,
          cwd: tempRoot,
          args: [
            "memory",
            "audit",
            "--audit-scope",
            "full",
            "--runtime",
            runtimeFlag(lane.runtime),
            "--target",
            lane.target,
            "--format",
            "json",
          ],
        });

        const explanationConflict =
          explanation.memory_resolution?.record_resolution?.conflicts?.some(
            (entry) =>
              entry.selected_layer === "global-project-memory" &&
              ["task-memory", "audit-log"].includes(entry.shadowed_layer),
          ) === true;
        const candidateConflict =
          candidate.candidates?.some((entry) => entry.suspicion?.conflict === true) === true;
        const auditConflict =
          audit.findings?.some(
            (entry) =>
              entry.type === "conflict" &&
              entry.selected_layer === "global-project-memory" &&
              ["task-memory", "audit-log"].includes(entry.shadowed_layer),
          ) === true;
        const readOnlyPreserved =
          beforeGlobal === readFileSync(join(tempRoot, ".pairslash", "project-memory", "50-constraints.yaml"), "utf8") &&
          beforeIndex === readFileSync(join(tempRoot, ".pairslash", "project-memory", "90-memory-index.yaml"), "utf8") &&
          beforeAudit === readFileSync(join(tempRoot, ".pairslash", "audit-log", "acceptance-audit.yaml"), "utf8");
        const success =
          explanation.memory_resolution?.uses_shared_loader === true &&
          candidate.read_only === true &&
          audit.read_only === true &&
          explanationConflict &&
          candidateConflict &&
          auditConflict &&
          readOnlyPreserved;
        return {
          success,
          summary: success
            ? `${lane.os_lane} ${runtimeFlag(lane.runtime)} ${lane.target} lane proves shared-loader read authority for plan/candidate/audit`
            : `${lane.os_lane} ${runtimeFlag(lane.runtime)} ${lane.target} lane is missing shared-loader read-authority proof`,
          commands: definition.commands,
          repro_key: `${definition.id}:${definition.fixture_id}:${lane.runtime}:${lane.target}`,
          details: {
            explain_profile: explanation.memory_resolution?.profile_id ?? null,
            candidate_profile: candidate.read_profile_id ?? null,
            audit_profile: audit.read_profile_id ?? null,
            explain_conflict: explanationConflict,
            candidate_conflict: candidateConflict,
            audit_conflict: auditConflict,
          },
          issue_codes: success ? [] : ["phase17-read-authority-proof-missing"],
          doctor_success: null,
          install_success: null,
          update_success: null,
          uninstall_success: null,
          support_verdict: null,
          read_only_preserved: readOnlyPreserved,
        };
      },
    ),
  );
}

function runUpdatePreserveOverrideScenario({ repoRoot, lane, runtimeHarness }) {
  const definition = {
    id: `update-preserve-override.${lane.os_lane}.${runtimeFlag(lane.runtime)}.${lane.target}`,
    runtime: lane.runtime,
    target: lane.target,
    fixture_id: "repo-basic-readonly",
    commands: [
      buildLifecycleCommand("install", lane.runtime, lane.target, { apply: true }),
      buildLifecycleCommand("update", lane.runtime, lane.target, { dryRun: true }),
      buildLifecycleCommand("update", lane.runtime, lane.target, { apply: true }),
    ],
  };
  return runScenario(definition, () =>
    withFixture(
      {
        repoRoot,
        fixtureId: definition.fixture_id,
        runtimeHarness,
        target: lane.target,
      },
      ({ tempRoot }) => {
        const install = applyInstall(
          planInstall({
            repoRoot: tempRoot,
            runtime: lane.runtime,
            target: lane.target,
            packs: [PRIMARY_PACK_ID],
          }),
        );
        const skillPath = findInstalledSkillPath(install.state);
        if (!skillPath) {
          throw new Error("installed SKILL.md could not be located for override scenario");
        }
        writeFileSync(skillPath, `${readFileSync(skillPath, "utf8")}${LOCAL_OVERRIDE_MARKER}`);
        const preview = planUpdate({
          repoRoot: tempRoot,
          runtime: lane.runtime,
          target: lane.target,
          packs: [PRIMARY_PACK_ID],
        });
        const preserveOperation = preview.plan.operations.find(
          (operation) =>
            operation.kind === "preserve_override" && operation.relative_path === "SKILL.md",
        );
        if (!preview.plan.can_apply || !preserveOperation) {
          throw new Error("update preview did not preserve the local override");
        }
        const result = applyUpdate(preview);
        const postDoctor = runDoctor({
          repoRoot: tempRoot,
          ...doctorOptions(lane, lane.runtime, lane.target),
        });
        const preserved = readFileSync(skillPath, "utf8").includes(LOCAL_OVERRIDE_MARKER.trim());
        const statePack = result.state.packs.find((pack) => pack.id === PRIMARY_PACK_ID);
        const trackedSkill = statePack?.files.find((file) => file.relative_path === "SKILL.md") ?? null;
        const success = preserved && trackedSkill?.local_override === true && !postDoctor.install_blocked;
        return {
          success,
          summary: success
            ? "update preserves a valid local override without blocking the lane"
            : "update failed to preserve the local override",
          doctor_success: !postDoctor.install_blocked,
          update_success: success,
          support_verdict: postDoctor.support_verdict,
          issue_codes: collectIssueCodes(postDoctor),
          repro_key: `${definition.id}:${definition.fixture_id}:${lane.runtime}:${lane.target}`,
          commands: definition.commands,
          details: {
            preview_summary: { ...preview.plan.summary },
            preserved_override: preserved,
            tracked_local_override: trackedSkill?.local_override ?? false,
            post_update_verdict: postDoctor.support_verdict,
          },
        };
      },
    ),
  );
}

function runUninstallOwnedOnlyScenario({ repoRoot, lane, runtimeHarness }) {
  const definition = {
    id: `uninstall-owned-only.${lane.os_lane}.${runtimeFlag(lane.runtime)}.${lane.target}`,
    runtime: lane.runtime,
    target: lane.target,
    fixture_id: "repo-basic-readonly",
    commands: [
      buildLifecycleCommand("install", lane.runtime, lane.target, { apply: true }),
      buildLifecycleCommand("uninstall", lane.runtime, lane.target, { dryRun: true }),
      buildLifecycleCommand("uninstall", lane.runtime, lane.target, { apply: true }),
    ],
  };
  return runScenario(definition, () =>
    withFixture(
      {
        repoRoot,
        fixtureId: definition.fixture_id,
        runtimeHarness,
        target: lane.target,
      },
      ({ tempRoot }) => {
        const install = applyInstall(
          planInstall({
            repoRoot: tempRoot,
            runtime: lane.runtime,
            target: lane.target,
            packs: [PRIMARY_PACK_ID],
          }),
        );
        const statePack = install.state.packs.find((pack) => pack.id === PRIMARY_PACK_ID);
        if (!statePack) {
          throw new Error("uninstall scenario could not find installed pack state");
        }
        const skillPath = findInstalledSkillPath(install.state);
        const unmanagedPath = join(statePack.install_dir, "notes.local.md");
        mkdirSync(dirname(unmanagedPath), { recursive: true });
        writeFileSync(unmanagedPath, "manual note\n");
        const preview = planUninstall({
          repoRoot: tempRoot,
          runtime: lane.runtime,
          target: lane.target,
          packs: [PRIMARY_PACK_ID],
        });
        const preservedUnknown = preview.plan.operations.find(
          (operation) =>
            operation.kind === "skip_unmanaged" && operation.relative_path === "notes.local.md",
        );
        if (!preview.plan.can_apply || !preservedUnknown) {
          throw new Error("uninstall preview did not keep the unmanaged file");
        }
        applyUninstall(preview);
        const statePath = resolveStatePath({
          repoRoot: tempRoot,
          runtime: lane.runtime,
          target: lane.target,
        });
        const success =
          existsSync(unmanagedPath) &&
          Boolean(skillPath) &&
          !existsSync(skillPath) &&
          !existsSync(statePath);
        return {
          success,
          summary: success
            ? "uninstall removes only PairSlash-owned assets and leaves unmanaged files behind"
            : "uninstall removed unmanaged content or left managed state behind",
          uninstall_success: success,
          issue_codes: [],
          repro_key: `${definition.id}:${definition.fixture_id}:${lane.runtime}:${lane.target}`,
          commands: definition.commands,
          details: {
            preview_summary: { ...preview.plan.summary },
            unmanaged_file_preserved: existsSync(unmanagedPath),
            managed_skill_removed: skillPath ? !existsSync(skillPath) : false,
            state_removed: !existsSync(statePath),
          },
        };
      },
    ),
  );
}

function runBrokenConfigDoctorScenario({ repoRoot, lane, runtimeHarness }) {
  const definition = {
    id: `doctor-broken-setup.${lane.os_lane}.${runtimeFlag(lane.runtime)}.${lane.target}`,
    runtime: lane.runtime,
    target: lane.target,
    fixture_id: "repo-basic-readonly",
    commands: [buildDoctorCommand(lane.runtime, lane.target)],
  };
  return runScenario(definition, () =>
    withFixture(
      {
        repoRoot,
        fixtureId: definition.fixture_id,
        runtimeHarness,
        target: lane.target,
      },
      ({ tempRoot }) => {
        const baseline = runDoctor({
          repoRoot: tempRoot,
          ...doctorOptions(lane, lane.runtime, lane.target),
        });
        const configHome = baseline.environment_summary.config_home;
        rmSync(configHome, { recursive: true, force: true });
        mkdirSync(dirname(configHome), { recursive: true });
        writeFileSync(configHome, "broken-config-home\n");
        const broken = runDoctor({
          repoRoot: tempRoot,
          ...doctorOptions(lane, lane.runtime, lane.target),
        });
        const success =
          broken.install_blocked &&
          broken.issues.some((issue) => issue.check_id === "filesystem.config_home");
        return {
          success,
          summary: success
            ? "doctor blocks the lane when config-home placement is broken"
            : "doctor missed a broken config-home setup",
          doctor_success: success,
          support_verdict: broken.support_verdict,
          issue_codes: collectIssueCodes(broken),
          repro_key: `${definition.id}:${definition.fixture_id}:${lane.runtime}:${lane.target}`,
          commands: definition.commands,
          details: {
            baseline_verdict: baseline.support_verdict,
            broken_verdict: broken.support_verdict,
            blocking_issue_checks: broken.issues.map((issue) => issue.check_id),
          },
        };
      },
    ),
  );
}

function runReconcileParityScenario({ repoRoot, lane, runtimeHarness }) {
  const definition = {
    id: `semantic-parity.reconcile-unmanaged.${lane.os_lane}.${runtimeFlag(lane.runtime)}.${lane.target}`,
    runtime: lane.runtime,
    target: lane.target,
    fixture_id: "repo-basic-readonly",
    commands: [
      buildLifecycleCommand("preview install", lane.runtime, lane.target),
      buildDoctorCommand(lane.runtime, lane.target),
    ],
  };
  return runScenario(definition, () =>
    withFixture(
      {
        repoRoot,
        fixtureId: definition.fixture_id,
        runtimeHarness,
        target: lane.target,
      },
      ({ tempRoot }) => {
        const seedPreview = planInstall({
          repoRoot: tempRoot,
          runtime: lane.runtime,
          target: lane.target,
          packs: [PRIMARY_PACK_ID],
        });
        const compiledFile =
          seedPreview.compiledPacks[0]?.files.find((file) => file.override_eligible) ??
          seedPreview.compiledPacks[0]?.files[0];
        if (!compiledFile) {
          throw new Error("compat fixture did not produce a compiled file to seed unmanaged reconcile state");
        }
        const manualPath = join(seedPreview.plan.install_root, PRIMARY_PACK_ID, compiledFile.relative_path);
        mkdirSync(dirname(manualPath), { recursive: true });
        writeFileSync(manualPath, compiledFile.content);

        const preview = planInstall({
          repoRoot: tempRoot,
          runtime: lane.runtime,
          target: lane.target,
          packs: [PRIMARY_PACK_ID],
        });
        const doctor = runDoctor({
          repoRoot: tempRoot,
          ...doctorOptions(lane, lane.runtime, lane.target),
        });
        const operation = preview.plan.operations.find(
          (entry) => entry.relative_path === compiledFile.relative_path,
        );
        const issue = doctor.issues.find((entry) => entry.check_id === "conflict.unmanaged_install_root");
        const success =
          operation?.reason_code === "reconcile-unmanaged-identical" &&
          issue?.reason_codes?.includes("reconcile-unmanaged-identical");
        return {
          success,
          summary: success
            ? "doctor and preview install agree on non-blocking unmanaged reconcile semantics"
            : "doctor and preview install diverged on non-blocking unmanaged reconcile semantics",
          doctor_success: Boolean(issue),
          support_verdict: doctor.support_verdict,
          issue_codes: collectIssueCodes(doctor),
          repro_key: `${definition.id}:${definition.fixture_id}:${lane.runtime}:${lane.target}`,
          commands: definition.commands,
          details: {
            preview_reason_codes: preview.plan.reason_codes.slice(),
            doctor_reason_codes: doctor.reason_codes.slice(),
          },
        };
      },
    ),
  );
}

function runStaleStateParityScenario({ repoRoot, lane, runtimeHarness }) {
  const definition = {
    id: `semantic-parity.stale-state.${lane.os_lane}.${runtimeFlag(lane.runtime)}.${lane.target}`,
    runtime: lane.runtime,
    target: lane.target,
    fixture_id: "repo-basic-readonly",
    commands: [
      buildLifecycleCommand("preview install", lane.runtime, lane.target),
      buildDoctorCommand(lane.runtime, lane.target),
    ],
  };
  return runScenario(definition, () =>
    withFixture(
      {
        repoRoot,
        fixtureId: definition.fixture_id,
        runtimeHarness,
        target: lane.target,
      },
      ({ tempRoot }) => {
        mkdirSync(join(tempRoot, ".pairslash", "install-state"), { recursive: true });
        writeFileSync(
          resolveStatePath({
            repoRoot: tempRoot,
            runtime: lane.runtime,
            target: lane.target,
          }),
          JSON.stringify(
            {
              kind: "install-state",
              schema_version: "1.0.0",
              runtime: lane.runtime,
              target: lane.target,
              config_home: join(tempRoot, "stale-config-home"),
              install_root: join(tempRoot, "stale-install-root"),
              updated_at: "2026-04-04T00:00:00.000Z",
              last_transaction_id: null,
              packs: [],
            },
            null,
            2,
          ),
        );
        const preview = planInstall({
          repoRoot: tempRoot,
          runtime: lane.runtime,
          target: lane.target,
          packs: [PRIMARY_PACK_ID],
        });
        const doctor = runDoctor({
          repoRoot: tempRoot,
          ...doctorOptions(lane, lane.runtime, lane.target),
        });
        const issue = doctor.issues.find((entry) => entry.check_id === "install_state.load");
        const success =
          preview.plan.reason_codes.includes("install-state-metadata-mismatch") &&
          issue?.reason_codes?.includes("install-state-metadata-mismatch") &&
          doctor.install_blocked;
        return {
          success,
          summary: success
            ? "doctor and preview install both block stale install-state metadata"
            : "stale install-state metadata parity regressed between doctor and preview install",
          doctor_success: doctor.install_blocked,
          support_verdict: doctor.support_verdict,
          issue_codes: collectIssueCodes(doctor),
          repro_key: `${definition.id}:${definition.fixture_id}:${lane.runtime}:${lane.target}`,
          commands: definition.commands,
          details: {
            preview_reason_codes: preview.plan.reason_codes.slice(),
            doctor_reason_codes: doctor.reason_codes.slice(),
          },
        };
      },
    ),
  );
}

function runInstallRootShapeParityScenario({ repoRoot, lane, runtimeHarness }) {
  const definition = {
    id: `semantic-parity.install-root-shape.${lane.os_lane}.${runtimeFlag(lane.runtime)}.${lane.target}`,
    runtime: lane.runtime,
    target: lane.target,
    fixture_id: "repo-basic-readonly",
    commands: [
      buildLifecycleCommand("preview install", lane.runtime, lane.target),
      buildDoctorCommand(lane.runtime, lane.target),
    ],
  };
  return runScenario(definition, () =>
    withFixture(
      {
        repoRoot,
        fixtureId: definition.fixture_id,
        runtimeHarness,
        target: lane.target,
      },
      ({ tempRoot }) => {
        const seed = planInstall({
          repoRoot: tempRoot,
          runtime: lane.runtime,
          target: lane.target,
          packs: [PRIMARY_PACK_ID],
        });
        const installRoot = seed.plan.install_root;
        mkdirSync(installRoot, { recursive: true });
        writeFileSync(join(installRoot, PRIMARY_PACK_ID), "not-a-directory\n");
        const preview = planInstall({
          repoRoot: tempRoot,
          runtime: lane.runtime,
          target: lane.target,
          packs: [PRIMARY_PACK_ID],
        });
        const doctor = runDoctor({
          repoRoot: tempRoot,
          ...doctorOptions(lane, lane.runtime, lane.target),
        });
        const issue = doctor.issues.find((entry) => entry.check_id === "conflict.unmanaged_install_root");
        const success =
          !preview.plan.can_apply &&
          preview.plan.reason_codes.includes("unmanaged-conflict-blocking") &&
          doctor.install_blocked &&
          issue?.reason_codes?.includes("unmanaged-conflict-blocking");
        return {
          success,
          summary: success
            ? "doctor and preview install both block non-directory pack install roots"
            : "doctor and preview install diverged on non-directory pack install-root handling",
          doctor_success: doctor.install_blocked,
          support_verdict: doctor.support_verdict,
          issue_codes: collectIssueCodes(doctor),
          repro_key: `${definition.id}:${definition.fixture_id}:${lane.runtime}:${lane.target}`,
          commands: definition.commands,
          details: {
            preview_reason_codes: preview.plan.reason_codes.slice(),
            doctor_reason_codes: doctor.reason_codes.slice(),
          },
        };
      },
    ),
  );
}

function runManagedReinstallRedirectScenario({ repoRoot, lane, runtimeHarness }) {
  const definition = {
    id: `semantic-parity.managed-reinstall.${lane.os_lane}.${runtimeFlag(lane.runtime)}.${lane.target}`,
    runtime: lane.runtime,
    target: lane.target,
    fixture_id: "repo-basic-readonly",
    commands: [
      buildLifecycleCommand("install", lane.runtime, lane.target, { apply: true }),
      buildLifecycleCommand("preview install", lane.runtime, lane.target),
      buildLifecycleCommand("update", lane.runtime, lane.target, { dryRun: true }),
      buildDoctorCommand(lane.runtime, lane.target),
    ],
  };
  return runScenario(definition, () =>
    withFixture(
      {
        repoRoot,
        fixtureId: definition.fixture_id,
        runtimeHarness,
        target: lane.target,
      },
      ({ tempRoot }) => {
        applyInstall(
          planInstall({
            repoRoot: tempRoot,
            runtime: lane.runtime,
            target: lane.target,
            packs: [PRIMARY_PACK_ID],
          }),
        );
        const reinstallPreview = planInstall({
          repoRoot: tempRoot,
          runtime: lane.runtime,
          target: lane.target,
          packs: [PRIMARY_PACK_ID],
        });
        const updatePreview = planUpdate({
          repoRoot: tempRoot,
          runtime: lane.runtime,
          target: lane.target,
          packs: [PRIMARY_PACK_ID],
        });
        const doctor = runDoctor({
          repoRoot: tempRoot,
          runtime: lane.runtime,
          target: lane.target,
          packs: [PRIMARY_PACK_ID],
          _os_override: lane.os_override,
          _shell_override: lane.shell_override,
        });
        const issue = doctor.issues.find((entry) => entry.check_id === "install_state.install_preview_parity");
        const success =
          reinstallPreview.plan.reason_codes.includes("managed-pack-requires-update") &&
          updatePreview.plan.can_apply &&
          issue?.reason_codes?.includes("managed-pack-requires-update");
        return {
          success,
          summary: success
            ? "reinstall preview redirects to update and doctor reports the same lifecycle reason"
            : "managed reinstall/update semantic parity regressed",
          doctor_success: Boolean(issue),
          update_success: updatePreview.plan.can_apply,
          support_verdict: doctor.support_verdict,
          issue_codes: collectIssueCodes(doctor),
          repro_key: `${definition.id}:${definition.fixture_id}:${lane.runtime}:${lane.target}`,
          commands: definition.commands,
          details: {
            reinstall_reason_codes: reinstallPreview.plan.reason_codes.slice(),
            update_reason_codes: updatePreview.plan.reason_codes.slice(),
            doctor_reason_codes: doctor.reason_codes.slice(),
          },
        };
      },
    ),
  );
}

function runManagedReinstallRemediationScenario({ repoRoot, lane, runtimeHarness }) {
  const definition = {
    id: `semantic-parity.managed-reinstall-remediation.${lane.os_lane}.${runtimeFlag(lane.runtime)}.${lane.target}`,
    runtime: lane.runtime,
    target: lane.target,
    fixture_id: "repo-basic-readonly",
    commands: [
      buildLifecycleCommand("install", lane.runtime, lane.target, { apply: true }),
      buildLifecycleCommand("preview install", lane.runtime, lane.target),
      `${buildDoctorCommand(lane.runtime, lane.target)} --packs ${PRIMARY_PACK_ID}`,
    ],
  };
  return runScenario(definition, () =>
    withFixture(
      {
        repoRoot,
        fixtureId: definition.fixture_id,
        runtimeHarness,
        target: lane.target,
      },
      ({ tempRoot }) => {
        applyInstall(
          planInstall({
            repoRoot: tempRoot,
            runtime: lane.runtime,
            target: lane.target,
            packs: [PRIMARY_PACK_ID],
          }),
        );
        const defaultInstallPreview = planInstall({
          repoRoot: tempRoot,
          runtime: lane.runtime,
          target: lane.target,
          packs: [PRIMARY_PACK_ID],
        });
        const doctor = runDoctor({
          repoRoot: tempRoot,
          ...doctorOptions(lane, lane.runtime, lane.target, [PRIMARY_PACK_ID]),
        });
        const issue = doctor.issues.find((entry) => entry.check_id === "install_state.install_preview_parity");
        const success =
          defaultInstallPreview.plan.reason_codes.includes("managed-pack-requires-update")
          && doctor.install_blocked
          && issue?.reason_codes?.includes("managed-pack-requires-update")
          && doctor.remediation?.commands?.some((command) =>
            command.command.includes("update pairslash-plan --runtime")
          );
        return {
          success,
          summary: success
            ? "doctor managed reinstall parity includes machine-readable remediation commands"
            : "doctor managed reinstall parity is missing machine-readable remediation commands",
          doctor_success: doctor.install_blocked,
          support_verdict: doctor.support_verdict,
          issue_codes: collectIssueCodes(doctor),
          repro_key: `${definition.id}:${definition.fixture_id}:${lane.runtime}:${lane.target}`,
          commands: definition.commands,
          details: {
            preview_reason_codes: defaultInstallPreview.plan.reason_codes.slice(),
            doctor_reason_codes: doctor.reason_codes.slice(),
            remediation_commands: (doctor.remediation?.commands ?? []).map((entry) => entry.command),
          },
        };
      },
    ),
  );
}

function runWindowsPrepPreviewScenario({ repoRoot, lane, runtimeHarness, runtime, target }) {
  const definition = {
    id: `prep-preview.${runtimeFlag(runtime)}.${target}`,
    runtime,
    target,
    fixture_id: "repo-basic-readonly",
    commands: [
      buildDoctorCommand(runtime, target),
      buildLifecycleCommand("preview install", runtime, target),
    ],
  };
  return runScenario(definition, () =>
    withFixture(
      {
        repoRoot,
        fixtureId: definition.fixture_id,
        runtimeHarness,
        target,
      },
      ({ tempRoot }) => {
        const doctor = runDoctor({
          repoRoot: tempRoot,
          ...doctorOptions(lane, runtime, target),
        });
        const preview = planInstall({
          repoRoot: tempRoot,
          runtime,
          target,
          packs: [PRIMARY_PACK_ID],
        });
        const success =
          doctor.support_lane.lane_status === "prep" &&
          !doctor.install_blocked &&
          preview.plan.can_apply;
        return {
          success,
          doctor_success: !doctor.install_blocked,
          support_verdict: doctor.support_verdict,
          summary: success
            ? `windows prep lane can run doctor and preview install for ${runtimeFlag(runtime)} ${target}`
            : `windows prep lane failed doctor or preview for ${runtimeFlag(runtime)} ${target}`,
          issue_codes: collectIssueCodes(doctor),
          repro_key: `${definition.id}:${definition.fixture_id}:${runtime}:${target}`,
          commands: definition.commands,
          details: {
            support_lane: { ...doctor.support_lane },
            preview_summary: { ...preview.plan.summary },
          },
        };
      },
    ),
  );
}

function runWindowsConflictDoctorScenario({ repoRoot, lane, runtimeHarness }) {
  const definition = {
    id: "prep-doctor-conflict.copilot.repo",
    runtime: "copilot_cli",
    target: "repo",
    fixture_id: "repo-conflict-existing-runtime",
    commands: [buildDoctorCommand("copilot_cli", "repo")],
  };
  return runScenario(definition, () =>
    withFixture(
      {
        repoRoot,
        fixtureId: definition.fixture_id,
        runtimeHarness,
        target: "repo",
      },
      ({ tempRoot }) => {
        const doctor = runDoctor({
          repoRoot: tempRoot,
          ...doctorOptions(lane, "copilot_cli", "repo"),
        });
        const success =
          doctor.install_blocked &&
          doctor.issues.some((issue) => issue.check_id === "conflict.unmanaged_install_root");
        return {
          success,
          doctor_success: success,
          support_verdict: doctor.support_verdict,
          summary: success
            ? "doctor catches unmanaged Copilot runtime conflicts in the Windows prep lane"
            : "doctor missed the unmanaged Copilot runtime conflict in the Windows prep lane",
          issue_codes: collectIssueCodes(doctor),
          repro_key: `${definition.id}:${definition.fixture_id}:copilot_cli:repo`,
          commands: definition.commands,
          details: {
            blocking_issue_checks: doctor.issues.map((issue) => issue.check_id),
          },
        };
      },
    ),
  );
}

function runLaneScenarios({ repoRoot, lane, runtimeHarness }) {
  if (lane.key === "macos" || lane.key === "linux") {
    return [
      runFreshInstallScenario({ repoRoot, lane, runtimeHarness }),
      runReadAuthorityScenario({ repoRoot, lane, runtimeHarness }),
      runUpdatePreserveOverrideScenario({ repoRoot, lane, runtimeHarness }),
      runUninstallOwnedOnlyScenario({ repoRoot, lane, runtimeHarness }),
      runReconcileParityScenario({ repoRoot, lane, runtimeHarness }),
      runInstallRootShapeParityScenario({ repoRoot, lane, runtimeHarness }),
      runStaleStateParityScenario({ repoRoot, lane, runtimeHarness }),
      runManagedReinstallRedirectScenario({ repoRoot, lane, runtimeHarness }),
      runManagedReinstallRemediationScenario({ repoRoot, lane, runtimeHarness }),
      runBrokenConfigDoctorScenario({ repoRoot, lane, runtimeHarness }),
    ];
  }
  return [
    runWindowsPrepPreviewScenario({
      repoRoot,
      lane,
      runtimeHarness,
      runtime: "codex_cli",
      target: "repo",
    }),
    runWindowsPrepPreviewScenario({
      repoRoot,
      lane,
      runtimeHarness,
      runtime: "copilot_cli",
      target: "user",
    }),
    runWindowsConflictDoctorScenario({
      repoRoot,
      lane,
      runtimeHarness,
    }),
  ];
}

function buildLaneReport(lane, scenarios) {
  const installScenario = scenarios.find((scenario) => scenario.install_success !== null) ?? null;
  const doctorScenarios = scenarios.filter((scenario) => scenario.doctor_success !== null);
  const status = scenarios.every((scenario) => scenario.status === "pass") ? "pass" : "fail";
  const supportClaimBoundary = buildSupportClaimBoundary();
  return {
    kind: "compat-lab-acceptance-report",
    schema_version: SCHEMA_VERSION,
    lane_id: lane.id,
    lane_key: lane.key,
    status,
    os_lane: lane.os_lane,
    acceptance_mode: COMPAT_RUNTIME_FIXTURE_MODE,
    evidence_mode: COMPAT_RUNTIME_FIXTURE_MODE,
    evidence_partition: buildAcceptanceEvidencePartition(),
    support_claim_boundary: supportClaimBoundary,
    runtime_versions: { ...RUNTIME_VERSIONS },
    install_success: installScenario?.install_success ?? null,
    doctor_success:
      doctorScenarios.length > 0
        ? doctorScenarios.every((scenario) => scenario.doctor_success === true)
        : null,
    time_to_first_success_ms: installScenario?.time_to_first_success_ms ?? null,
    issue_codes: uniqueSorted(scenarios.flatMap((scenario) => scenario.issue_codes)),
    repro_key: `compat-lab-acceptance:${lane.key}`,
    commands: laneCommandsFor(lane),
    artifact_paths: {
      report_path: null,
    },
    scenarios,
  };
}

function resolveLane(laneInput) {
  if (!laneInput || laneInput === "all") {
    return "all";
  }
  const matched = DEFAULT_ACCEPTANCE_LANES.find(
    (lane) => lane.key === laneInput || lane.id === laneInput,
  );
  if (!matched) {
    throw new Error(`unknown acceptance lane: ${laneInput}`);
  }
  return matched;
}

function runLaneReport({ repoRoot, lane }) {
  const runtimeHarness = installCompatRuntimeShims({
    codexVersion: RUNTIME_VERSIONS.codex_cli,
    copilotVersion: RUNTIME_VERSIONS.copilot_cli,
  });
  try {
    const scenarios = runLaneScenarios({
      repoRoot,
      lane,
      runtimeHarness,
    });
    return buildLaneReport(lane, scenarios);
  } finally {
    runtimeHarness.cleanup();
  }
}

export function runCompatAcceptance({ repoRoot, lane = "all" } = {}) {
  const resolvedLane = resolveLane(lane);
  if (resolvedLane === "all") {
    const lanes = DEFAULT_ACCEPTANCE_LANES.map((entry) =>
      runLaneReport({
        repoRoot,
        lane: entry,
      }),
    );
    const supportClaimBoundary = buildSupportClaimBoundary();
    return {
      kind: "compat-lab-acceptance-suite",
      schema_version: SCHEMA_VERSION,
      status: lanes.every((entry) => entry.status === "pass") ? "pass" : "fail",
      acceptance_mode: COMPAT_RUNTIME_FIXTURE_MODE,
      evidence_partition: buildAcceptanceEvidencePartition(),
      support_claim_boundary: supportClaimBoundary,
      lanes,
      summary: {
        total_lanes: lanes.length,
        passed_lanes: lanes.filter((entry) => entry.status === "pass").length,
        failed_lanes: lanes.filter((entry) => entry.status !== "pass").length,
      },
    };
  }
  return runLaneReport({
    repoRoot,
    lane: resolvedLane,
  });
}

function formatScenarioLine(scenario) {
  return [
    `- ${scenario.id}: ${scenario.status.toUpperCase()} (${scenario.duration_ms}ms)`,
    `  ${scenario.summary}`,
  ].join("\n");
}

function formatEvidencePartitionSummary(partition) {
  const evidencePartition = partition ?? buildAcceptanceEvidencePartition();
  return [
    evidencePartition.deterministic?.evidence_class ?? COMPAT_RUNTIME_FIXTURE_EVIDENCE_CLASSES.deterministic,
    evidencePartition.fake?.evidence_class ?? COMPAT_RUNTIME_FIXTURE_EVIDENCE_CLASSES.fake,
    evidencePartition.shim?.evidence_class ?? COMPAT_RUNTIME_FIXTURE_EVIDENCE_CLASSES.shim,
  ].join(" + ");
}

export function formatCompatAcceptanceReportText(report) {
  if (report.kind === "compat-lab-acceptance-suite") {
    const supportClaimBoundary = report.support_claim_boundary ?? buildSupportClaimBoundary();
    const lines = [
      "Compat lab acceptance suite",
      `Status: ${report.status.toUpperCase()}`,
      `Acceptance mode: ${report.acceptance_mode ?? COMPAT_RUNTIME_FIXTURE_MODE}`,
      `Evidence partition: ${formatEvidencePartitionSummary(report.evidence_partition)} (live evidence not collected)`,
      `Support claim promotion allowed: ${supportClaimBoundary.public_support_promotion_allowed}`,
      `Lanes: ${report.summary.passed_lanes}/${report.summary.total_lanes} passing`,
      "",
    ];
    for (const lane of report.lanes) {
      const ttfs = lane.time_to_first_success_ms == null ? "n/a" : `${lane.time_to_first_success_ms}ms`;
      lines.push(
        `${lane.lane_id}: ${lane.status.toUpperCase()} | install=${lane.install_success ?? "n/a"} | doctor=${lane.doctor_success ?? "n/a"} | ttfs=${ttfs}`,
      );
    }
    return `${lines.join("\n")}\n`;
  }

  const supportClaimBoundary = report.support_claim_boundary ?? buildSupportClaimBoundary();
  const lines = [
    `Compat lab acceptance lane: ${report.lane_id}`,
    `Status: ${report.status.toUpperCase()}`,
    `Acceptance mode: ${report.acceptance_mode ?? report.evidence_mode ?? COMPAT_RUNTIME_FIXTURE_MODE}`,
    `Evidence partition: ${formatEvidencePartitionSummary(report.evidence_partition)} (live evidence not collected)`,
    `Support claim promotion allowed: ${supportClaimBoundary.public_support_promotion_allowed}`,
    `Live registry for support promotion: ${supportClaimBoundary.live_registry_root}`,
    `Install success: ${report.install_success ?? "n/a"}`,
    `Doctor success: ${report.doctor_success ?? "n/a"}`,
    `Time to first success (ms): ${report.time_to_first_success_ms ?? "n/a"}`,
    `Issue codes: ${report.issue_codes.length > 0 ? report.issue_codes.join(", ") : "none"}`,
    "Scenarios:",
    ...report.scenarios.map((scenario) => formatScenarioLine(scenario)),
    "Commands:",
    ...report.commands.map((command) => `- ${command}`),
  ];
  return `${lines.join("\n")}\n`;
}

export function runPhase4Acceptance(options = {}) {
  return runCompatAcceptance(options);
}

export function formatCompatAcceptanceText(report) {
  return formatCompatAcceptanceReportText(report);
}

export function formatPhase4AcceptanceText(report) {
  return formatCompatAcceptanceReportText(report);
}
