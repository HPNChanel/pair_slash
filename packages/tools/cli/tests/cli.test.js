import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

import { runCli } from "../src/bin/pairslash.js";
import { listTraceIndexes, loadTraceEvents } from "@pairslash/trace";
import { validateCandidateReport, validateMemoryAuditReport } from "@pairslash/spec-core";

import {
  createTempRepo,
  installFakeRuntime,
  repoRoot,
  updatePackManifest,
  updatePackTrustAuthority,
  writeManualInstallFile,
} from "../../../../tests/phase4-helpers.js";

const serial = { concurrency: false };

function buildMemoryWriteArgs(extra = []) {
  return [
    "--runtime",
    "codex",
    "--target",
    "repo",
    "--kind",
    "constraint",
    "--title",
    "Preview required before memory commit",
    "--statement",
    "Preview must be shown before authoritative memory commit.",
    "--evidence",
    "packages/tools/cli/tests/cli.test.js",
    "--scope",
    "whole-project",
    "--confidence",
    "high",
    "--action",
    "append",
    ...extra,
  ];
}

function buildMemoryCandidateArgs(extra = []) {
  return [
    "--runtime",
    "codex",
    "--target",
    "repo",
    "--task-scope",
    "phase17-candidate-reconcile",
    "--max-candidates",
    "10",
    ...extra,
  ];
}

function buildMemoryAuditArgs(extra = []) {
  return [
    "--runtime",
    "codex",
    "--target",
    "repo",
    "--audit-scope",
    "full",
    ...extra,
  ];
}

function seedMemoryIndex(repoRoot) {
  const indexPath = join(repoRoot, ".pairslash", "project-memory", "90-memory-index.yaml");
  mkdirSync(join(repoRoot, ".pairslash", "project-memory"), { recursive: true });
  writeFileSync(
    indexPath,
    YAML.stringify(
      {
        version: "0.1.0",
        last_updated: "2026-03-26T00:00:00.000Z",
        updated_by: "tests",
        records: [],
      },
      { lineWidth: 0, simpleKeys: true },
    ),
  );
}

function readOptionalFile(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

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

test("pairslash preview install json includes lifecycle reason codes and remediation actions", serial, async () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    writeManualInstallFile({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      packId: "pairslash-plan",
      relativePath: "SKILL.md",
      content: "manual override\n",
    });
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
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    const operation = payload.operations.find((entry) => entry.relative_path === "SKILL.md");
    assert.ok(payload.reason_codes.includes("reconcile-unmanaged-override-preserved"));
    assert.ok(Array.isArray(payload.remediation_actions));
    assert.equal(operation.kind, "reconcile_unmanaged");
    assert.equal(operation.reason_code, "reconcile-unmanaged-override-preserved");
  } finally {
    runtime.cleanup();
    fixture.cleanup();
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

test("pairslash install without pack id selects bootstrap pack-set", serial, async () => {
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
    assert.deepEqual(payload.selected_packs, ["pairslash-plan"]);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash install without pack id honors catalog default recommendation", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan", "pairslash-review"] });
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.catalog.default_recommendation = false;
        return manifest;
      },
    });
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-review",
      mutate(manifest) {
        manifest.catalog.default_recommendation = true;
        return manifest;
      },
    });
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
    assert.deepEqual(payload.selected_packs, ["pairslash-review"]);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash install --all selects all valid manifests in the repo", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan", "pairslash-review"] });
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    const exitCode = await runCli({
      argv: ["install", "--runtime", "codex", "--all", "--format", "json"],
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

test("pairslash install rejects invalid --pack-set", serial, async () => {
  await assert.rejects(
    () =>
      runCli({
        argv: ["install", "--runtime", "codex", "--pack-set", "unknown"],
        cwd: repoRoot,
        stdout: {
          write() {},
        },
      }),
    /invalid --pack-set value/,
  );
});

test("pairslash update rejects install-only --pack-set flags", serial, async () => {
  await assert.rejects(
    () =>
      runCli({
        argv: ["update", "--runtime", "codex", "--pack-set", "core"],
        cwd: repoRoot,
        stdout: {
          write() {},
        },
      }),
    /only available for install/,
  );
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
      argv: ["install", "--runtime", "codex", "--all", "--apply", "--yes"],
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
      argv: ["install", "--runtime", "codex", "--all", "--apply", "--yes"],
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
    assert.equal(payload.schema_version, "2.2.0");
    assert.equal(payload.install_blocked, false);
    assert.equal(payload.support_lane.lane_status, "prep");
    assert.equal(payload.scope_probes.repo.selected, true);
    assert.ok(payload.checks.some((check) => check.id === "runtime.presence_matrix"));
    assert.ok(payload.checks.some((check) => check.id === "manifest.workflow_maturity_alignment"));
    assert.ok(Array.isArray(payload.checks));
    assert.ok(Array.isArray(payload.issues));
    assert.equal(typeof payload.workflow_maturity.selected_pack_count, "number");
    assert.ok(Array.isArray(payload.workflow_maturity.selected_packs));
    assert.ok(Array.isArray(payload.first_workflow_guidance.commands));
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash doctor json includes lifecycle reason codes and remediation actions", serial, async () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    writeManualInstallFile({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      packId: "pairslash-plan",
      relativePath: "SKILL.md",
      content: "manual override\n",
    });
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
    const issue = payload.issues.find((entry) => entry.check_id === "conflict.unmanaged_install_root");
    assert.ok(payload.reason_codes.includes("reconcile-unmanaged-override-preserved"));
    assert.ok(Array.isArray(payload.remediation_actions));
    assert.ok(issue.reason_codes.includes("reconcile-unmanaged-override-preserved"));
    assert.equal(payload.remediation.status, "advisory");
    assert.ok(Array.isArray(payload.remediation.commands));
    assert.ok(
      payload.remediation.commands.some((command) =>
        command.command.includes("preview install pairslash-plan"),
      ),
    );
    assert.ok(
      payload.remediation.actions.some(
        (action) =>
          action.reason_codes.includes("reconcile-unmanaged-override-preserved") &&
          action.decision === "reconcile",
      ),
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash preview install and doctor --packs share managed reinstall reason code", serial, async () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let previewOutput = "";
  let doctorOutput = "";
  try {
    await runCli({
      argv: [
        "install",
        "pairslash-plan",
        "--runtime",
        "codex",
        "--target",
        "repo",
        "--apply",
        "--yes",
      ],
      cwd: fixture.tempRoot,
      stdout: { write() {}, isTTY: true },
      stdin: { isTTY: true },
    });

    const previewExitCode = await runCli({
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
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          previewOutput += chunk;
        },
      },
    });
    assert.equal(previewExitCode, 1);

    const doctorExitCode = await runCli({
      argv: [
        "doctor",
        "--runtime",
        "codex",
        "--target",
        "repo",
        "--packs",
        "pairslash-plan",
        "--format",
        "json",
      ],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          doctorOutput += chunk;
        },
      },
    });
    assert.equal(doctorExitCode, 1);

    const previewPayload = JSON.parse(previewOutput);
    const doctorPayload = JSON.parse(doctorOutput);
    assert.ok(previewPayload.commitability.blocked_reason_codes.includes("managed-pack-requires-update"));
    assert.ok(previewPayload.reason_codes.includes("managed-pack-requires-update"));
    assert.ok(doctorPayload.reason_codes.includes("managed-pack-requires-update"));
    assert.ok(
      doctorPayload.issues.some((issue) => issue.reason_codes?.includes("managed-pack-requires-update")),
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash preview install and doctor block non-directory pack install root", serial, async () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let previewOutput = "";
  let doctorOutput = "";
  try {
    mkdirSync(join(fixture.tempRoot, ".agents", "skills"), { recursive: true });
    writeFileSync(join(fixture.tempRoot, ".agents", "skills", "pairslash-plan"), "blocked-root\n");

    const previewExitCode = await runCli({
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
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          previewOutput += chunk;
        },
      },
    });
    assert.equal(previewExitCode, 1);

    const doctorExitCode = await runCli({
      argv: ["doctor", "--runtime", "codex", "--target", "repo", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          doctorOutput += chunk;
        },
      },
    });
    assert.equal(doctorExitCode, 1);

    const previewPayload = JSON.parse(previewOutput);
    const doctorPayload = JSON.parse(doctorOutput);
    const issue = doctorPayload.issues.find((entry) => entry.check_id === "conflict.unmanaged_install_root");
    assert.ok(previewPayload.reason_codes.includes("unmanaged-conflict-blocking"));
    assert.ok(doctorPayload.reason_codes.includes("unmanaged-conflict-blocking"));
    assert.ok(issue?.reason_codes?.includes("unmanaged-conflict-blocking"));
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
    assert.match(output, /Recent traces:/);
    assert.match(output, /Codex present:/);
    assert.match(output, /Copilot present:/);
    assert.match(output, /Selected pack for install guidance:/);
    assert.match(output, /Selected pack for first workflow path:/);
    assert.doesNotMatch(output, /Recommended pack:/);
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

test("pairslash lint emits contract/policy json report", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  let output = "";
  try {
    const exitCode = await runCli({
      argv: ["lint", "pairslash-plan", "--runtime", "all", "--format", "json"],
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
    assert.equal(payload.phase, "phase5-contract-policy");
    assert.ok(Array.isArray(payload.policy_verdicts));
  } finally {
    fixture.cleanup();
  }
});

test("pairslash preview memory-write-global emits preview without mutating memory", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-write-global"] });
  let output = "";
  try {
    seedMemoryIndex(fixture.tempRoot);
    const constraintsPath = join(fixture.tempRoot, ".pairslash", "project-memory", "50-constraints.yaml");
    const beforeConstraints = readOptionalFile(constraintsPath);
    const exitCode = await runCli({
      argv: ["preview", "memory-write-global", ...buildMemoryWriteArgs(["--format", "json"])],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.equal(payload.kind, "memory-write-preview");
    assert.equal(payload.policy_verdict.machine_readable, true);
    assert.equal(
      existsSync(join(fixture.tempRoot, payload.staging_artifact.path)),
      true,
    );
    assert.equal(readOptionalFile(constraintsPath), beforeConstraints);
  } finally {
    fixture.cleanup();
  }
});

test("pairslash preview memory-write-global resolves --runtime auto from the detected runtime", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-write-global"] });
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    seedMemoryIndex(fixture.tempRoot);
    const exitCode = await runCli({
      argv: [
        "preview",
        "memory-write-global",
        "--runtime",
        "auto",
        "--target",
        "repo",
        "--kind",
        "constraint",
        "--title",
        "Auto runtime detection for memory write",
        "--statement",
        "Memory write preview should resolve the detected runtime instead of assuming codex.",
        "--evidence",
        "packages/tools/cli/tests/cli.test.js",
        "--scope",
        "whole-project",
        "--confidence",
        "high",
        "--action",
        "append",
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
    assert.equal(payload.runtime, "codex_cli");
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash preview memory-write-global fails --runtime auto when multiple runtimes are detected", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-write-global"] });
  const runtime = installFakeRuntime({ codexVersion: "0.116.0", copilotVersion: "1.2.3" });
  try {
    seedMemoryIndex(fixture.tempRoot);
    await assert.rejects(
      () =>
        runCli({
          argv: [
            "preview",
            "memory-write-global",
            "--runtime",
            "auto",
            "--target",
            "repo",
            "--kind",
            "constraint",
            "--title",
            "Ambiguous runtime detection for memory write",
            "--statement",
            "Memory write preview must refuse ambiguous runtime auto-selection.",
            "--evidence",
            "packages/tools/cli/tests/cli.test.js",
            "--scope",
            "whole-project",
            "--confidence",
            "high",
            "--action",
            "append",
            "--format",
            "json",
          ],
          cwd: fixture.tempRoot,
          stdout: {
            write() {},
          },
        }),
      /runtime-selection-ambiguous/,
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash lint --strict fails on warnings", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  let output = "";
  try {
    updatePackTrustAuthority({
      repoRoot: fixture.tempRoot,
      mutate(authority) {
        authority.high_risk_capabilities.shell_exec.allowed_packs = [
          ...new Set([...(authority.high_risk_capabilities?.shell_exec?.allowed_packs ?? []), "pairslash-plan"]),
        ].sort();
        return authority;
      },
    });
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

test("pairslash memory write-global --apply is blocked when no preview artifact exists", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-write-global"] });
  let output = "";
  try {
    seedMemoryIndex(fixture.tempRoot);
    const exitCode = await runCli({
      argv: ["memory", "write-global", ...buildMemoryWriteArgs(["--apply", "--format", "json"])],
      cwd: fixture.tempRoot,
      stdout: {
        isTTY: false,
        write(chunk) {
          output += chunk;
        },
      },
      stdin: {
        isTTY: false,
      },
    });
    assert.equal(exitCode, 1);
    const payload = JSON.parse(output);
    assert.equal(payload.status, "denied");
    assert.ok(payload.errors.some((entry) => entry.startsWith("preview-required:")));
  } finally {
    fixture.cleanup();
  }
});

test("pairslash memory write-global requires explicit confirmation after a preview artifact exists", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-write-global"] });
  try {
    seedMemoryIndex(fixture.tempRoot);
    await runCli({
      argv: ["preview", "memory-write-global", ...buildMemoryWriteArgs(["--format", "json"])],
      cwd: fixture.tempRoot,
      stdout: {
        write() {},
      },
    });
    await assert.rejects(
      () =>
        runCli({
          argv: ["memory", "write-global", ...buildMemoryWriteArgs(["--apply"])],
          cwd: fixture.tempRoot,
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
    fixture.cleanup();
  }
});

test("pairslash memory write-global commits with --apply --yes after preview", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-write-global"] });
  let output = "";
  try {
    seedMemoryIndex(fixture.tempRoot);
    await runCli({
      argv: ["preview", "memory-write-global", ...buildMemoryWriteArgs(["--format", "json"])],
      cwd: fixture.tempRoot,
      stdout: {
        write() {},
      },
    });
    const exitCode = await runCli({
      argv: ["memory", "write-global", ...buildMemoryWriteArgs(["--apply", "--yes", "--format", "json"])],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
        isTTY: true,
      },
      stdin: {
        isTTY: true,
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.equal(payload.status, "committed");
    assert.equal(
      existsSync(join(fixture.tempRoot, ".pairslash", "project-memory", "50-constraints.yaml")),
      true,
    );
  } finally {
    fixture.cleanup();
  }
});

test("pairslash memory candidate emits schema-valid reconciliation report without mutating project-memory", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-candidate"] });
  let output = "";
  try {
    mkdirSync(join(fixture.tempRoot, ".pairslash", "project-memory"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "task-memory"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "sessions"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "staging"), { recursive: true });

    const globalPath = join(fixture.tempRoot, ".pairslash", "project-memory", "50-constraints.yaml");
    const globalRecords = [
      {
        kind: "constraint",
        title: "Candidate duplicate should match global",
        statement: "Global duplicate statement.",
        evidence: "global-evidence",
        scope: "whole-project",
        confidence: "high",
        action: "append",
        tags: [],
        source_refs: [],
        updated_by: "tests",
        timestamp: "2026-04-07T01:00:00.000Z",
      },
      {
        kind: "constraint",
        title: "Candidate conflict needs supersede",
        statement: "Global conflict baseline.",
        evidence: "global-evidence",
        scope: "whole-project",
        confidence: "high",
        action: "append",
        tags: [],
        source_refs: [],
        updated_by: "tests",
        timestamp: "2026-04-07T01:00:00.000Z",
      },
    ];
    writeFileSync(
      globalPath,
      `${globalRecords.map((record) => YAML.stringify(record, { lineWidth: 0, simpleKeys: true }).trimEnd()).join("\n---\n")}\n`,
    );
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "project-memory", "90-memory-index.yaml"),
      YAML.stringify(
        {
          version: "0.1.0",
          last_updated: "2026-04-07T01:00:00.000Z",
          updated_by: "tests",
          records: [
            {
              file: "50-constraints.yaml",
              kind: "constraint",
              title: "Candidate duplicate should match global",
              scope: "whole-project",
              status: "active",
              record_family: "mutable",
            },
            {
              file: "50-constraints.yaml",
              kind: "constraint",
              title: "Candidate conflict needs supersede",
              scope: "whole-project",
              status: "active",
              record_family: "mutable",
            },
          ],
        },
        { lineWidth: 0, simpleKeys: true },
      ),
    );
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "task-memory", "candidate-input.yaml"),
      [
        "kind: constraint",
        "title: Candidate duplicate should match global",
        "statement: Global duplicate statement.",
        "evidence: task evidence duplicate",
        "scope: whole-project",
        "---",
        "kind: constraint",
        "title: Candidate conflict needs supersede",
        "statement: Task statement conflicts with global baseline.",
        "evidence: task evidence conflict",
        "scope: whole-project",
      ].join("\n"),
    );
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "sessions", "session-candidate.yaml"),
      [
        "kind: decision",
        "title: Session-only candidate",
        "statement: Session signal can become a candidate when global has no claim.",
        "evidence: session evidence",
        "scope: subsystem",
        "scope_detail: memory-candidate",
      ].join("\n"),
    );
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "staging", "candidate-preview.yaml"),
      [
        "kind: memory-write-staging-artifact",
        "schema_version: 1.0.0",
        "runtime: codex_cli",
        "target: repo",
        "artifact_id: demo",
        "request_key: demo",
        "content_fingerprint: demo",
        "path: .pairslash/staging/candidate-preview.yaml",
        "request:",
        "  kind: memory-write-request",
        "  schema_version: 1.0.0",
        "  runtime: codex_cli",
        "  target: repo",
        "  request_source: cli",
        "  record:",
        "    kind: pattern",
        "    title: Staging candidate pattern",
        "    statement: Staging candidate pending reconciliation.",
        "    evidence: staging evidence",
        "    scope: subsystem",
        "    scope_detail: staging-candidate",
        "    confidence: medium",
        "    action: append",
        "    tags: []",
        "    source_refs: []",
        "    updated_by: tests",
        "    timestamp: 2026-04-07T01:00:00.000Z",
      ].join("\n"),
    );

    const beforeGlobal = readFileSync(globalPath, "utf8");
    const indexPath = join(fixture.tempRoot, ".pairslash", "project-memory", "90-memory-index.yaml");
    const beforeIndex = readFileSync(indexPath, "utf8");
    const exitCode = await runCli({
      argv: ["memory", "candidate", ...buildMemoryCandidateArgs(["--format", "json"])],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.deepEqual(validateCandidateReport(payload), []);
    assert.equal(payload.kind, "memory-candidate-report");
    assert.equal(payload.read_only, true);
    assert.equal(payload.runtime, "codex_cli");
    assert.deepEqual(payload.precedence_rule.slice(0, 4), [
      "global-project-memory",
      "task-memory",
      "session",
      "staging",
    ]);
    const duplicate = payload.candidates.find((entry) => entry.title === "Candidate duplicate should match global");
    assert.ok(duplicate);
    assert.equal(duplicate.suspicion.duplicate, true);
    assert.equal(duplicate.suspicion.conflict, false);
    assert.equal(duplicate.classification, "duplicate-existing");
    assert.equal(duplicate.matched_global_record.layer, "global-project-memory");
    const conflict = payload.candidates.find((entry) => entry.title === "Candidate conflict needs supersede");
    assert.ok(conflict);
    assert.equal(conflict.suspicion.conflict, true);
    assert.equal(conflict.classification, "needs-supersede-review");
    assert.equal(conflict.matched_global_record.layer, "global-project-memory");
    assert.ok(payload.reconciliation.duplicates_found.includes(duplicate.id));
    assert.ok(payload.reconciliation.conflicts_found.includes(conflict.id));
    assert.equal(readFileSync(globalPath, "utf8"), beforeGlobal);
    assert.equal(readFileSync(indexPath, "utf8"), beforeIndex);
  } finally {
    fixture.cleanup();
  }
});

test("pairslash memory candidate fails clearly when task scope is missing", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-candidate"] });
  try {
    await assert.rejects(
      () =>
        runCli({
          argv: ["memory", "candidate", "--runtime", "codex", "--format", "json"],
          cwd: fixture.tempRoot,
          stdout: {
            write() {},
          },
        }),
      /candidate-input-missing: --task-scope is required/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("pairslash memory candidate fails clearly when task/session/staging context is empty", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-candidate"] });
  try {
    mkdirSync(join(fixture.tempRoot, ".pairslash", "task-memory"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "sessions"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "staging"), { recursive: true });
    await assert.rejects(
      () =>
        runCli({
          argv: ["memory", "candidate", ...buildMemoryCandidateArgs(["--format", "json"])],
          cwd: fixture.tempRoot,
          stdout: {
            write() {},
          },
        }),
      /candidate-context-insufficient: no candidate records found in task-memory\/session\/staging/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("pairslash memory candidate fails clearly when source records are malformed", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-candidate"] });
  try {
    mkdirSync(join(fixture.tempRoot, ".pairslash", "task-memory"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "sessions"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "staging"), { recursive: true });
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "task-memory", "malformed.yaml"),
      [
        "kind: constraint",
        "title: malformed-without-statement",
        "evidence: task evidence",
        "scope: whole-project",
      ].join("\n"),
    );
    await assert.rejects(
      () =>
        runCli({
          argv: ["memory", "candidate", ...buildMemoryCandidateArgs(["--format", "json"])],
          cwd: fixture.tempRoot,
          stdout: {
            write() {},
          },
        }),
      /candidate-context-insufficient: no candidate records found in task-memory\/session\/staging/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("pairslash memory audit emits schema-valid read-only report with shared-loader conflict surfacing", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-audit"] });
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    mkdirSync(join(fixture.tempRoot, ".pairslash", "task-memory"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "audit-log"), { recursive: true });
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "task-memory", "task-conflict.yaml"),
      [
        "kind: constraint",
        "title: Codex CLI read-only sandbox blocks complex PowerShell patterns",
        "statement: task-memory contradicts the authoritative global claim",
        "evidence: task audit evidence",
        "scope: subsystem",
        "scope_detail: codex-cli",
      ].join("\n"),
    );
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "audit-log", "audit-conflict.yaml"),
      [
        "kind: constraint",
        "title: Codex CLI read-only sandbox blocks complex PowerShell patterns",
        "statement: audit-log contradicts the authoritative global claim",
        "evidence: audit log evidence",
        "scope: subsystem",
        "scope_detail: codex-cli",
      ].join("\n"),
    );

    const globalPath = join(fixture.tempRoot, ".pairslash", "project-memory", "50-constraints.yaml");
    const indexPath = join(fixture.tempRoot, ".pairslash", "project-memory", "90-memory-index.yaml");
    const auditPath = join(fixture.tempRoot, ".pairslash", "audit-log", "audit-conflict.yaml");
    const beforeGlobal = readFileSync(globalPath, "utf8");
    const beforeIndex = readFileSync(indexPath, "utf8");
    const beforeAudit = readFileSync(auditPath, "utf8");

    const exitCode = await runCli({
      argv: ["memory", "audit", ...buildMemoryAuditArgs(["--format", "json"])],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.deepEqual(validateMemoryAuditReport(payload), []);
    assert.equal(payload.kind, "memory-audit-report");
    assert.equal(payload.read_only, true);
    assert.equal(payload.read_profile_id, "pairslash-memory-audit");
    assert.equal(payload.resolution.uses_shared_loader, true);
    assert.deepEqual(payload.precedence_rule.slice(0, 5), [
      "global-project-memory",
      "task-memory",
      "session",
      "staging",
      "audit-log",
    ]);
    assert.ok(
      payload.findings.some(
        (finding) =>
          finding.type === "conflict" &&
          finding.selected_layer === "global-project-memory" &&
          finding.shadowed_layer === "task-memory",
      ),
    );
    assert.ok(
      payload.findings.some(
        (finding) =>
          finding.type === "conflict" &&
          finding.selected_layer === "global-project-memory" &&
          finding.shadowed_layer === "audit-log",
      ),
    );
    assert.equal(payload.summary.hard_conflict_count >= 2, true);
    assert.equal(payload.next_action, "USE_PAIRSLASH_MEMORY_WRITE_GLOBAL");
    assert.equal(readFileSync(globalPath, "utf8"), beforeGlobal);
    assert.equal(readFileSync(indexPath, "utf8"), beforeIndex);
    assert.equal(readFileSync(auditPath, "utf8"), beforeAudit);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash memory audit fails clearly when audit scope is missing", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-audit"] });
  try {
    await assert.rejects(
      () =>
        runCli({
          argv: ["memory", "audit", "--runtime", "codex", "--format", "json"],
          cwd: fixture.tempRoot,
          stdout: {
            write() {},
          },
        }),
      /audit-input-invalid: --audit-scope must be one of full, project-memory-only, index-only/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("pairslash explain-context keeps read-authority resolution consistent across codex and copilot lanes", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-candidate"] });
  const runtime = installFakeRuntime({ codexVersion: "0.116.0", copilotVersion: "2.50.0" });
  let codexOutput = "";
  let copilotOutput = "";
  try {
    mkdirSync(join(fixture.tempRoot, ".pairslash", "task-memory"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "sessions"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "staging"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "audit-log"), { recursive: true });
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "task-memory", "override.yaml"),
      [
        "kind: constraint",
        "title: Codex CLI read-only sandbox blocks complex PowerShell patterns",
        "statement: task conflict for cross-runtime parity check",
        "evidence: task parity evidence",
        "scope: subsystem",
        "scope_detail: codex-cli",
      ].join("\n"),
    );
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "sessions", "override.yaml"),
      [
        "kind: constraint",
        "title: Codex CLI read-only sandbox blocks complex PowerShell patterns",
        "statement: session conflict for cross-runtime parity check",
        "evidence: session parity evidence",
        "scope: subsystem",
        "scope_detail: codex-cli",
      ].join("\n"),
    );
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "staging", "override.yaml"),
      [
        "kind: constraint",
        "title: Codex CLI read-only sandbox blocks complex PowerShell patterns",
        "statement: staging conflict for cross-runtime parity check",
        "evidence: staging parity evidence",
        "scope: subsystem",
        "scope_detail: codex-cli",
      ].join("\n"),
    );
    writeFileSync(join(fixture.tempRoot, ".pairslash", "audit-log", "audit.jsonl"), "{\"kind\":\"memory-write-log\"}\n");

    const codexExit = await runCli({
      argv: ["explain-context", "pairslash-memory-candidate", "--runtime", "codex", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          codexOutput += chunk;
        },
      },
    });
    const copilotExit = await runCli({
      argv: ["explain-context", "pairslash-memory-candidate", "--runtime", "copilot", "--target", "user", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          copilotOutput += chunk;
        },
      },
    });
    assert.equal(codexExit, 0);
    assert.equal(copilotExit, 0);

    const codexPayload = JSON.parse(codexOutput);
    const copilotPayload = JSON.parse(copilotOutput);
    const summarize = (payload) => {
      const claim = payload.memory_resolution.record_resolution.resolved_claims.find(
        (entry) =>
          entry.kind === "constraint" &&
          entry.title === "Codex CLI read-only sandbox blocks complex PowerShell patterns",
      );
      const conflictLayers = payload.memory_resolution.record_resolution.conflicts
        .filter((entry) => entry.claim_key === claim.claim_key)
        .map((entry) => entry.shadowed_layer)
        .sort((left, right) => left.localeCompare(right));
      return {
        profile: payload.memory_resolution.profile_id,
        precedence: payload.memory_resolution.record_resolution.precedence_rule.slice(0, 5),
        selected_layer: claim.selected.layer,
        selected_authority: claim.selected.authority,
        conflict_layers: conflictLayers,
      };
    };

    assert.equal(codexPayload.runtime, "codex_cli");
    assert.equal(copilotPayload.runtime, "copilot_cli");
    assert.deepEqual(summarize(codexPayload), summarize(copilotPayload));
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("authoritative read-path journey surfaces session conflict and keeps read workflows non-mutating", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-candidate"] });
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let candidateOutput = "";
  let explanationOutput = "";
  try {
    mkdirSync(join(fixture.tempRoot, ".pairslash", "task-memory"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "sessions"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "staging"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "audit-log"), { recursive: true });
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "task-memory", "candidate.yaml"),
      [
        "kind: constraint",
        "title: Codex CLI read-only sandbox blocks complex PowerShell patterns",
        "statement: task conflict for read-path journey",
        "evidence: task journey evidence",
        "scope: subsystem",
        "scope_detail: codex-cli",
      ].join("\n"),
    );
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "sessions", "session-conflict.yaml"),
      [
        "kind: constraint",
        "title: Codex CLI read-only sandbox blocks complex PowerShell patterns",
        "statement: session conflict for read-path journey",
        "evidence: session journey evidence",
        "scope: subsystem",
        "scope_detail: codex-cli",
      ].join("\n"),
    );
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "staging", "journey.yaml"),
      [
        "kind: pattern",
        "title: Journey staging candidate",
        "statement: staging candidate remains read-only until explicit write workflow",
        "evidence: staging journey evidence",
        "scope: subsystem",
        "scope_detail: journey",
      ].join("\n"),
    );
    writeFileSync(join(fixture.tempRoot, ".pairslash", "audit-log", "journey.log"), "baseline-audit\n");

    const globalPath = join(fixture.tempRoot, ".pairslash", "project-memory", "50-constraints.yaml");
    const indexPath = join(fixture.tempRoot, ".pairslash", "project-memory", "90-memory-index.yaml");
    const stagingRoot = join(fixture.tempRoot, ".pairslash", "staging");
    const auditPath = join(fixture.tempRoot, ".pairslash", "audit-log", "journey.log");
    const beforeGlobal = readFileSync(globalPath, "utf8");
    const beforeIndex = readFileSync(indexPath, "utf8");
    const beforeAudit = readFileSync(auditPath, "utf8");
    const beforeStaging = readdirSync(stagingRoot).sort((left, right) => left.localeCompare(right));

    const candidateExit = await runCli({
      argv: ["memory", "candidate", ...buildMemoryCandidateArgs(["--format", "json"])],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          candidateOutput += chunk;
        },
      },
    });
    assert.equal(candidateExit, 0);
    const candidatePayload = JSON.parse(candidateOutput);
    assert.deepEqual(validateCandidateReport(candidatePayload), []);
    assert.equal(candidatePayload.read_only, true);
    assert.equal(candidatePayload.next_action, "USE_PAIRSLASH_MEMORY_WRITE_GLOBAL");
    assert.ok(
      candidatePayload.candidates.some(
        (entry) =>
          entry.title === "Codex CLI read-only sandbox blocks complex PowerShell patterns" &&
          entry.suspicion.conflict,
      ),
    );

    const explainExit = await runCli({
      argv: ["explain-context", "pairslash-memory-candidate", "--runtime", "codex", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          explanationOutput += chunk;
        },
      },
    });
    assert.equal(explainExit, 0);
    const explanationPayload = JSON.parse(explanationOutput);
    const resolvedClaim = explanationPayload.memory_resolution.record_resolution.resolved_claims.find(
      (entry) =>
        entry.kind === "constraint" &&
        entry.title === "Codex CLI read-only sandbox blocks complex PowerShell patterns",
    );
    assert.equal(resolvedClaim.selected.layer, "global-project-memory");
    assert.equal(resolvedClaim.selected.authority, "authoritative");
    assert.ok(
      explanationPayload.memory_resolution.record_resolution.conflicts.some(
        (entry) =>
          entry.claim_key === resolvedClaim.claim_key &&
          entry.selected_layer === "global-project-memory" &&
          entry.shadowed_layer === "session",
      ),
    );
    assert.deepEqual(
      explanationPayload.memory_resolution.record_resolution.precedence_rule.slice(0, 4),
      ["global-project-memory", "task-memory", "session", "staging"],
    );

    assert.equal(readFileSync(globalPath, "utf8"), beforeGlobal);
    assert.equal(readFileSync(indexPath, "utf8"), beforeIndex);
    assert.equal(readFileSync(auditPath, "utf8"), beforeAudit);
    assert.deepEqual(readdirSync(stagingRoot).sort((left, right) => left.localeCompare(right)), beforeStaging);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash explain-context emits structured json report", serial, async () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    mkdirSync(join(fixture.tempRoot, ".pairslash", "project-memory"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "task-memory"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "sessions"), { recursive: true });
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "project-memory", "50-constraints.yaml"),
      "kind: constraint\ntitle: preview-contract\n",
    );
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "task-memory", "task.yaml"),
      "kind: decision\ntitle: task-only-candidate\n",
    );
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "sessions", "session-note.yaml"),
      "kind: note\ntitle: session\n",
    );
    const exitCode = await runCli({
      argv: ["explain-context", "pairslash-plan", "--runtime", "codex", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.equal(payload.kind, "context-explanation");
    assert.equal(payload.runtime, "codex_cli");
    assert.equal(payload.pack_id, "pairslash-plan");
    assert.equal(payload.telemetry_mode, "off");
    assert.equal(payload.schema_version, "1.1.0");
    assert.ok(payload.memory_reads.global_project_memory.includes(".pairslash/project-memory/50-constraints.yaml"));
    assert.ok(payload.memory_reads.task_memory.includes(".pairslash/task-memory/task.yaml"));
    assert.deepEqual(payload.memory_reads.session_artifacts, []);
    assert.deepEqual(payload.memory_reads.session_layer, []);
    assert.deepEqual(payload.memory_reads.staging_artifacts, []);
    assert.deepEqual(payload.memory_reads.audit_log, []);
    assert.equal(payload.memory_resolution.profile_id, "pairslash-plan");
    assert.equal(payload.memory_resolution.uses_shared_loader, true);
    assert.ok(payload.memory_resolution.authoritative_sources.includes(".pairslash/project-memory/90-memory-index.yaml"));
    assert.deepEqual(payload.memory_resolution.record_resolution.precedence_rule.slice(0, 2), [
      "global-project-memory",
      "task-memory",
    ]);
    assert.ok(payload.memory_resolution.record_resolution.resolved_claims.length > 0);
    const globalLayer = payload.memory_resolution.layers.find((layer) => layer.layer === "global-project-memory");
    assert.equal(globalLayer.resolution_mode, "explicit-paths");
    assert.equal(globalLayer.resolution_status, "resolved");
    assert.ok(globalLayer.resolved_paths.includes(".pairslash/project-memory/50-constraints.yaml"));
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash explain-context resolves candidate read authority with authoritative and supporting layers", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan", "pairslash-memory-candidate"] });
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    mkdirSync(join(fixture.tempRoot, ".pairslash", "task-memory"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "sessions"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "staging"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "audit-log"), { recursive: true });
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "task-memory", "task.yaml"),
      "kind: decision\ntitle: task-only-candidate\n",
    );
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "task-memory", "override.yaml"),
      [
        "kind: constraint",
        "title: Codex CLI read-only sandbox blocks complex PowerShell patterns",
        "statement: task override should stay shadowed",
        "scope: subsystem",
        "scope_detail: codex-cli",
      ].join("\n"),
    );
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "sessions", "session-note.yaml"),
      "kind: note\ntitle: session\n",
    );
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "staging", "candidate-preview.yaml"),
      "kind: constraint\ntitle: preview\n",
    );
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "audit-log", "audit.jsonl"),
      "{\"kind\":\"memory-write-log\"}\n",
    );
    const exitCode = await runCli({
      argv: ["explain-context", "pairslash-memory-candidate", "--runtime", "codex", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.equal(payload.pack_id, "pairslash-memory-candidate");
    assert.equal(payload.memory_resolution.profile_id, "pairslash-memory-candidate");
    assert.ok(payload.memory_resolution.authoritative_sources.includes(".pairslash/project-memory/90-memory-index.yaml"));
    assert.ok(payload.memory_resolution.authoritative_sources.includes(".pairslash/project-memory/50-constraints.yaml"));
    assert.deepEqual(payload.memory_resolution.record_resolution.precedence_rule.slice(0, 4), [
      "global-project-memory",
      "task-memory",
      "session",
      "staging",
    ]);
    assert.ok(payload.memory_reads.task_memory.includes(".pairslash/task-memory/task.yaml"));
    assert.ok(payload.memory_reads.session_artifacts.includes(".pairslash/sessions/session-note.yaml"));
    assert.ok(payload.memory_reads.session_artifacts.includes(".pairslash/staging/candidate-preview.yaml"));
    assert.deepEqual(payload.memory_reads.session_layer, [".pairslash/sessions/session-note.yaml"]);
    assert.deepEqual(payload.memory_reads.staging_artifacts, [".pairslash/staging/candidate-preview.yaml"]);
    assert.deepEqual(payload.memory_reads.audit_log, [".pairslash/audit-log/audit.jsonl"]);
    const auditLayer = payload.memory_resolution.layers.find((layer) => layer.layer === "audit-log");
    const globalLayer = payload.memory_resolution.layers.find((layer) => layer.layer === "global-project-memory");
    const sessionLayer = payload.memory_resolution.layers.find((layer) => layer.layer === "session");
    assert.equal(globalLayer.resolution_mode, "project-memory-index");
    assert.equal(globalLayer.resolution_status, "resolved");
    assert.ok(globalLayer.precedence < sessionLayer.precedence);
    assert.ok(globalLayer.resolved_records.length > 0);
    assert.ok(auditLayer.resolved_paths.includes(".pairslash/audit-log/audit.jsonl"));
    const overriddenClaim = payload.memory_resolution.record_resolution.resolved_claims.find(
      (claim) =>
        claim.kind === "constraint" &&
        claim.title === "Codex CLI read-only sandbox blocks complex PowerShell patterns",
    );
    assert.equal(overriddenClaim.selected.layer, "global-project-memory");
    assert.ok(
      overriddenClaim.shadowed.some((entry) => entry.layer === "task-memory"),
    );
    assert.ok(
      payload.memory_resolution.record_resolution.conflicts.some(
        (entry) =>
          entry.claim_key === overriddenClaim.claim_key &&
          entry.selected_layer === "global-project-memory" &&
          entry.shadowed_layer === "task-memory",
      ),
    );
    const taskOnlyClaim = payload.memory_resolution.record_resolution.resolved_claims.find(
      (claim) => claim.title === "task-only-candidate",
    );
    assert.equal(taskOnlyClaim.selected.layer, "task-memory");
    assert.equal(taskOnlyClaim.selected.authority, "supporting");
    assert.equal(taskOnlyClaim.resolution_type, "supporting-gap-fill");
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash explain-context emits runtime host probe event", serial, async () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    await runCli({
      argv: ["explain-context", "pairslash-plan", "--runtime", "codex", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write() {},
      },
    });
    const session = listTraceIndexes(fixture.tempRoot)
      .filter((index) => index.command_name === "explain-context")
      .sort((left, right) => (right.started_at ?? "").localeCompare(left.started_at ?? ""))[0];
    assert.ok(session);
    const events = loadTraceEvents({
      repoRoot: fixture.tempRoot,
      sessionId: session.session_id,
    });
    assert.ok(events.some((event) => event.event_type === "runtime.host_probed"));
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash explain-policy emits preview requirement for memory write apply", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-write-global"] });
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    const exitCode = await runCli({
      argv: [
        "explain-policy",
        "pairslash-memory-write-global",
        "--runtime",
        "codex",
        "--apply",
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
    assert.equal(payload.kind, "policy-explanation");
    assert.equal(payload.runtime, "codex_cli");
    assert.equal(payload.preview_required, true);
    assert.equal(payload.overall_verdict, "require-preview");
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash debug emits latest prior session report", serial, async () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    await runCli({
      argv: ["doctor", "--runtime", "codex", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: { write() {} },
    });
    const exitCode = await runCli({
      argv: ["debug", "--latest", "--runtime", "codex", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.equal(payload.kind, "debug-report");
    assert.equal(payload.command_name, "doctor");
    assert.ok(Array.isArray(payload.timeline));
    assert.ok(payload.timeline.length > 0);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash trace export can emit support bundle", serial, async () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    await runCli({
      argv: ["doctor", "--runtime", "codex", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: { write() {} },
    });
    const exitCode = await runCli({
      argv: [
        "trace",
        "export",
        "--latest",
        "--runtime",
        "codex",
        "--support-bundle",
        "--include-doctor",
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
    assert.equal(payload.trace_export.kind, "trace-export");
    assert.equal(payload.support_bundle.kind, "support-bundle");
    assert.ok(existsSync(join(payload.trace_export.output_dir, "manifest.json")));
    assert.ok(existsSync(join(payload.support_bundle.output_dir, "bundle-manifest.json")));
    assert.ok(payload.support_bundle.debug_report_path);
    assert.ok(existsSync(payload.support_bundle.debug_report_path));
    assert.ok(payload.support_bundle.doctor_report_path);
    assert.ok(existsSync(payload.support_bundle.doctor_report_path));
    assert.ok(payload.support_bundle.issue_template_path);
    assert.ok(existsSync(payload.support_bundle.issue_template_path));
    assert.equal(payload.support_bundle.privacy_descriptor.local_only_by_default, true);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("pairslash telemetry summary derives local metrics from trace sessions", serial, async () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    await runCli({
      argv: ["doctor", "--runtime", "codex", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: { write() {} },
    });
    await runCli({
      argv: [
        "trace",
        "export",
        "--latest",
        "--runtime",
        "codex",
        "--support-bundle",
        "--include-doctor",
        "--format",
        "json",
      ],
      cwd: fixture.tempRoot,
      stdout: { write() {} },
    });
    const exitCode = await runCli({
      argv: ["telemetry", "summary", "--runtime", "codex", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.equal(payload.kind, "telemetry-summary");
    assert.ok(payload.totals.sessions >= 2);
    assert.ok(payload.totals.support_bundle_exports >= 1);
    assert.ok(payload.workflows.some((workflow) => workflow.workflow_key === "doctor"));
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});
