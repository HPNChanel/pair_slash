import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { compileCodexPack } from "@pairslash/compiler-codex";

import { createTempRepo, repoRoot, updatePackManifest } from "../../../tests/phase4-helpers.js";

test("compileCodexPack is deterministic and emits ownership metadata", () => {
  const manifestPath = join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml");
  const first = compileCodexPack({ repoRoot, manifestPath });
  const second = compileCodexPack({ repoRoot, manifestPath });
  assert.equal(first.digest, second.digest);
  assert.equal(first.direct_invocation, "$pairslash-plan");
  assert.equal(first.bundle_kind, "codex-skill-bundle");
  assert.ok(first.files.some((file) => file.relative_path === "agents/openai.yaml"));
  assert.ok(first.files.some((file) => file.relative_path === "fragments/context/runtime-context.md"));
  assert.ok(first.files.some((file) => file.relative_path === "fragments/config/pack-config.yaml"));
  const ownershipFile = first.files.find((file) => file.relative_path === "pairslash.install.json");
  assert.ok(ownershipFile);
  const ownership = JSON.parse(ownershipFile.content);
  assert.equal(ownership.kind, "pairslash-owned-footprint");
  assert.equal(ownership.ownership_scope, "pack_root");
  assert.ok(ownership.files.some((file) => file.install_surface === "context"));
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
