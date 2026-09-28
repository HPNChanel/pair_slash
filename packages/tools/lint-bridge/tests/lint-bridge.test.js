import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

import { buildContractEnvelope } from "@pairslash/contract-engine";
import { runLintBridge } from "../src/index.ts";
import {
  createTempRepo,
  updatePackManifest,
  updatePackTrustAuthority,
} from "../../../../tests/phase4-helpers.js";

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
          "docs/evidence/live-runtime/codex-cli-repo-macos.yaml",
        ];
        manifest.support.workflow_evidence.live_workflow_refs.copilot_cli = [
          "docs/evidence/live-runtime/copilot-cli-user-linux.yaml",
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

test("lint bridge warns when runtime support includes unverified surfaces", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.support.runtime_support.copilot_cli.status = "unverified";
        manifest.support.runtime_support.copilot_cli.evidence_ref =
          "docs/compatibility/runtime-surface-matrix.yaml";
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
          issue.code === "LINT-RUNTIME-004" &&
          issue.result === "warning",
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

function enableMcpServers(manifest, servers) {
  manifest.capabilities = [...new Set([...(manifest.capabilities ?? []), "mcp_client"])];
  manifest.required_mcp_servers = servers;
  return manifest;
}

function authorizeMcpClient(repoRoot) {
  updatePackTrustAuthority({
    repoRoot,
    mutate(authority) {
      authority.high_risk_capabilities.mcp_client.allowed_packs = [
        ...new Set([
          ...(authority.high_risk_capabilities?.mcp_client?.allowed_packs ?? []),
          "pairslash-plan",
        ]),
      ].sort();
      return authority;
    },
  });
}

test("lint bridge warns on legacy-era MCP declarations", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    authorizeMcpClient(fixture.tempRoot);
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        return enableMcpServers(manifest, [{ id: "filesystem", spec_era: "legacy" }]);
      },
    });
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "codex",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.ok, true);
    const issue = report.issues.find(
      (entry) => entry.code === "LINT-MCP-004" && entry.result === "warning",
    );
    assert.ok(issue);
    assert.match(issue.message, /deprecated-era/);
    assert.match(issue.remediation, /dual or modern/);
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge warns when spec_era is defaulted on an older-schema manifest", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    authorizeMcpClient(fixture.tempRoot);
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        return enableMcpServers(manifest, [{ id: "filesystem" }]);
      },
    });
    // updatePackManifest re-serializes with the era default; rewrite raw YAML to
    // simulate a pre-2.2.0 manifest that never declared spec_era.
    const manifestPath = join(
      fixture.tempRoot,
      "packs",
      "core",
      "pairslash-plan",
      "pack.manifest.yaml",
    );
    const rawManifest = YAML.parse(readFileSync(manifestPath, "utf8"));
    rawManifest.schema_version = "2.1.0";
    for (const server of rawManifest.required_mcp_servers) {
      delete server.spec_era;
    }
    writeFileSync(manifestPath, YAML.stringify(rawManifest, { lineWidth: 0, simpleKeys: true }));
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "codex",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.ok, true);
    assert.equal(hasIssue(report, "LINT-MCP-005", "warning"), true);
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge fails closed on unknown MCP spec_era values", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        return enableMcpServers(manifest, [{ id: "filesystem", spec_era: "experimental" }]);
      },
    });
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "codex",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.ok, false);
    assert.equal(hasIssue(report, "LINT-MCP-006"), true);
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge passes without MCP era issues for modern declarations", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    authorizeMcpClient(fixture.tempRoot);
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        return enableMcpServers(manifest, [
          { id: "filesystem", spec_era: "modern" },
          { id: "github", spec_era: "dual" },
        ]);
      },
    });
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "codex",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.ok, true);
    assert.equal(hasIssue(report, "LINT-MCP-004", "warning"), false);
    assert.equal(hasIssue(report, "LINT-MCP-005", "warning"), false);
    assert.equal(hasIssue(report, "LINT-MCP-006"), false);
    assert.ok(
      report.checks.some(
        (check) => check.code === "LINT-MCP-001" && check.result === "pass",
      ),
    );
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

test("lint bridge hard-errors when a write-authority pack opts into implicit invocation", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-write-global"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-memory-write-global",
      mutate(manifest) {
        manifest.implicit_invocation = "implicit-allowed";
        return manifest;
      },
    });
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "all",
      target: "repo",
      packs: ["pairslash-memory-write-global"],
    });
    assert.equal(report.ok, false);
    assert.ok(hasIssue(report, "LINT-INVOKE-001", "error"));
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge accepts implicit-allowed on a read-oriented pack with a strong description", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.implicit_invocation = "implicit-allowed";
        return manifest;
      },
    });
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "all",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.summary.error_count, 0);
    const passes = report.checks.filter(
      (check) => check.result === "pass" && check.code.startsWith("LINT-INVOKE-"),
    );
    assert.deepEqual(
      passes.map((check) => check.code).sort(),
      ["LINT-INVOKE-001", "LINT-INVOKE-002", "LINT-INVOKE-003"],
    );
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge warns when implicit-allowed is set on a dual-mode pack", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-backend"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-backend",
      mutate(manifest) {
        manifest.implicit_invocation = "implicit-allowed";
        return manifest;
      },
    });
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "all",
      target: "repo",
      packs: ["pairslash-backend"],
    });
    assert.equal(report.summary.error_count, 0);
    assert.ok(hasIssue(report, "LINT-INVOKE-002", "warning"));
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge warns when an implicit-allowed pack has a weak description", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.implicit_invocation = "implicit-allowed";
        return manifest;
      },
    });
    const skillPath = join(
      fixture.tempRoot,
      "packs",
      "core",
      "pairslash-plan",
      "SKILL.md",
    );
    const skillContent = readFileSync(skillPath, "utf8").replace(
      /^description: >-\n(?:  .*\n)+/m,
      "description: Short plan helper\n",
    );
    writeFileSync(skillPath, skillContent);
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "all",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.summary.error_count, 0);
    assert.ok(hasIssue(report, "LINT-INVOKE-003", "warning"));
  } finally {
    fixture.cleanup();
  }
});

test("lint bridge treats a missing implicit_invocation field as explicit-only", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    const manifestPath = join(
      fixture.tempRoot,
      "packs",
      "core",
      "pairslash-plan",
      "pack.manifest.yaml",
    );
    // Raw YAML write: updatePackManifest re-serializes and would restore the
    // default field, so remove it directly to cover the normalization path.
    const rawManifest = YAML.parse(readFileSync(manifestPath, "utf8"));
    delete rawManifest.implicit_invocation;
    writeFileSync(manifestPath, YAML.stringify(rawManifest, { lineWidth: 0, simpleKeys: true }));
    const report = runLintBridge({
      repoRoot: fixture.tempRoot,
      runtime: "all",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(report.summary.error_count, 0);
    assert.ok(
      report.checks.some(
        (check) =>
          check.code === "LINT-INVOKE-001" &&
          check.result === "pass" &&
          check.message.includes("explicit-only"),
      ),
    );
  } finally {
    fixture.cleanup();
  }
});
