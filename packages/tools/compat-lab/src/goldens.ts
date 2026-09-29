import { compileCodexPack } from "@pairslash/compiler-codex";
import { compileCopilotPack } from "@pairslash/compiler-copilot";
import { previewMemoryWrite } from "@pairslash/memory-engine";
import { planInstall } from "@pairslash/installer";
import { discoverPackManifestPaths, loadPackManifest, loadPackManifestRecords, stableYaml, writeTextFile } from "@pairslash/spec-core";

import { materializeCompatFixture } from "./materialize.ts";
import { buildPathMarkers, normalizeCompiledPack, normalizePreviewPlan } from "./normalize.ts";
import { installCompatRuntimeShims } from "./runtime-fixtures.ts";

const HIGH_SIGNAL_SURFACES = new Set(["metadata", "context", "config", "agent", "hook", "mcp"]);

const FIXED_MEMORY_REQUEST = Object.freeze({
  kind: "constraint",
  title: "Compat lab explicit write discipline",
  statement: "Phase 6 preview behavior must stay explicit and reviewable.",
  evidence: "compat-lab regression fixture",
  scope: "whole-project",
  confidence: "high",
  action: "append",
  tags: ["compat-lab", "phase6"],
  source_refs: ["packages/tools/compat-lab/src/goldens.js"],
  updated_by: "compat-lab",
  timestamp: "2026-03-28T00:00:00.000Z",
});

export const DEFAULT_COMPAT_GOLDENS = [
  {
    id: "compiler-codex.repo-node-service",
    kind: "compiler",
    fixture_id: "repo-node-service",
    runtime: "codex_cli",
  },
  {
    id: "compiler-copilot.repo-python-service",
    kind: "compiler",
    fixture_id: "repo-python-service",
    runtime: "copilot_cli",
  },
  {
    id: "compiler-copilot-plugin.repo-python-service",
    kind: "compiler",
    fixture_id: "repo-python-service",
    runtime: "copilot_cli",
    emit_mode: "plugin",
  },
  {
    id: "compiler-codex-plugin.repo-node-service",
    kind: "compiler",
    fixture_id: "repo-node-service",
    runtime: "codex_cli",
    emit_mode: "plugin",
  },
  {
    id: "generated-assets.repo-backend-mcp",
    kind: "generated-assets",
    fixture_id: "repo-backend-mcp",
  },
  {
    id: "preview-no-silent-fallback.repo-unsafe-repo",
    kind: "preview-no-silent-fallback",
    fixture_id: "repo-unsafe-repo",
    runtime: "codex_cli",
  },
];

function manifestPathsFor(tempRoot: any, packIds: string[] | undefined) {
  return discoverPackManifestPaths(tempRoot)
    .map((manifestPath: string) => ({ manifestPath, manifest: loadPackManifest(manifestPath) }))
    .filter(({ manifest }: any) => (packIds ?? []).includes(manifest.pack.id))
    .sort((left: any, right: any) => left.manifest.pack.id.localeCompare(right.manifest.pack.id))
    .map(({ manifestPath }: any) => manifestPath);
}

function compileForRuntime({ runtime, repoRoot, manifestPath, emitMode = undefined }: { runtime?: string; repoRoot: string; manifestPath: string; emitMode?: any }) {
  return runtime === "codex_cli"
    ? compileCodexPack({ repoRoot, manifestPath, emitMode })
    : compileCopilotPack({ repoRoot, manifestPath, emitMode });
}

function summarizeImportantFiles(compiledPacks: any, markers: any) {
  return compiledPacks.map((compiledPack: any) => {
    const normalized = normalizeCompiledPack(compiledPack, markers);
    return {
      pack_id: normalized.pack_id,
      runtime: normalized.runtime,
      bundle_kind: normalized.bundle_kind,
      direct_invocation: normalized.direct_invocation,
      files: normalized.files.filter((file: any) => HIGH_SIGNAL_SURFACES.has(file.install_surface)),
    };
  });
}

function summarizePreviewPlan(plan: any, markers: any) {
  const normalized = normalizePreviewPlan(plan, markers);
  return {
    action: normalized.action,
    runtime: normalized.runtime,
    target: normalized.target,
    can_apply: normalized.can_apply,
    selected_packs: normalized.selected_packs,
    summary: normalized.summary,
    warnings: normalized.warnings,
    errors: normalized.errors,
    asset_diff: plan.asset_diff
      ? {
          create_count: plan.asset_diff.create_count,
          update_count: plan.asset_diff.update_count,
          delete_count: plan.asset_diff.delete_count,
          mutating_operation_count: plan.asset_diff.mutating_operation_count,
          runtime_targeted_outputs: plan.asset_diff.runtime_targeted_outputs.slice(),
          config_fragments_affected: plan.asset_diff.config_fragments_affected.slice(),
          risky_mutations: plan.asset_diff.risky_mutations.slice(),
        }
      : null,
    policy_summary: plan.policy_summary ? { ...plan.policy_summary } : null,
    commitability: plan.commitability ? { ...plan.commitability } : null,
    preview_boundary: plan.preview_boundary ? { ...plan.preview_boundary } : null,
    operations: normalized.operations.filter((operation: any) =>
      ["create", "replace", "remove", "blocked_conflict", "preserve_override"].includes(operation.kind)
    ),
  };
}

function mutateManifest(tempRoot: any, packId: string, mutate: any) {
  const record = loadPackManifestRecords(tempRoot).find((entry: any) => entry.packId === packId && !entry.error);
  if (!record) {
    throw new Error(`could not locate manifest for ${packId}`);
  }
  const updated = mutate(structuredClone(record.manifest)) ?? record.manifest;
  writeTextFile(record.manifestPath, stableYaml(updated));
}

export function listCompatGoldens() {
  return DEFAULT_COMPAT_GOLDENS.map((golden: any) => ({ ...golden }));
}

export function buildCompatGolden({ repoRoot, goldenId }: { repoRoot?: string; goldenId?: any }) {
  const golden = DEFAULT_COMPAT_GOLDENS.find((entry: any) => entry.id === goldenId);
  if (!golden) {
    throw new Error(`unknown compat golden: ${goldenId}`);
  }
  if (golden.kind === "compiler") {
    return buildCompilerGolden({
      repoRoot,
      fixtureId: golden.fixture_id,
      runtime: golden.runtime,
      emitMode: golden.emit_mode,
    });
  }
  if (golden.kind === "generated-assets") {
    return buildGeneratedAssetGolden({
      repoRoot,
      fixtureId: golden.fixture_id,
    });
  }
  if (golden.kind === "preview-no-silent-fallback") {
    return buildPreviewNoSilentFallbackGolden({
      repoRoot,
      fixtureId: golden.fixture_id,
      runtime: golden.runtime,
    });
  }
  throw new Error(`unsupported compat golden kind: ${golden.kind}`);
}

export function buildCompilerGolden({ repoRoot, fixtureId, runtime, emitMode }: { repoRoot?: string; fixtureId?: any; runtime?: string; emitMode?: any }) {
  const materialized = materializeCompatFixture({
    repoRoot,
    fixtureId,
  });
  try {
    const markers = buildPathMarkers({
      workspaceRoot: repoRoot,
      repoRoot: materialized.tempRoot,
      homeRoot: materialized.homeRoot,
    });
    const compiled = manifestPathsFor(materialized.tempRoot, materialized.fixture.source_packs).map((manifestPath: string) =>
      compileForRuntime({
        runtime,
        repoRoot: materialized.tempRoot,
        manifestPath,
        emitMode,
      })
    );
    return {
      kind: "compat-compiler-golden",
      fixture_id: fixtureId,
      repo_archetype: materialized.fixture.repo_archetype,
      primary_pack_id: materialized.fixture.primary_pack_id,
      runtime,
      compiled: compiled.map((pack: any) => normalizeCompiledPack(pack, markers)),
    };
  } finally {
    materialized.cleanup();
  }
}

export function buildGeneratedAssetGolden({ repoRoot, fixtureId }: { repoRoot?: string; fixtureId?: any }) {
  const materialized = materializeCompatFixture({
    repoRoot,
    fixtureId,
  });
  try {
    const markers = buildPathMarkers({
      workspaceRoot: repoRoot,
      repoRoot: materialized.tempRoot,
      homeRoot: materialized.homeRoot,
    });
    const compiled = {
      codex_cli: manifestPathsFor(materialized.tempRoot, materialized.fixture.source_packs).map((manifestPath: string) =>
        compileForRuntime({
          runtime: "codex_cli",
          repoRoot: materialized.tempRoot,
          manifestPath,
        })
      ),
      copilot_cli: manifestPathsFor(materialized.tempRoot, materialized.fixture.source_packs).map((manifestPath: string) =>
        compileForRuntime({
          runtime: "copilot_cli",
          repoRoot: materialized.tempRoot,
          manifestPath,
        })
      ),
    };
    return {
      kind: "compat-generated-assets-golden",
      fixture_id: fixtureId,
      repo_archetype: materialized.fixture.repo_archetype,
      important_assets: {
        codex_cli: summarizeImportantFiles(compiled.codex_cli, markers),
        copilot_cli: summarizeImportantFiles(compiled.copilot_cli, markers),
      },
    };
  } finally {
    materialized.cleanup();
  }
}

export function buildPreviewNoSilentFallbackGolden({ repoRoot, fixtureId, runtime = "codex_cli" }: { repoRoot?: string; fixtureId?: any; runtime?: string }) {
  const materialized = materializeCompatFixture({
    repoRoot,
    fixtureId,
  });
  const runtimeHarness = installCompatRuntimeShims();
  try {
    mutateManifest(materialized.tempRoot, materialized.fixture.primary_pack_id, (manifest: any) => {
      manifest.runtime_bindings.copilot_cli.compatibility.direct_invocation = "blocked";
      manifest.runtime_targets.copilot_cli.compatibility.direct_invocation = "blocked";
      return manifest;
    });

    const markers = buildPathMarkers({
      workspaceRoot: repoRoot,
      repoRoot: materialized.tempRoot,
      homeRoot: materialized.homeRoot,
      runtimeBinRoot: runtimeHarness.binDir,
    });
    const preview = planInstall({
      repoRoot: materialized.tempRoot,
      runtime,
      target: "repo",
      packs: materialized.fixture.source_packs,
    });
    const memoryPreview = previewMemoryWrite({
      repoRoot: materialized.tempRoot,
      request: FIXED_MEMORY_REQUEST,
      runtime,
      target: "repo",
      policyContext: {
        fallback_attempted: true,
      },
    });
    return {
      kind: "compat-preview-policy-golden",
      fixture_id: fixtureId,
      repo_archetype: materialized.fixture.repo_archetype,
      runtime,
      install_preview: summarizePreviewPlan(preview.plan, markers),
      memory_preview: {
        overall_verdict: memoryPreview.policy_verdict.overall_verdict,
        reason_codes: (memoryPreview.policy_verdict.reasons ?? []).map((reason: any) => reason.code),
        ready_for_apply: memoryPreview.ready_for_apply,
        requires_confirmation: memoryPreview.requires_confirmation,
      },
    };
  } finally {
    runtimeHarness.cleanup();
    materialized.cleanup();
  }
}
