import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { compileCopilotPack, runtimeAdapter } from "@pairslash/compiler-copilot";
import { validateSkillSpec } from "@pairslash/spec-core";

import { createTempRepo, repoRoot, updatePackManifest } from "../../../../../tests/phase4-helpers.js";

test("compileCopilotPack is deterministic and runtime-native", () => {
  const manifestPath = join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml");
  const compiled = compileCopilotPack({ repoRoot, manifestPath });
  const compiledAgain = compileCopilotPack({ repoRoot, manifestPath });
  assert.equal(compiled.direct_invocation, "/pairslash-plan");
  assert.equal(compiled.runtime, "copilot_cli");
  assert.equal(compiled.bundle_kind, "copilot-package-bundle");
  assert.equal(compiled.digest, compiledAgain.digest);
  assert.ok(
    compiled.files.some(
      (file) =>
        file.asset_id === "copilot-package" &&
        file.generator === "copilot_package" &&
        file.relative_path === "package/pairslash-bundle.json",
    ),
  );
  assert.ok(
    compiled.files.some(
      (file) =>
        file.asset_id === "copilot-agent-context" &&
        file.relative_path === "agents/runtime-context.md",
    ),
  );
  const contextFile = compiled.files.find((file) => file.asset_id === "copilot-agent-context");
  assert.ok(contextFile);
  assert.equal(contextFile.content.includes("Direct invocation"), false);
  const ownershipFile = compiled.files.find((file) => file.relative_path === "pairslash.install.json");
  assert.ok(ownershipFile);
  const ownership = JSON.parse(ownershipFile.content);
  assert.equal(ownership.runtime, "copilot_cli");
  assert.ok(
    ownership.files.some(
      (file) =>
        file.asset_id === "copilot-package" &&
        file.generator === "copilot_package" &&
        file.owner === "pairslash",
    ),
  );
});

test("compileCopilotPack emits write-authority preflight hook", () => {
  const manifestPath = join(
    repoRoot,
    "packs",
    "core",
    "pairslash-memory-write-global",
    "pack.manifest.yaml",
  );
  const compiled = compileCopilotPack({ repoRoot, manifestPath });
  assert.ok(
    compiled.files.some(
      (file) => file.relative_path === "hooks/preflight.yaml" && file.write_authority_guarded,
    ),
  );
});

test("compileCopilotPack emits MCP sidecars when dependency is declared", () => {
  const fixture = createTempRepo();
  try {
    const manifestPath = updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.capabilities.push("mcp_client");
        manifest.required_mcp_servers = [{ id: "filesystem" }];
        return manifest;
      },
    });
    const compiled = compileCopilotPack({ repoRoot: fixture.tempRoot, manifestPath });
    assert.ok(compiled.files.some((file) => file.relative_path === "mcp/servers.yaml"));
    assert.ok(compiled.files.some((file) => file.relative_path === "hooks/preflight.yaml"));
  } finally {
    fixture.cleanup();
  }
});

test("compileCopilotPack rejects runtime path drift from official install surface", () => {
  assert.throws(
    () =>
      runtimeAdapter.validateAssetRelativePath(
        {
          install_surface: "metadata",
          file_name: "pairslash-bundle.json",
        },
        "agents/pairslash-bundle.json",
      ),
    /does not match install surface/,
  );
});

test("compileCopilotPack emits era-aware MCP config per declared spec_era", () => {
  const fixture = createTempRepo();
  try {
    const manifestPath = updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.capabilities.push("mcp_client");
        manifest.required_mcp_servers = [
          { id: "modern-server", spec_era: "modern" },
          { id: "legacy-server", spec_era: "legacy" },
          { id: "unknown-server" },
        ];
        return manifest;
      },
    });
    const compiled = compileCopilotPack({ repoRoot: fixture.tempRoot, manifestPath });
    const mcpFile = compiled.files.find((file) => file.relative_path === "mcp/servers.yaml");
    assert.ok(mcpFile, "expected an MCP sidecar file");
    assert.ok(mcpFile.content.includes("schema_version: 1.1.0"));
    assert.ok(mcpFile.content.includes("declarative_only: true"));
    assert.match(mcpFile.content, /modern-server[\s\S]*?spec_era: modern/);
    assert.ok(mcpFile.content.includes("Mcp-Method"));
    assert.ok(mcpFile.content.includes("server/discover"));
    assert.ok(mcpFile.content.includes("spec_era: legacy"));
    assert.match(mcpFile.content, /unknown-server[\s\S]*?spec_era: dual/);
    const order = ["legacy-server", "modern-server", "unknown-server"].map((id) =>
      mcpFile.content.indexOf(`id: ${id}`),
    );
    assert.ok(order[0] > -1 && order[0] < order[1] && order[1] < order[2]);
  } finally {
    fixture.cleanup();
  }
});

test("compileCopilotPack emits a spec-compliant enriched SKILL.md", () => {
  const manifestPath = join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml");
  const compiled = compileCopilotPack({ repoRoot, manifestPath });
  const skillFile = compiled.files.find((file) => file.file_name === "SKILL.md" || file.relative_path?.endsWith("SKILL.md"));
  assert.ok(skillFile, "expected a SKILL.md file in the compiled bundle");
  const verdict = validateSkillSpec({ content: skillFile.content, dirName: "pairslash-plan" });
  assert.equal(verdict.ok, true, verdict.errors.join("; "));
  assert.ok(skillFile.content.includes("license: \"Apache-2.0\""));
  assert.ok(skillFile.content.includes("copilot_cli>=1.0.0"));
  assert.equal(skillFile.content.includes("allowed-tools"), false);
});

test("compileCopilotPack emits a spec-compliant SKILL.md for every core pack", () => {
  const coreDir = join(repoRoot, "packs", "core");
  for (const packId of readdirSync(coreDir).sort()) {
    const manifestPath = join(coreDir, packId, "pack.manifest.yaml");
    if (!existsSync(manifestPath)) continue;
    const compiled = compileCopilotPack({ repoRoot, manifestPath });
    const skillFile = compiled.files.find((file) => file.file_name === "SKILL.md" || file.relative_path?.endsWith("SKILL.md"));
    assert.ok(skillFile, `expected a SKILL.md file in the compiled bundle for ${packId}`);
    const verdict = validateSkillSpec({ content: skillFile.content, dirName: packId });
    assert.equal(verdict.ok, true, `${packId}: ${verdict.errors.join("; ")}`);
    assert.equal(skillFile.content.includes("allowed-tools"), false, `${packId} leaked allowed-tools`);
    const compatibility = skillFile.content.match(/^compatibility: "(.*)"$/m)?.[1] ?? "";
    assert.ok(compatibility.length > 0 && compatibility.length <= 500, `${packId} compatibility length`);
  }
});

test("compileCopilotPack emitMode=plugin wraps the skill under skills/ with plugin.json", () => {
  const manifestPath = join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml");
  const compiled = compileCopilotPack({ repoRoot, manifestPath, emitMode: "plugin" });
  const compiledAgain = compileCopilotPack({ repoRoot, manifestPath, emitMode: "plugin" });
  assert.equal(compiled.digest, compiledAgain.digest, "plugin emit must be deterministic");

  const paths = compiled.files.map((file) => file.relative_path);
  assert.ok(paths.includes("plugin.json"));
  assert.ok(paths.includes("pairslash-plugin.json"));
  assert.ok(paths.includes("pairslash.install.json"));
  assert.ok(paths.includes("skills/pairslash-plan/SKILL.md"));
  assert.ok(
    paths.every(
      (path) =>
        path === "plugin.json" ||
        path === "pairslash-plugin.json" ||
        path === "pairslash.install.json" ||
        path.startsWith("skills/pairslash-plan/"),
    ),
    `unexpected bundle paths: ${paths.join(",")}`,
  );
  assert.ok(!paths.some((path) => path.endsWith(".agent.md")), "plugin bundles never emit agent files");

  const plugin = JSON.parse(compiled.files.find((file) => file.relative_path === "plugin.json").content);
  assert.equal(plugin.name, "pairslash-plan");
  assert.equal(plugin.skills, "skills/");
  assert.equal(plugin.license, "Apache-2.0");
  assert.ok(plugin.keywords.includes("pairslash"));
  assert.ok(!("agents" in plugin));
  assert.ok(!("mcpServers" in plugin));

  const provenance = JSON.parse(
    compiled.files.find((file) => file.relative_path === "pairslash-plugin.json").content,
  );
  assert.equal(provenance.kind, "pairslash-plugin-provenance");
  assert.equal(provenance.pack_id, "pairslash-plan");
  assert.equal(provenance.manifest_digest, compiled.manifest_digest);
  assert.equal(provenance.invocation_surface, "/skills");

  const skillFile = compiled.files.find((file) => file.relative_path === "skills/pairslash-plan/SKILL.md");
  const verdict = validateSkillSpec({ content: skillFile.content, dirName: "pairslash-plan" });
  assert.equal(verdict.ok, true, verdict.errors.join("; "));
});

test("compileCopilotPack emitMode=plugin works for every core pack", () => {
  const coreDir = join(repoRoot, "packs", "core");
  for (const packId of readdirSync(coreDir).sort()) {
    const manifestPath = join(coreDir, packId, "pack.manifest.yaml");
    if (!existsSync(manifestPath)) continue;
    const compiled = compileCopilotPack({ repoRoot, manifestPath, emitMode: "plugin" });
    const plugin = JSON.parse(compiled.files.find((file) => file.relative_path === "plugin.json").content);
    assert.equal(plugin.name, packId);
    assert.ok(
      compiled.files.some((file) => file.relative_path === `skills/${packId}/SKILL.md`),
      `${packId} missing skill payload`,
    );
    assert.ok(
      !compiled.files.some((file) => file.relative_path.endsWith(".agent.md")),
      `${packId} emitted an agent file`,
    );
  }
});

test("compileCopilotPack fails closed on unknown emit modes", () => {
  const manifestPath = join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml");
  assert.throws(
    () => compileCopilotPack({ repoRoot, manifestPath, emitMode: "bogus" }),
    /unsupported emit mode/,
  );
});

test("compileCopilotPack default emit is unchanged by plugin mode", () => {
  const manifestPath = join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml");
  const compiled = compileCopilotPack({ repoRoot, manifestPath });
  assert.ok(compiled.files.some((file) => file.relative_path === "SKILL.md"));
  assert.ok(!compiled.files.some((file) => file.relative_path === "plugin.json"));
});
