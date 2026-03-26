import test from "node:test";
import assert from "node:assert/strict";

import { buildContractEnvelope } from "@pairslash/contract-engine";
import { runLintBridge } from "../src/index.js";
import { createTempRepo, updatePackManifest } from "../../../tests/phase4-helpers.js";

const serial = { concurrency: false };

function hasIssue(report, code, result = "error") {
  return report.issues.some((issue) => issue.code === code && issue.result === result);
}

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
      report.issues.some(
        (issue) =>
          ["LINT-RUNTIME-001", "LINT-MANIFEST-001"].includes(issue.code) &&
          issue.result === "error",
      ),
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

test("lint bridge fails when contract section is missing", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "codex",
      target: "repo",
      packs: ["pairslash-plan"],
      contractBuilder(args) {
        const contract = buildContractEnvelope(args);
        const broken = structuredClone(contract);
        delete broken.input_contract;
        return broken;
      },
    });
    assert.equal(report.ok, false);
    assert.equal(hasIssue(report, "LINT-CONTRACT-001"), true);
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge fails when runtime support marks a lane blocked", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
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
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "all",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.ok, false);
    assert.equal(hasIssue(report, "LINT-RUNTIME-004"), true);
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge fails when read workflow declares write authority", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "codex",
      target: "repo",
      packs: ["pairslash-plan"],
      contractBuilder(args) {
        const contract = buildContractEnvelope(args);
        const broken = structuredClone(contract);
        broken.memory_contract.authoritative_write_allowed = true;
        return broken;
      },
    });
    assert.equal(report.ok, false);
    assert.equal(hasIssue(report, "LINT-CONTRACT-001"), true);
    assert.ok(
      report.issues.some(
        (issue) =>
          issue.code === "LINT-CONTRACT-001" &&
          issue.message.includes("read-oriented workflow cannot declare authoritative memory write"),
      ),
    );
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge fails when write-authority workflow omits preview requirement", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-write-global"] });
  try {
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "codex",
      target: "repo",
      packs: ["pairslash-memory-write-global"],
      contractBuilder(args) {
        const contract = buildContractEnvelope(args);
        const broken = structuredClone(contract);
        broken.output_contract.allowed_side_effects_summary.preview_required = false;
        return broken;
      },
    });
    assert.equal(report.ok, false);
    assert.equal(hasIssue(report, "LINT-MEM-003"), true);
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge fails on unknown MCP dependency", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.capabilities = [...new Set([...(manifest.capabilities ?? []), "mcp_client"])];
        manifest.required_mcp_servers = [{ id: "unknown-mcp-server" }];
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
    assert.equal(hasIssue(report, "LINT-MCP-003"), true);
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge fails when no-silent-fallback metadata is missing", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "codex",
      target: "repo",
      packs: ["pairslash-plan"],
      contractBuilder(args) {
        const contract = buildContractEnvelope(args);
        const broken = structuredClone(contract);
        broken.failure_contract.no_silent_fallback = false;
        return broken;
      },
    });
    assert.equal(report.ok, false);
    assert.equal(hasIssue(report, "LINT-POLICY-003"), true);
  } finally {
    fixture.cleanup();
  }
});
