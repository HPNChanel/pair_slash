import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { compileCodexPack } from "@pairslash/compiler-codex";
import * as codexAdapter from "@pairslash/runtime-codex-adapter";
import {
  exists,
  loadPackManifest,
  stableJson,
  stableYaml,
  writeTextFile,
} from "@pairslash/spec-core";

import { resolveStatePath } from "@pairslash/installer";

import { getCompatFixture } from "./fixtures.js";

function writeOverlayFiles(tempRoot, overlayFiles = {}) {
  for (const [relativePath, content] of Object.entries(overlayFiles)) {
    writeTextFile(join(tempRoot, relativePath), content);
  }
}

function copySourcePacks({ workspaceRoot, tempRoot, sourcePacks }) {
  mkdirSync(join(tempRoot, "packs", "core"), { recursive: true });
  for (const packId of sourcePacks) {
    cpSync(join(workspaceRoot, "packs", "core", packId), join(tempRoot, "packs", "core", packId), {
      recursive: true,
    });
  }
}

function mutateManifestFiles({ fixture, tempRoot }) {
  if (typeof fixture.mutate_manifest !== "function") {
    return;
  }
  for (const packId of fixture.source_packs) {
    const manifestPath = join(tempRoot, "packs", "core", packId, "pack.manifest.yaml");
    const manifest = loadPackManifest(manifestPath);
    const updated = fixture.mutate_manifest(packId, structuredClone(manifest)) ?? manifest;
    writeTextFile(manifestPath, stableYaml(updated));
  }
}

function buildOrphanState({ tempRoot, packId }) {
  const manifestPath = join(tempRoot, "packs", "core", packId, "pack.manifest.yaml");
  const compiled = compileCodexPack({
    repoRoot: tempRoot,
    manifestPath,
  });
  const trackedFile = compiled.files.find((file) => file.relative_path === "pairslash.install.json")
    ?? compiled.files[0];
  const installDir = codexAdapter.resolvePackInstallDir({ repoRoot: tempRoot, target: "repo" }, packId);
  const absolutePath = join(installDir, trackedFile.relative_path);
  const state = {
    kind: "install-state",
    schema_version: "1.0.0",
    runtime: "codex_cli",
    target: "repo",
    config_home: codexAdapter.resolveConfigHome({ repoRoot: tempRoot, target: "repo" }),
    install_root: codexAdapter.resolveInstallRoot({ repoRoot: tempRoot, target: "repo" }),
    updated_at: "2026-01-01T00:00:00.000Z",
    last_transaction_id: "fixture-orphaned",
    packs: [
      {
        id: compiled.pack_id,
        version: compiled.version,
        previous_version: null,
        install_dir: installDir,
        manifest_digest: compiled.manifest_digest,
        compiler_version: compiled.compiler_version,
        updated_at: "2026-01-01T00:00:00.000Z",
        files: [
          {
            relative_path: trackedFile.relative_path,
            absolute_path: absolutePath,
            source_digest: trackedFile.sha256,
            current_digest: trackedFile.sha256,
            owned_by_pairslash: true,
            override_eligible: trackedFile.override_eligible,
            local_override: false,
            asset_kind: trackedFile.asset_kind,
            install_surface: trackedFile.install_surface,
            runtime_selector: trackedFile.runtime_selector,
            generated: trackedFile.generated,
            write_authority_guarded: trackedFile.write_authority_guarded,
            last_operation: "create",
          },
        ],
      },
    ],
  };
  const statePath = resolveStatePath({
    repoRoot: tempRoot,
    runtime: "codex_cli",
    target: "repo",
  });
  writeTextFile(statePath, stableJson(state));
}

function setupConflictFixture(tempRoot) {
  const unmanagedCopilotPath = join(
    tempRoot,
    ".github",
    "skills",
    "pairslash-plan",
    "package",
    "pairslash-bundle.json",
  );
  writeTextFile(
    unmanagedCopilotPath,
    stableJson({
      kind: "manual-copilot-package",
      fixture: "repo-conflict-existing-runtime",
    }),
  );
  buildOrphanState({
    tempRoot,
    packId: "pairslash-plan",
  });
}

function runFixtureSetup({ fixture, tempRoot }) {
  if (!fixture.setup_modes) {
    return;
  }
  if (fixture.setup_modes.seed_codex_orphan_state || fixture.setup_modes.seed_copilot_unmanaged_conflict) {
    setupConflictFixture(tempRoot);
  }
}

export function materializeCompatFixture({ repoRoot: workspaceRoot, fixtureId }) {
  const fixture = getCompatFixture(fixtureId);
  const tempRoot = mkdtempSync(join(tmpdir(), `pairslash-compat-${fixtureId}-`));
  const homeRoot = join(tempRoot, ".compat-home");

  mkdirSync(homeRoot, { recursive: true });
  copySourcePacks({
    workspaceRoot,
    tempRoot,
    sourcePacks: fixture.source_packs,
  });
  writeOverlayFiles(tempRoot, fixture.overlay_files);
  mutateManifestFiles({
    fixture,
    tempRoot,
  });
  runFixtureSetup({
    fixture,
    tempRoot,
  });

  if (!exists(join(tempRoot, "package.json"))) {
    writeFileSync(join(tempRoot, "package.json"), stableJson({
      name: `compat-${fixtureId}`,
      private: true,
      version: "0.0.0",
    }));
  }

  return {
    fixture,
    tempRoot,
    homeRoot,
    cleanup() {
      rmSync(tempRoot, { recursive: true, force: true });
    },
  };
}
