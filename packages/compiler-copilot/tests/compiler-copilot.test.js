import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { compileCopilotPack } from "@pairslash/compiler-copilot";

import { createTempRepo, repoRoot, updatePackManifest } from "../../../tests/phase4-helpers.js";

test("compileCopilotPack is deterministic and runtime-native", () => {
  const manifestPath = join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml");
  const compiled = compileCopilotPack({ repoRoot, manifestPath });
  assert.equal(compiled.direct_invocation, "/pairslash-plan");
  assert.equal(compiled.runtime, "copilot_cli");
  assert.equal(compiled.bundle_kind, "copilot-package-bundle");
  assert.ok(compiled.files.some((file) => file.relative_path === "package/pairslash-bundle.json"));
  assert.ok(compiled.files.some((file) => file.relative_path === "agents/runtime-context.md"));
  const ownershipFile = compiled.files.find((file) => file.relative_path === "pairslash.install.json");
  assert.ok(ownershipFile);
  assert.equal(JSON.parse(ownershipFile.content).runtime, "copilot_cli");
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
