import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { compileCodexPack, runtimeAdapter } from "@pairslash/compiler-codex";
import { validateSkillSpec } from "@pairslash/spec-core";

import { createTempRepo, repoRoot, updatePackManifest } from "../../../../../tests/phase4-helpers.js";

test("compileCodexPack is deterministic and emits ownership metadata", () => {
  const manifestPath = join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml");
  const first = compileCodexPack({ repoRoot, manifestPath });
  const second = compileCodexPack({ repoRoot, manifestPath });
  assert.equal(first.digest, second.digest);
  assert.equal(first.direct_invocation, "$pairslash-plan");
  assert.equal(first.bundle_kind, "codex-skill-bundle");
  assert.ok(
    first.files.some(
      (file) =>
        file.asset_id === "codex-metadata" &&
        file.generator === "codex_metadata" &&
        file.relative_path === "agents/openai.yaml",
    ),
  );
  assert.ok(
    first.files.some(
      (file) =>
        file.asset_id === "codex-context" &&
        file.relative_path === "fragments/context/runtime-context.md",
    ),
  );
  const contextFile = first.files.find((file) => file.asset_id === "codex-context");
  assert.ok(contextFile);
  assert.equal(contextFile.content.includes("Direct invocation"), false);
  assert.ok(
    first.files.some(
      (file) =>
        file.asset_id === "codex-config" &&
        file.relative_path === "fragments/config/pack-config.yaml",
    ),
  );
  const ownershipFile = first.files.find((file) => file.relative_path === "pairslash.install.json");
  assert.ok(ownershipFile);
  const ownership = JSON.parse(ownershipFile.content);
  assert.equal(ownership.kind, "pairslash-owned-footprint");
  assert.equal(ownership.ownership_scope, "pack_root");
  assert.ok(
    ownership.files.some(
      (file) =>
        file.asset_id === "codex-context" &&
        file.generator === "codex_context" &&
        file.owner === "pairslash" &&
        file.uninstall_behavior === "detach_if_modified",
    ),
  );
  assert.equal(ownershipFile.asset_id, "ownership-receipt");
  assert.equal(ownershipFile.uninstall_behavior, "remove_if_unmodified");
});

test("compileCodexPack emits write-authority guard for memory write workflow", () => {
  const manifestPath = join(
    repoRoot,
    "packs",
    "core",
    "pairslash-memory-write-global",
    "pack.manifest.yaml",
  );
  const compiled = compileCodexPack({ repoRoot, manifestPath });
  assert.ok(
    compiled.files.some(
      (file) =>
        file.relative_path === "fragments/config/write-authority.yaml" &&
        file.write_authority_guarded,
    ),
  );
});

test("compileCodexPack emits MCP config when dependency is declared", () => {
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
    const compiled = compileCodexPack({ repoRoot: fixture.tempRoot, manifestPath });
    assert.ok(compiled.files.some((file) => file.relative_path === "fragments/mcp/servers.yaml"));
  } finally {
    fixture.cleanup();
  }
});

test("compileCodexPack emits era-aware MCP config per declared spec_era", () => {
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
    const compiled = compileCodexPack({ repoRoot: fixture.tempRoot, manifestPath });
    const mcpFile = compiled.files.find(
      (file) => file.relative_path === "fragments/mcp/servers.yaml",
    );
    assert.ok(mcpFile, "expected an MCP config file");
    assert.ok(mcpFile.content.includes("schema_version: 1.1.0"));
    assert.ok(mcpFile.content.includes("declarative_only: true"));
    // modern era: stateless + required headers + server/discover
    assert.match(mcpFile.content, /modern-server[\s\S]*?spec_era: modern/);
    assert.ok(mcpFile.content.includes("Mcp-Method"));
    assert.ok(mcpFile.content.includes("server/discover"));
    // legacy era: handshake expectation + deprecation note
    assert.ok(mcpFile.content.includes("spec_era: legacy"));
    assert.ok(mcpFile.content.includes("deprecated"));
    // missing era normalizes to dual
    assert.match(mcpFile.content, /unknown-server[\s\S]*?spec_era: dual/);
    // deterministic ordering by server id
    const order = ["legacy-server", "modern-server", "unknown-server"].map((id) =>
      mcpFile.content.indexOf(`id: ${id}`),
    );
    assert.ok(order[0] > -1 && order[0] < order[1] && order[1] < order[2]);
  } finally {
    fixture.cleanup();
  }
});

test("compileCodexPack rejects runtime path drift from official install surface", () => {
  assert.throws(
    () =>
      runtimeAdapter.validateAssetRelativePath(
        {
          install_surface: "metadata",
          file_name: "openai.yaml",
        },
        "package/openai.yaml",
      ),
    /does not match install surface/,
  );
});

test("compileCodexPack emits a spec-compliant enriched SKILL.md", () => {
  const manifestPath = join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml");
  const compiled = compileCodexPack({ repoRoot, manifestPath });
  const skillFile = compiled.files.find((file) => file.file_name === "SKILL.md" || file.relative_path?.endsWith("SKILL.md"));
  assert.ok(skillFile, "expected a SKILL.md file in the compiled bundle");
  const verdict = validateSkillSpec({ content: skillFile.content, dirName: "pairslash-plan" });
  assert.equal(verdict.ok, true, verdict.errors.join("; "));
  assert.ok(skillFile.content.includes("license: \"Apache-2.0\""));
  assert.ok(skillFile.content.includes("compatibility:"));
  assert.ok(skillFile.content.includes("codex_cli>=0.153.4"));
  assert.ok(skillFile.content.includes("pack_id: \"pairslash-plan\""));
  assert.equal(skillFile.content.includes("allowed-tools"), false);
});

test("compileCodexPack emits a spec-compliant SKILL.md for every core pack", () => {
  const coreDir = join(repoRoot, "packs", "core");
  for (const packId of readdirSync(coreDir).sort()) {
    const manifestPath = join(coreDir, packId, "pack.manifest.yaml");
    if (!existsSync(manifestPath)) continue;
    const compiled = compileCodexPack({ repoRoot, manifestPath });
    const skillFile = compiled.files.find((file) => file.file_name === "SKILL.md" || file.relative_path?.endsWith("SKILL.md"));
    assert.ok(skillFile, `expected a SKILL.md file in the compiled bundle for ${packId}`);
    const verdict = validateSkillSpec({ content: skillFile.content, dirName: packId });
    assert.equal(verdict.ok, true, `${packId}: ${verdict.errors.join("; ")}`);
    assert.equal(skillFile.content.includes("allowed-tools"), false, `${packId} leaked allowed-tools`);
    const compatibility = skillFile.content.match(/^compatibility: "(.*)"$/m)?.[1] ?? "";
    assert.ok(compatibility.length > 0 && compatibility.length <= 500, `${packId} compatibility length`);
  }
});
