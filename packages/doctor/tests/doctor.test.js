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
} from "../../../tests/phase4-helpers.js";

function buildCodexTestAdapter({
  runtimeAvailable = true,
  runtimeVersion = "0.116.0",
  writable = true,
  writableError = "permission denied",
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
    resolveConfigHome({ repoRoot }) {
      return join(repoRoot, ".agents");
    },
    resolveInstallRoot({ repoRoot }) {
      return join(repoRoot, ".agents", "skills");
    },
    resolvePackInstallDir({ repoRoot }, packId) {
      return join(repoRoot, ".agents", "skills", packId);
    },
    resolveAssetPath(asset) {
      return codexAdapter.resolveAssetPath(asset);
    },
    supportsInstallSurface(surface) {
      return codexAdapter.supportsInstallSurface(surface);
    },
    checkWritablePath() {
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
    assert.ok(report.checks.some((check) => check.id === "runtime.detect"));
    assert.ok(report.checks.some((check) => check.id === "filesystem.config_home"));
    assert.ok(["pass", "warn", "degraded"].includes(report.support_verdict));
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
    assert.ok(report.issues.some((issue) => issue.check_id === "install_state.owned_files_integrity"));
  } finally {
    runtime.cleanup();
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
    assert.ok(report.checks.some((check) => check.id === "runtime.detect"));
  } finally {
    runtime.restoreHome();
    runtime.cleanup();
    fixture.cleanup();
  }
});
