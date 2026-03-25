import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { runCli } from "../src/bin/pairslash.js";

import {
  createTempRepo,
  installFakeRuntime,
  repoRoot,
  updatePackManifest,
} from "../../../tests/phase4-helpers.js";

const serial = { concurrency: false };

test("pairslash preview install emits json plan", serial, async () => {
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    const exitCode = await runCli({
      argv: [
        "preview",
        "install",
        "pairslash-plan",
        "--runtime",
        "codex",
        "--target",
        "repo",
        "--format",
        "json",
      ],
      cwd: repoRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.equal(payload.action, "install");
    assert.equal(payload.runtime, "codex_cli");
    assert.deepEqual(payload.selected_packs, ["pairslash-plan"]);
  } finally {
    runtime.cleanup();
  }
});

test("pairslash preview rejects unknown action", serial, async () => {
  await assert.rejects(
    () =>
      runCli({
        argv: ["preview", "deploy", "--runtime", "codex"],
        cwd: repoRoot,
        stdout: {
          write() {},
        },
      }),
    /unknown preview action/,
  );
});

test("pairslash install --apply requires confirmation in non-interactive mode", serial, async () => {
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    await assert.rejects(
      () =>
        runCli({
          argv: ["install", "pairslash-plan", "--runtime", "codex", "--apply"],
          cwd: repoRoot,
          stdout: {
            isTTY: false,
            write() {},
          },
          stdin: {
            isTTY: false,
          },
        }),
      /confirmation-required/,
    );
  } finally {
    runtime.cleanup();
  }
});

test("pairslash install without pack id selects all valid manifests in the repo", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan", "pairslash-review"] });
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    const exitCode = await runCli({
      argv: ["install", "--runtime", "codex", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.deepEqual(payload.selected_packs, ["pairslash-plan", "pairslash-review"]);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash install writes preview plan to disk", serial, async () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    const exitCode = await runCli({
      argv: [
        "install",
        "pairslash-plan",
        "--runtime",
        "codex",
        "--plan-out",
        "tmp\\install-plan.json",
        "--format",
        "json",
      ],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const planPath = join(fixture.tempRoot, "tmp", "install-plan.json");
    assert.ok(existsSync(planPath));
    const payload = JSON.parse(readFileSync(planPath, "utf8"));
    assert.equal(payload.plan_path, planPath);
    assert.equal(JSON.parse(output).plan_path, planPath);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash install --dry-run emits preview without mutating state", serial, async () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ copilotVersion: "2.50.0" });
  let output = "";
  try {
    const exitCode = await runCli({
      argv: [
        "install",
        "pairslash-plan",
        "--runtime",
        "copilot",
        "--target",
        "repo",
        "--dry-run",
        "--format",
        "json",
      ],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.equal(payload.action, "install");
    assert.equal(payload.runtime, "copilot_cli");
    assert.equal(
      existsSync(join(fixture.tempRoot, ".pairslash", "install-state", "repo-copilot_cli.json")),
      false,
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash install with --runtime auto rejects ambiguous runtime detection", serial, async () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({
    codexVersion: "0.116.0",
    copilotVersion: "2.50.0",
  });
  try {
    await assert.rejects(
      () =>
        runCli({
          argv: ["preview", "install", "pairslash-plan", "--runtime", "auto"],
          cwd: fixture.tempRoot,
          stdout: {
            write() {},
          },
        }),
      /runtime-ambiguous/,
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash install rejects conflicting --apply and --dry-run", serial, async () => {
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    await assert.rejects(
      () =>
        runCli({
          argv: [
            "install",
            "pairslash-plan",
            "--runtime",
            "codex",
            "--apply",
            "--dry-run",
          ],
          cwd: repoRoot,
          stdout: {
            write() {},
          },
        }),
      /cannot be used together/,
    );
  } finally {
    runtime.cleanup();
  }
});

test("pairslash update --dry-run emits preview with from/to metadata", serial, async () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    await runCli({
      argv: ["install", "pairslash-plan", "--runtime", "codex", "--apply", "--yes"],
      cwd: fixture.tempRoot,
      stdout: { write() {}, isTTY: true },
      stdin: { isTTY: true },
    });
    const exitCode = await runCli({
      argv: [
        "update",
        "pairslash-plan",
        "--runtime",
        "codex",
        "--from",
        "0.2.0",
        "--to",
        "packs/core/pairslash-plan/pack.manifest.yaml",
        "--dry-run",
        "--format",
        "json",
      ],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.equal(payload.action, "update");
    assert.equal(payload.selected_packs[0], "pairslash-plan");
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash update without pack id selects all installed packs", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan", "pairslash-review"] });
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    await runCli({
      argv: ["install", "--runtime", "codex", "--apply", "--yes"],
      cwd: fixture.tempRoot,
      stdout: { write() {}, isTTY: true },
      stdin: { isTTY: true },
    });
    const exitCode = await runCli({
      argv: ["update", "--runtime", "codex", "--dry-run", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.deepEqual(payload.selected_packs, ["pairslash-plan", "pairslash-review"]);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash update rejects --force in phase 4", serial, async () => {
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    await assert.rejects(
      () =>
        runCli({
          argv: ["update", "pairslash-plan", "--runtime", "codex", "--force"],
          cwd: repoRoot,
          stdout: { write() {} },
        }),
      /unsupported-flag/,
    );
  } finally {
    runtime.cleanup();
  }
});

test("pairslash uninstall without pack id selects all installed packs", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan", "pairslash-review"] });
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    await runCli({
      argv: ["install", "--runtime", "codex", "--apply", "--yes"],
      cwd: fixture.tempRoot,
      stdout: { write() {}, isTTY: true },
      stdin: { isTTY: true },
    });
    const exitCode = await runCli({
      argv: ["uninstall", "--runtime", "codex", "--dry-run", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.deepEqual(payload.selected_packs, ["pairslash-plan", "pairslash-review"]);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash uninstall --apply emits lifecycle summary and removes state", serial, async () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    await runCli({
      argv: ["install", "pairslash-plan", "--runtime", "codex", "--apply", "--yes"],
      cwd: fixture.tempRoot,
      stdout: { write() {}, isTTY: true },
      stdin: { isTTY: true },
    });
    const exitCode = await runCli({
      argv: ["uninstall", "pairslash-plan", "--runtime", "codex", "--apply", "--yes"],
      cwd: fixture.tempRoot,
      stdout: {
        isTTY: true,
        write(chunk) {
          output += chunk;
        },
      },
      stdin: { isTTY: true },
    });
    assert.equal(exitCode, 0);
    assert.match(output, /Action: uninstall/);
    assert.equal(
      existsSync(join(fixture.tempRoot, ".pairslash", "install-state", "repo-codex_cli.json")),
      false,
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash doctor emits structured json report", serial, async () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    const exitCode = await runCli({
      argv: ["doctor", "--runtime", "codex", "--target", "repo", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.equal(payload.kind, "doctor-report");
    assert.equal(payload.runtime, "codex_cli");
    assert.equal(payload.schema_version, "2.1.0");
    assert.equal(payload.install_blocked, false);
    assert.equal(payload.support_lane.lane_status, "prep");
    assert.equal(payload.scope_probes.repo.selected, true);
    assert.ok(payload.checks.some((check) => check.id === "runtime.presence_matrix"));
    assert.ok(Array.isArray(payload.checks));
    assert.ok(Array.isArray(payload.issues));
    assert.ok(Array.isArray(payload.first_workflow_guidance.commands));
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash doctor text output includes immediate next action", serial, async () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    const exitCode = await runCli({
      argv: ["doctor", "--runtime", "codex", "--target", "repo"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    assert.match(output, /Immediate next action:/);
    assert.match(output, /Codex present:/);
    assert.match(output, /Copilot present:/);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash doctor --strict fails on non-blocking warnings", serial, async () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    const exitCode = await runCli({
      argv: ["doctor", "--runtime", "codex", "--target", "repo", "--strict"],
      cwd: fixture.tempRoot,
      stdout: { write() {} },
    });
    assert.equal(exitCode, 1);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash doctor auto runtime resolves from install state", serial, async () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    await runCli({
      argv: ["install", "pairslash-plan", "--runtime", "codex", "--apply", "--yes"],
      cwd: fixture.tempRoot,
      stdout: { write() {}, isTTY: true },
      stdin: { isTTY: true },
    });
    const exitCode = await runCli({
      argv: ["doctor", "--runtime", "auto", "--target", "repo", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.equal(payload.runtime, "codex_cli");
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash lint --phase4 emits bridge json report", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  let output = "";
  try {
    const exitCode = await runCli({
      argv: ["lint", "--phase4", "pairslash-plan", "--runtime", "all", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.equal(payload.kind, "lint-report");
    assert.equal(payload.phase, "phase4-bridge");
  } finally {
    fixture.cleanup();
  }
});

test("pairslash lint requires --phase4", serial, async () => {
  await assert.rejects(
    () =>
      runCli({
        argv: ["lint", "--format", "json"],
        cwd: repoRoot,
        stdout: { write() {} },
      }),
    /requires --phase4/,
  );
});

test("pairslash lint --strict fails on warnings", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  let output = "";
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.risk_level = "medium";
        manifest.capabilities = [...manifest.capabilities, "shell_exec"];
        manifest.required_tools = [];
        return manifest;
      },
    });
    const exitCode = await runCli({
      argv: ["lint", "--phase4", "pairslash-plan", "--runtime", "codex", "--strict", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 1);
    const payload = JSON.parse(output);
    assert.equal(payload.summary.error_count, 0);
    assert.ok(payload.summary.warning_count > 0);
  } finally {
    fixture.cleanup();
  }
});
