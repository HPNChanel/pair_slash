import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

import { buildContractEnvelope } from "@pairslash/contract-engine";
import { runLintBridge } from "../src/index.js";
import { createTempRepo, updatePackManifest } from "../../../../tests/phase4-helpers.js";

const serial = { concurrency: false };

function hasIssue(report, code, result = "error") {
  return report.issues.some((issue) => issue.code === code && issue.result === result);
}

function updatePackageJsonFile(repoRoot, relativePath, mutate) {
  const filePath = join(repoRoot, relativePath);
  const payload = JSON.parse(readFileSync(filePath, "utf8"));
  mutate(payload);
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function updateTrustDescriptor(repoRoot, packId, mutate) {
  const filePath = join(repoRoot, "packs", "core", packId, "pack.trust.yaml");
  const payload = YAML.parse(readFileSync(filePath, "utf8"));
  const updated = mutate(payload) ?? payload;
  writeFileSync(filePath, YAML.stringify(updated, { lineWidth: 0, simpleKeys: true }));
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

test("lint bridge treats missing pack trust descriptor as non-blocking when manifest support is authoritative", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        delete manifest.trust_descriptor;
        return manifest;
      },
    });
    unlinkSync(join(fixture.tempRoot, "packs", "core", "pairslash-plan", "pack.trust.yaml"));

    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "codex",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.ok, true);
    assert.equal(hasIssue(report, "LINT-TRUST-001", "error"), false);
    assert.equal(
      report.issues.some(
        (issue) =>
          issue.code === "LINT-TRUST-003" &&
          issue.result === "warning" &&
          issue.message.includes("shared matrix evidence"),
      ),
      true,
    );
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge warns when pack trust descriptor shim drifts from authoritative manifest support", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updateTrustDescriptor(fixture.tempRoot, "pairslash-plan", (descriptor) => {
      delete descriptor.runtime_support.codex_cli.evidence_ref;
      return descriptor;
    });

    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "codex",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.ok, true);
    assert.ok(
      report.issues.some(
        (issue) =>
          issue.code === "LINT-TRUST-003" &&
          issue.result === "warning" &&
          issue.message.includes("runtime_support.codex_cli.evidence_ref"),
      ),
    );
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge fails when workflow maturity exceeds the evidence ceiling", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.support.workflow_maturity = "preview";
        manifest.support.workflow_transition.from = "canary";
        manifest.support.workflow_transition.reason = "lint-overclaim-check";
        manifest.support.workflow_evidence.live_workflow_refs.codex_cli = [
          "docs/evidence/live-runtime/codex-cli-repo-macos.md",
        ];
        manifest.support.workflow_evidence.live_workflow_refs.copilot_cli = [
          "docs/evidence/live-runtime/copilot-cli-user-linux.md",
        ];
        manifest.support.promotion_checklist.required_for_label = "preview";
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
    assert.ok(
      report.issues.some(
        (issue) =>
          issue.code === "LINT-TRUST-004" &&
          issue.result === "error" &&
          issue.message.includes("workflow maturity preview exceeds effective evidence-backed level canary"),
      ),
    );
    assert.ok(
      report.issues.some(
        (issue) =>
          issue.code === "LINT-TRUST-004" &&
          issue.message.includes("workflow-maturity-pack-runtime-live-required:codex_cli:lane-matrix"),
      ),
    );
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge errors when manifest support claim exceeds blocked runtime surface", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.runtime_bindings.copilot_cli.compatibility.canonical_picker = "blocked";
        manifest.runtime_bindings.copilot_cli.compatibility.direct_invocation = "blocked";
        manifest.runtime_targets.copilot_cli.compatibility.canonical_picker = "blocked";
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
    assert.ok(
      report.issues.some(
        (issue) =>
          issue.code === "LINT-MANIFEST-001" &&
          issue.result === "error" &&
          issue.message.includes("support.runtime_support.copilot_cli.status cannot exceed blocked manifest runtime surface"),
      ),
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

test("lint bridge warns when unverified runtime surfaces are missing evidence records", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.support.runtime_support.copilot_cli.status = "unverified";
        manifest.support.runtime_support.copilot_cli.evidence_ref = null;
        return manifest;
      },
    });
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "all",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.ok, true);
    assert.ok(
      report.issues.some(
        (issue) =>
          issue.code === "LINT-RUNTIME-006" &&
          issue.result === "warning" &&
          issue.message.includes("copilot_cli.direct_invocation"),
      ),
    );
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

test("lint bridge blocks core packages from depending on runtime packages", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackageJsonFile(fixture.tempRoot, "packages/core/spec-core/package.json", (pkg) => {
      pkg.dependencies = {
        ...(pkg.dependencies ?? {}),
        "@pairslash/runtime-codex-adapter": "file:../../runtimes/codex/adapter",
      };
    });
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "all",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.ok, false);
    assert.equal(hasIssue(report, "LINT-BOUNDARY-001"), true);
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge blocks codex runtime packages from depending on copilot runtime packages", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackageJsonFile(fixture.tempRoot, "packages/runtimes/codex/compiler/package.json", (pkg) => {
      pkg.dependencies = {
        ...(pkg.dependencies ?? {}),
        "@pairslash/runtime-copilot-adapter": "file:../../copilot/adapter",
      };
    });
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "all",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.ok, false);
    assert.equal(hasIssue(report, "LINT-BOUNDARY-001"), true);
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge blocks hidden cross-package relative imports", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    const filePath = join(
      fixture.tempRoot,
      "packages",
      "core",
      "spec-core",
      "src",
      "hidden-cross-package-import.js",
    );
    writeFileSync(
      filePath,
      'export { buildRuntimeSupport } from "../../../runtimes/codex/adapter/src/index.js";\n',
    );
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "all",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.ok, false);
    assert.equal(hasIssue(report, "LINT-BOUNDARY-002"), true);
  } finally {
    fixture.cleanup();
  }
});
