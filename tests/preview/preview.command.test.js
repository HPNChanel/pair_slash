import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

import { runCli } from "../../packages/tools/cli/src/bin/pairslash.js";
import {
  createTempRepo,
  installFakeRuntime,
  repoRoot,
  updatePackManifest,
} from "../phase4-helpers.js";

const serial = { concurrency: false };

function seedMemoryIndex(tempRoot) {
  const indexPath = join(tempRoot, ".pairslash", "project-memory", "90-memory-index.yaml");
  mkdirSync(join(tempRoot, ".pairslash", "project-memory"), { recursive: true });
  writeFileSync(
    indexPath,
    YAML.stringify(
      {
        version: "0.1.0",
        last_updated: "2026-03-27T00:00:00.000Z",
        updated_by: "preview-tests",
        records: [],
      },
      { lineWidth: 0, simpleKeys: true },
    ),
  );
}

function readOptionalFile(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function previewFixturePath(name) {
  return join(repoRoot, "tests", "fixtures", "phase5", "preview", name);
}

test("preview install includes asset diff and stays preview-only", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    const exitCode = await runCli({
      argv: ["preview", "install", "pairslash-plan", "--runtime", "codex", "--target", "repo", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.equal(payload.kind, "preview-plan");
    assert.ok(payload.asset_diff.mutating_operation_count > 0);
    assert.ok(payload.asset_diff.runtime_targeted_outputs.length > 0);
    assert.ok(Array.isArray(payload.asset_diff.config_fragments_affected));
    assert.equal(payload.preview_boundary.no_commit_on_preview, true);
    assert.equal(
      existsSync(join(fixture.tempRoot, ".agents", "skills", "pairslash-plan")),
      false,
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("preview memory-write-global shows patch details without committing", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-write-global"] });
  let output = "";
  try {
    seedMemoryIndex(fixture.tempRoot);
    const constraintsPath = join(fixture.tempRoot, ".pairslash", "project-memory", "50-constraints.yaml");
    const beforeConstraints = readOptionalFile(constraintsPath);
    const exitCode = await runCli({
      argv: [
        "preview",
        "memory-write-global",
        "--runtime",
        "codex",
        "--target",
        "repo",
        "--request",
        previewFixturePath("memory-valid-request.yaml"),
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
    assert.equal(payload.kind, "memory-write-preview");
    assert.match(payload.preview_patch.text, /--- preview patch ---/);
    assert.match(payload.preview_patch.text, /--- end preview ---/);
    assert.equal(payload.record_disposition, "append");
    assert.equal(payload.request.record.scope, "whole-project");
    assert.equal(existsSync(join(fixture.tempRoot, payload.staging_artifact.path)), true);
    assert.equal(readOptionalFile(constraintsPath), beforeConstraints);
  } finally {
    fixture.cleanup();
  }
});

test("preview lifecycle payload includes policy verdict summary", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    const exitCode = await runCli({
      argv: ["preview", "install", "pairslash-plan", "--runtime", "codex", "--target", "repo", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.ok(["allow", "ask", "deny", "require-preview"].includes(payload.policy_summary.overall_verdict));
    assert.equal(payload.policy_summary.no_silent_fallback, true);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("preview memory-write-global is blocked for invalid source payload", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-write-global"] });
  try {
    seedMemoryIndex(fixture.tempRoot);
    const constraintsPath = join(fixture.tempRoot, ".pairslash", "project-memory", "50-constraints.yaml");
    const beforeConstraints = readOptionalFile(constraintsPath);
    let output = "";
    const exitCode = await runCli({
      argv: [
        "preview",
        "memory-write-global",
        "--runtime",
        "codex",
        "--target",
        "repo",
        "--request",
        previewFixturePath("memory-invalid-request.yaml"),
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
    assert.equal(exitCode, 1);
    const payload = JSON.parse(output);
    assert.equal(payload.kind, "memory-write-preview-blocked");
    assert.equal(payload.blocked, true);
    assert.ok(payload.errors.some((entry) => entry.includes("record.evidence")));
    assert.equal(readOptionalFile(constraintsPath), beforeConstraints);
  } finally {
    fixture.cleanup();
  }
});

test("preview install reports unsupported runtime capability explicitly with no-silent-fallback", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  let output = "";
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.runtime_bindings.copilot_cli.compatibility.direct_invocation = "blocked";
        manifest.runtime_targets.copilot_cli.compatibility.direct_invocation = "blocked";
        return manifest;
      },
    });
    const exitCode = await runCli({
      argv: ["preview", "install", "pairslash-plan", "--runtime", "codex", "--target", "repo", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 1);
    const payload = JSON.parse(output);
    assert.equal(payload.policy_summary.no_silent_fallback, true);
    assert.equal(payload.policy_summary.unsupported_runtime_capability, true);
    assert.ok(payload.policy_summary.reasons.includes("unsupported-runtime-capability:no-silent-fallback"));
    assert.equal(payload.commitability.status, "blocked");
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});
