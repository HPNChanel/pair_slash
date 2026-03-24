import test from "node:test";
import assert from "node:assert/strict";

import { runLintBridge } from "../src/index.js";
import { createTempRepo, updatePackManifest } from "../../../tests/phase4-helpers.js";

const serial = { concurrency: false };

test("lint bridge passes for a valid core pack", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "all",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.kind, "lint-report");
    assert.equal(report.ok, true);
    assert.equal(report.summary.error_count, 0);
    assert.equal(report.runtime_scope, "all");
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge reports runtime range parse errors", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.supported_runtime_ranges.codex_cli = "latest";
        return manifest;
      },
    });
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "codex",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) => issue.code === "LINT-RUNTIME-001" && issue.result === "error"),
    );
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge emits warning when shell_exec is declared without required_tools", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
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
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "codex",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.summary.error_count, 0);
    assert.ok(
      report.issues.some((issue) => issue.code === "LINT-TOOLS-002" && issue.result === "warning"),
    );
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge fails when compiler preconditions are broken", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.assets.include = [...manifest.assets.include, "missing-file.md"].sort((a, b) => a.localeCompare(b));
        return manifest;
      },
    });
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "codex",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) => issue.code === "LINT-DET-001" && issue.result === "error"),
    );
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge catches duplicate pack identity across manifests", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan", "pairslash-review"] });
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
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "all",
      target: "repo",
      packs: [],
    });
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) => issue.code === "LINT-ASSET-002" && issue.result === "error"),
    );
  } finally {
    fixture.cleanup();
  }
});
