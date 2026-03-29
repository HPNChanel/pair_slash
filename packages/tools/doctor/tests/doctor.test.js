import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { applyInstall, planInstall } from "@pairslash/installer";
import { runDoctor } from "@pairslash/doctor";
import * as codexAdapter from "@pairslash/runtime-codex-adapter";

import {
  createTempRepo,
  installFakeRuntime,
  updatePackManifest,
} from "../../../../tests/phase4-helpers.js";

function buildCodexTestAdapter({
  runtimeAvailable = true,
  runtimeVersion = "0.116.0",
  writable = true,
  writableError = "permission denied",
  resolveConfigHome = null,
  resolveInstallRoot = null,
  checkWritablePath = null,
} = {}) {
  return {
    detectRuntime() {
      if (!runtimeAvailable) {
        return {
          available: false,
          executable: "codex",
          version: null,
          error: "codex not found",
        };
      }
      return {
        available: true,
        executable: "codex",
        version: runtimeVersion,
      };
    },
    resolveConfigHome({ repoRoot, target }) {
      if (typeof resolveConfigHome === "function") {
        return resolveConfigHome({ repoRoot, target });
      }
      return target === "user" ? join(repoRoot, "home", ".agents") : join(repoRoot, ".agents");
    },
    resolveInstallRoot({ repoRoot, target }) {
      if (typeof resolveInstallRoot === "function") {
        return resolveInstallRoot({ repoRoot, target });
      }
      return target === "user"
        ? join(repoRoot, "home", ".agents", "skills")
        : join(repoRoot, ".agents", "skills");
    },
    resolvePackInstallDir({ repoRoot, target }, packId) {
      return join(this.resolveInstallRoot({ repoRoot, target }), packId);
    },
    resolveAssetPath(asset) {
      return codexAdapter.resolveAssetPath(asset);
    },
    supportsInstallSurface(surface) {
      return codexAdapter.supportsInstallSurface(surface);
    },
    checkWritablePath(path) {
      if (typeof checkWritablePath === "function") {
        return checkWritablePath(path);
      }
      return writable ? { writable: true } : { writable: false, error: writableError };
    },
  };
}

test("doctor reports structured environment summary for codex repo lane", () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    const report = runDoctor({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
    });
    assert.equal(report.runtime, "codex_cli");
    assert.equal(report.target, "repo");
    assert.equal(report.environment_summary.runtime_available, true);
    assert.ok(report.environment_summary.config_home.endsWith(".agents"));
    assert.ok(Array.isArray(report.environment_summary.shell_profile_candidates));
    assert.equal(report.install_blocked, false);
    assert.equal(report.scope_probes.repo.selected, true);
    assert.equal(report.scope_probes.user.selected, false);
    assert.equal(report.support_lane.lane_status, "prep");
    assert.equal(report.support_lane.tested_range_status, "prep_lane");
    assert.equal(report.recent_trace_summary.telemetry_mode, "off");
    assert.equal(report.recent_trace_summary.session_count, 0);
    assert.equal(typeof report.observability_health.trace_root_exists, "boolean");
    assert.equal(typeof report.observability_health.trace_root_writable, "boolean");
    assert.equal(typeof report.observability_health.index_event_consistent, "boolean");
    assert.equal(typeof report.observability_health.missing_event_files, "number");
    assert.equal(typeof report.observability_health.retention_policy.max_days, "number");
    assert.equal(report.first_workflow_guidance.recommended_pack_id, "pairslash-plan");
    assert.ok(report.checks.some((check) => check.id === "platform.shell_profile_candidates"));
    assert.ok(report.checks.some((check) => check.id === "runtime.presence_matrix"));
    assert.ok(report.checks.some((check) => check.id === "runtime.detect"));
    assert.ok(report.checks.some((check) => check.id === "filesystem.config_home"));
    assert.equal(report.support_verdict, "degraded");
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("doctor marks unsupported operating systems with blocking verdict", () => {
  const fixture = createTempRepo();
  try {
    const report = runDoctor({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      _adapter_override: buildCodexTestAdapter(),
      _os_override: "freebsd",
      _shell_override: "bash",
    });
    assert.equal(report.support_verdict, "unsupported");
    assert.equal(report.install_blocked, true);
    assert.ok(report.issues.some((issue) => issue.check_id === "platform.support_lane"));
  } finally {
    fixture.cleanup();
  }
});

test("doctor reports both scope probes and blocks only the selected scope", () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    mkdirSync(join(fixture.tempRoot, ".agents", "skills"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, "home", ".agents", "skills"), { recursive: true });
    const repoManagedRoot = join(fixture.tempRoot, ".agents");
    const userManagedRoot = join(fixture.tempRoot, "home", ".agents");
    const report = runDoctor({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      _adapter_override: buildCodexTestAdapter({
        checkWritablePath(path) {
          if (path.startsWith(repoManagedRoot) && !path.startsWith(userManagedRoot)) {
            return { writable: false, error: "mocked repo permission denied" };
          }
          return { writable: true };
        },
      }),
    });
    assert.equal(report.install_blocked, true);
    assert.equal(report.scope_probes.repo.verdict, "fail");
    assert.equal(report.scope_probes.repo.blocking_for_install, true);
    assert.equal(report.scope_probes.user.verdict, "pass");
    assert.ok(report.issues.some((issue) => issue.check_id === "filesystem.write_permission"));
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("doctor returns degraded when override-eligible file is edited after install", () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    applyInstall(planInstall({ repoRoot: fixture.tempRoot, runtime: "codex", target: "repo" }));
    const skillPath = join(fixture.tempRoot, ".agents", "skills", "pairslash-plan", "SKILL.md");
    writeFileSync(skillPath, `${readFileSync(skillPath, "utf8")}\nLocal override\n`);

    const report = runDoctor({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
    });
    assert.equal(report.support_verdict, "degraded");
    assert.equal(report.install_blocked, false);
    assert.ok(report.issues.some((issue) => issue.check_id === "install_state.owned_files_integrity"));
    assert.ok(report.issues.some((issue) => issue.check_id === "install_state.update_preview_risk"));
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("doctor degrades when runtime version falls outside recorded pilot evidence", () => {
  const fixture = createTempRepo();
  try {
    const report = runDoctor({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      _adapter_override: buildCodexTestAdapter({
        runtimeAvailable: true,
        runtimeVersion: "0.200.0",
      }),
      _os_override: "darwin",
      _shell_override: "zsh",
    });
    assert.equal(report.support_lane.lane_status, "supported");
    assert.equal(report.support_verdict, "degraded");
    assert.ok(report.issues.some((issue) => issue.check_id === "runtime.tested_range"));
  } finally {
    fixture.cleanup();
  }
});

test("doctor fails runtime version mismatch", () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.100.0" });
  try {
    const report = runDoctor({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
    });
    assert.equal(report.support_verdict, "fail");
    assert.ok(report.issues.some((issue) => issue.check_id === "runtime.version_range"));
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("doctor fails missing runtime check", () => {
  const fixture = createTempRepo();
  try {
    const report = runDoctor({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      _adapter_override: buildCodexTestAdapter({ runtimeAvailable: false }),
    });
    assert.equal(report.support_verdict, "fail");
    assert.ok(report.issues.some((issue) => issue.check_id === "runtime.detect"));
  } finally {
    fixture.cleanup();
  }
});

test("doctor fails when config home path is a file", () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    writeFileSync(join(fixture.tempRoot, ".agents"), "not-a-directory");
    const report = runDoctor({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
    });
    assert.equal(report.support_verdict, "fail");
    assert.ok(report.issues.some((issue) => issue.check_id === "filesystem.config_home"));
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("doctor fails permission-denied check with explicit remediation", () => {
  const fixture = createTempRepo();
  try {
    const report = runDoctor({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      _adapter_override: buildCodexTestAdapter({
        runtimeAvailable: true,
        runtimeVersion: "0.116.0",
        writable: false,
        writableError: "mocked permission denied",
      }),
    });
    assert.equal(report.support_verdict, "fail");
    const permissionIssue = report.issues.find(
      (issue) => issue.check_id === "filesystem.write_permission",
    );
    assert.ok(permissionIssue);
    assert.match(permissionIssue.remediation, /Fix filesystem permissions/);
  } finally {
    fixture.cleanup();
  }
});

test("doctor fails direct invocation naming conflicts", () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan", "pairslash-review"] });
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-review",
      mutate(manifest) {
        manifest.pack.id = "pairslash-plan";
        manifest.assets.pack_dir = "packs/core/pairslash-plan";
        manifest.runtime_targets.codex_cli.direct_invocation = "$pairslash-plan";
        manifest.runtime_targets.codex_cli.skill_directory_name = "pairslash-plan";
        manifest.runtime_targets.copilot_cli.direct_invocation = "/pairslash-plan";
        manifest.runtime_targets.copilot_cli.skill_directory_name = "pairslash-plan";
        return manifest;
      },
    });

    const report = runDoctor({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
    });
    assert.equal(report.support_verdict, "fail");
    assert.ok(report.issues.some((issue) => issue.check_id === "manifest.naming_conflicts"));
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("doctor targeted pack ignores unrelated invalid manifest", () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan", "pairslash-review"] });
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-review",
      mutate(manifest) {
        manifest.supported_runtime_ranges.cursor = ">=1.0.0";
        return manifest;
      },
    });

    const report = runDoctor({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.notEqual(report.support_verdict, "fail");
    assert.ok(
      report.checks.some(
        (check) =>
          check.id === "manifest.discover_and_validate" &&
          ["pass", "warn"].includes(check.status),
      ),
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("doctor fails missing required tool checks", () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.required_tools = [
          {
            id: "missing-binary",
            kind: "binary",
            required_for: ["doctor"],
            check_command: "missing-binary --version",
          },
        ];
        return manifest;
      },
    });

    const report = runDoctor({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.support_verdict, "fail");
    assert.ok(report.issues.some((issue) => issue.check_id === "dependencies.required_tools"));
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("doctor fails missing MCP config for installed pack", () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.capabilities = [...manifest.capabilities, "mcp_client"].sort();
        manifest.required_mcp_servers = [{ id: "repo-memory" }];
        return manifest;
      },
    });
    applyInstall(planInstall({ repoRoot: fixture.tempRoot, runtime: "codex", target: "repo" }));
    unlinkSync(
      join(
        fixture.tempRoot,
        ".agents",
        "skills",
        "pairslash-plan",
        "fragments",
        "mcp",
        "servers.yaml",
      ),
    );

    const report = runDoctor({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.support_verdict, "fail");
    assert.ok(report.issues.some((issue) => issue.check_id === "dependencies.required_mcp_servers"));
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("doctor fails when install state shows runtime-native asset placement drift", () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    applyInstall(planInstall({ repoRoot: fixture.tempRoot, runtime: "codex", target: "repo" }));
    const statePath = join(
      fixture.tempRoot,
      ".pairslash",
      "install-state",
      "repo-codex_cli.json",
    );
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    state.packs[0].files[0].install_surface = "hook";
    writeFileSync(statePath, JSON.stringify(state, null, 2));

    const report = runDoctor({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
    });
    assert.equal(report.support_verdict, "fail");
    assert.ok(report.issues.some((issue) => issue.check_id === "install_state.asset_placement"));
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("doctor supports copilot user scope smoke lane", () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ copilotVersion: "2.50.0" });
  const homePath = join(fixture.tempRoot, "home");
  mkdirSync(homePath, { recursive: true });
  runtime.setHome(homePath);
  try {
    const report = runDoctor({
      repoRoot: fixture.tempRoot,
      runtime: "copilot_cli",
      target: "user",
    });
    assert.equal(report.runtime, "copilot_cli");
    assert.equal(report.target, "user");
    assert.ok(report.environment_summary.config_home.includes(".copilot"));
    assert.equal(report.scope_probes.user.selected, true);
    assert.ok(report.checks.some((check) => check.id === "runtime.detect"));
  } finally {
    runtime.restoreHome();
    runtime.cleanup();
    fixture.cleanup();
  }
});
