import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
import { installFakeRuntimes } from "./runtime-fixtures.js";

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
    "node packages/cli/src/bin/pairslash.js",
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
    "node packages/cli/src/bin/pairslash.js",
    "doctor",
    "--runtime",
    runtimeFlag(runtime),
    "--target",
    target,
  ].join(" ");
}

function buildFirstWorkflowStep() {
  return "/skills -> select pairslash-plan -> ask for a repo plan";
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

function doctorOptions(lane, runtime, target, packs = [PRIMARY_PACK_ID]) {
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
      runUpdatePreserveOverrideScenario({ repoRoot, lane, runtimeHarness }),
      runUninstallOwnedOnlyScenario({ repoRoot, lane, runtimeHarness }),
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
  return {
    kind: "phase4-acceptance-report",
    schema_version: SCHEMA_VERSION,
    lane_id: lane.id,
    lane_key: lane.key,
    status,
    os_lane: lane.os_lane,
    evidence_mode: "automation_baseline",
    runtime_versions: { ...RUNTIME_VERSIONS },
    install_success: installScenario?.install_success ?? null,
    doctor_success:
      doctorScenarios.length > 0
        ? doctorScenarios.every((scenario) => scenario.doctor_success === true)
        : null,
    time_to_first_success_ms: installScenario?.time_to_first_success_ms ?? null,
    issue_codes: uniqueSorted(scenarios.flatMap((scenario) => scenario.issue_codes)),
    repro_key: `phase4-acceptance:${lane.key}`,
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
  const runtimeHarness = installFakeRuntimes({
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

export function runPhase4Acceptance({ repoRoot, lane = "all" } = {}) {
  const resolvedLane = resolveLane(lane);
  if (resolvedLane === "all") {
    const lanes = DEFAULT_ACCEPTANCE_LANES.map((entry) =>
      runLaneReport({
        repoRoot,
        lane: entry,
      }),
    );
    return {
      kind: "phase4-acceptance-suite",
      schema_version: SCHEMA_VERSION,
      status: lanes.every((entry) => entry.status === "pass") ? "pass" : "fail",
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

export function formatPhase4AcceptanceText(report) {
  if (report.kind === "phase4-acceptance-suite") {
    const lines = [
      "Phase 4 acceptance suite",
      `Status: ${report.status.toUpperCase()}`,
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

  const lines = [
    `Phase 4 acceptance lane: ${report.lane_id}`,
    `Status: ${report.status.toUpperCase()}`,
    `Evidence mode: ${report.evidence_mode}`,
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
