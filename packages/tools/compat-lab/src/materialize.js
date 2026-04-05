import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const compatLabRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRepoRoot = join(compatLabRoot, "fixtures", "repos");

function writeOverlayFiles(tempRoot, overlayFiles = {}) {
  for (const [relativePath, content] of Object.entries(overlayFiles)) {
    writeTextFile(join(tempRoot, relativePath), content);
  }
}

function copyRepoTemplate({ fixture, tempRoot }) {
  if (!fixture.repo_template) {
    return;
  }
  const templateRoot = join(fixtureRepoRoot, fixture.repo_template);
  if (!exists(templateRoot)) {
    throw new Error(`compat fixture template is missing: ${fixture.repo_template}`);
  }
  cpSync(templateRoot, tempRoot, {
    recursive: true,
  });
}

function copySourcePacks({ workspaceRoot, tempRoot, sourcePacks }) {
  mkdirSync(join(tempRoot, "packs", "core"), { recursive: true });
  for (const packId of sourcePacks) {
    cpSync(join(workspaceRoot, "packs", "core", packId), join(tempRoot, "packs", "core", packId), {
      recursive: true,
    });
  }
}

function copyAuthoritativeSupportCatalog({ workspaceRoot, tempRoot }) {
  const compatibilityRoot = join(workspaceRoot, "docs", "compatibility");
  if (!exists(compatibilityRoot)) {
    throw new Error("compat-lab requires docs/compatibility as authoritative support input");
  }
  cpSync(compatibilityRoot, join(tempRoot, "docs", "compatibility"), {
    recursive: true,
  });
  const liveEvidenceRoot = join(workspaceRoot, "docs", "evidence", "live-runtime");
  if (!exists(liveEvidenceRoot)) {
    throw new Error("compat-lab requires docs/evidence/live-runtime as authoritative support input");
  }
  cpSync(liveEvidenceRoot, join(tempRoot, "docs", "evidence", "live-runtime"), {
    recursive: true,
  });
  const runtimeMappingRoot = join(workspaceRoot, "docs", "runtime-mapping");
  if (!exists(runtimeMappingRoot)) {
    throw new Error("compat-lab requires docs/runtime-mapping as authoritative support input");
  }
  cpSync(runtimeMappingRoot, join(tempRoot, "docs", "runtime-mapping"), {
    recursive: true,
  });
  const releasesRoot = join(workspaceRoot, "docs", "releases");
  if (!exists(releasesRoot)) {
    throw new Error("compat-lab requires docs/releases as authoritative support input");
  }
  cpSync(releasesRoot, join(tempRoot, "docs", "releases"), {
    recursive: true,
  });
  const projectMemoryRoot = join(workspaceRoot, ".pairslash", "project-memory");
  if (!exists(projectMemoryRoot)) {
    throw new Error("compat-lab requires .pairslash/project-memory as authoritative support input");
  }
  cpSync(projectMemoryRoot, join(tempRoot, ".pairslash", "project-memory"), {
    recursive: true,
  });
  const compatLabPackageRoot = join(workspaceRoot, "packages", "tools", "compat-lab");
  if (!exists(compatLabPackageRoot)) {
    throw new Error("compat-lab requires packages/tools/compat-lab as evidence input");
  }
  cpSync(compatLabPackageRoot, join(tempRoot, "packages", "tools", "compat-lab"), {
    recursive: true,
  });
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

function writeFixtureMetadata({ fixture, tempRoot }) {
  const metadata = {
    id: fixture.id,
    repo_archetype: fixture.repo_archetype,
    purpose: fixture.purpose,
    primary_pack_id: fixture.primary_pack_id,
    source_packs: fixture.source_packs.slice(),
    repo_template: fixture.repo_template ?? null,
    supported_workflows: fixture.supported_workflows.slice(),
    expected_capabilities: fixture.expected_capabilities.slice(),
    modeled_risks: fixture.modeled_risks.slice(),
    supported_lanes: fixture.supported_lanes.map((lane) => ({ ...lane })),
  };
  writeTextFile(join(tempRoot, ".pairslash-compat-lab", "fixture.json"), stableJson(metadata));
}

export function materializeCompatFixture({ repoRoot: workspaceRoot, fixtureId }) {
  const fixture = getCompatFixture(fixtureId);
  const tempRoot = mkdtempSync(join(tmpdir(), `pairslash-compat-${fixtureId}-`));
  const homeRoot = join(tempRoot, ".compat-home");

  mkdirSync(homeRoot, { recursive: true });
  copyRepoTemplate({
    fixture,
    tempRoot,
  });
  copySourcePacks({
    workspaceRoot,
    tempRoot,
    sourcePacks: fixture.source_packs,
  });
  copyAuthoritativeSupportCatalog({
    workspaceRoot,
    tempRoot,
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
  writeFixtureMetadata({
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
