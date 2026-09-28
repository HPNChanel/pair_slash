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
    // Agent profiles are opt-in per pack and must land at plugin-root agents/
    // for native discovery — never dormant inside the wrapped skill payload.
    assert.ok(
      !compiled.files.some(
        (file) => file.relative_path.startsWith(`skills/${packId}/`) && file.relative_path.endsWith(".agent.md"),
      ),
      `${packId} left an agent file inside the skill payload`,
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

test("compileCopilotPack emitMode=plugin wires advisory hooks for write-authority packs", () => {
  const manifestPath = join(
    repoRoot,
    "packs",
    "core",
    "pairslash-memory-write-global",
    "pack.manifest.yaml",
  );
  const compiled = compileCopilotPack({ repoRoot, manifestPath, emitMode: "plugin" });
  const paths = compiled.files.map((file) => file.relative_path);
  assert.ok(paths.includes("hooks/hooks.json"));
  assert.ok(paths.includes("scripts/pairslash-preflight.mjs"));
  assert.ok(paths.includes("skills/pairslash-memory-write-global/hooks/preflight.yaml"));

  const plugin = JSON.parse(
    compiled.files.find((file) => file.relative_path === "plugin.json").content,
  );
  assert.equal(plugin.hooks, "hooks/hooks.json");

  const hooks = JSON.parse(
    compiled.files.find((file) => file.relative_path === "hooks/hooks.json").content,
  );
  assert.equal(hooks.version, 1);
  // turn-stop has no advisory channel on Copilot; only sessionStart is wired.
  assert.deepEqual(Object.keys(hooks.hooks), ["sessionStart"]);
  const entry = hooks.hooks.sessionStart[0];
  assert.equal(entry.type, "command");
  assert.ok(entry.bash.includes("$PLUGIN_ROOT"));
  assert.ok(entry.powershell.includes("$env:PLUGIN_ROOT"));

  const provenance = JSON.parse(
    compiled.files.find((file) => file.relative_path === "pairslash-plugin.json").content,
  );
  assert.equal(provenance.hooks.advisory_only, true);
  assert.equal(provenance.hooks.script_relpath, "scripts/pairslash-preflight.mjs");
});

test("compileCopilotPack emitMode=plugin emits no hook files for read-oriented packs", () => {
  const manifestPath = join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml");
  const compiled = compileCopilotPack({ repoRoot, manifestPath, emitMode: "plugin" });
  const paths = compiled.files.map((file) => file.relative_path);
  assert.ok(!paths.some((path) => path.startsWith("hooks/hooks.json")));
  assert.ok(!paths.some((path) => path.startsWith("scripts/")));
  const plugin = JSON.parse(
    compiled.files.find((file) => file.relative_path === "plugin.json").content,
  );
  assert.ok(!("hooks" in plugin));
});

test("compileCopilotPack emits .agent.md shim for opted-in packs only", () => {
  const reviewManifest = join(repoRoot, "packs", "core", "pairslash-review", "pack.manifest.yaml");
  const compiled = compileCopilotPack({ repoRoot, manifestPath: reviewManifest });
  const agent = compiled.files.find((file) => file.asset_id === "copilot-agent-profile");
  assert.ok(agent);
  assert.equal(agent.relative_path, "agents/pairslash-review.agent.md");
  assert.equal(agent.install_surface, "agent");
  assert.ok(agent.content.includes('name: "pairslash-review"'));
  // pairslash-review is implicit_invocation: explicit-only -> manual selection.
  assert.ok(agent.content.includes("disable-model-invocation: true"));
  assert.ok(agent.content.includes('tools: ["read", "search"]'));
  assert.ok(agent.content.includes("/skills"));

  const planManifest = join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml");
  const plan = compileCopilotPack({ repoRoot, manifestPath: planManifest });
  assert.ok(!plan.files.some((file) => file.relative_path.endsWith(".agent.md")));
});

test("compileCopilotPack emitMode=plugin hoists agent profile to plugin-root agents/", () => {
  const manifestPath = join(repoRoot, "packs", "core", "pairslash-review", "pack.manifest.yaml");
  const compiled = compileCopilotPack({ repoRoot, manifestPath, emitMode: "plugin" });
  const paths = compiled.files.map((file) => file.relative_path);
  assert.ok(paths.includes("agents/pairslash-review.agent.md"));
  assert.ok(!paths.includes("skills/pairslash-review/agents/pairslash-review.agent.md"));
  // The runtime-context sidecar is a bundle doc, not an agent profile.
  assert.ok(paths.includes("skills/pairslash-review/agents/runtime-context.md"));
  const plugin = JSON.parse(
    compiled.files.find((file) => file.relative_path === "plugin.json").content,
  );
  assert.equal(plugin.agents, "agents/");
});

test("compileCopilotPack emitMode=plugin omits agents pointer for non-opted packs", () => {
  const manifestPath = join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml");
  const compiled = compileCopilotPack({ repoRoot, manifestPath, emitMode: "plugin" });
  const plugin = JSON.parse(
    compiled.files.find((file) => file.relative_path === "plugin.json").content,
  );
  assert.ok(!("agents" in plugin));
  assert.ok(!compiled.files.some((file) => file.relative_path.endsWith(".agent.md")));
});

test("compileCopilotPack agent shim honors implicit-allowed (manual-selection flag omitted)", () => {
  const fixture = createTempRepo({ packs: ["pairslash-review"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-review",
      mutate(manifest) {
        manifest.implicit_invocation = "implicit-allowed";
        return manifest;
      },
    });
    const manifestPath = join(
      fixture.tempRoot,
      "packs",
      "core",
      "pairslash-review",
      "pack.manifest.yaml",
    );
    const compiled = compileCopilotPack({ repoRoot: fixture.tempRoot, manifestPath });
    const agent = compiled.files.find((file) => file.asset_id === "copilot-agent-profile");
    assert.ok(agent);
    assert.ok(!agent.content.includes("disable-model-invocation"));
  } finally {
    fixture.cleanup();
  }
});
