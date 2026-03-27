import { discoverPackManifestPaths, loadPackManifest } from "@pairslash/spec-core";
import { compileCodexPack } from "@pairslash/compiler-codex";
import { compileCopilotPack } from "@pairslash/compiler-copilot";
import { applyInstall, planInstall } from "@pairslash/installer";
import { runDoctor } from "@pairslash/doctor";

import { materializeCompatFixture } from "./materialize.js";
import { buildPathMarkers, normalizeCompiledPack, normalizeDoctorReport, normalizeInstallState, normalizePreviewPlan } from "./normalize.js";
import { installFakeRuntimes } from "./runtime-fixtures.js";
import { listCompatFixtures } from "./fixtures.js";

function manifestPathsFor(tempRoot, packIds) {
  return discoverPackManifestPaths(tempRoot)
    .map((manifestPath) => ({ manifestPath, manifest: loadPackManifest(manifestPath) }))
    .filter(({ manifest }) => packIds.includes(manifest.pack.id))
    .sort((left, right) => left.manifest.pack.id.localeCompare(right.manifest.pack.id))
    .map(({ manifestPath }) => manifestPath);
}

function compileForRuntime(runtime, tempRoot, manifestPath) {
  return runtime === "codex_cli"
    ? compileCodexPack({ repoRoot: tempRoot, manifestPath })
    : compileCopilotPack({ repoRoot: tempRoot, manifestPath });
}

function buildRuntimeSnapshot({
  workspaceRoot,
  tempRoot,
  homeRoot,
  runtimeBinRoot,
  packIds,
  runtime,
  target = "repo",
}) {
  const markers = buildPathMarkers({
    workspaceRoot,
    repoRoot: tempRoot,
    homeRoot,
    runtimeBinRoot,
  });
  const compiled = manifestPathsFor(tempRoot, packIds)
    .map((manifestPath) => compileForRuntime(runtime, tempRoot, manifestPath))
    .map((pack) => normalizeCompiledPack(pack, markers));

  const preview = planInstall({
    repoRoot: tempRoot,
    runtime,
    target,
    packs: packIds,
  });
  const doctorBefore = runDoctor({
    repoRoot: tempRoot,
    runtime,
    target,
    packs: packIds,
  });

  const snapshot = {
    compile: compiled,
    install_preview: normalizePreviewPlan(preview.plan, markers),
    doctor_before: normalizeDoctorReport(doctorBefore, markers),
    apply_result: null,
    doctor_after: null,
  };

  if (!preview.plan.can_apply) {
    snapshot.apply_result = {
      status: "blocked",
      summary: { ...preview.plan.summary },
      errors: preview.plan.errors.map((error) => error),
    };
    return snapshot;
  }

  const result = applyInstall(preview);
  const doctorAfter = runDoctor({
    repoRoot: tempRoot,
    runtime,
    target,
    packs: packIds,
  });
  snapshot.apply_result = {
    status: "applied",
    summary: { ...result.summary },
    state: normalizeInstallState(result.state, markers),
  };
  snapshot.doctor_after = normalizeDoctorReport(doctorAfter, markers);
  return snapshot;
}

export function buildCompatFixtureSnapshot({ repoRoot: workspaceRoot, fixtureId }) {
  const materialized = materializeCompatFixture({
    repoRoot: workspaceRoot,
    fixtureId,
  });
  const runtimeHarness = installFakeRuntimes();

  try {
    const runtimeBinRoot = runtimeHarness.binDir;
    const base = {
      kind: "compat-fixture-snapshot",
      fixture_id: materialized.fixture.id,
      purpose: materialized.fixture.purpose,
      source_packs: materialized.fixture.source_packs.slice(),
      runtimes: {
        codex_cli: buildRuntimeSnapshot({
          workspaceRoot,
          tempRoot: materialized.tempRoot,
          homeRoot: materialized.homeRoot,
          runtimeBinRoot,
          packIds: materialized.fixture.source_packs,
          runtime: "codex_cli",
        }),
        copilot_cli: buildRuntimeSnapshot({
          workspaceRoot,
          tempRoot: materialized.tempRoot,
          homeRoot: materialized.homeRoot,
          runtimeBinRoot,
          packIds: materialized.fixture.source_packs,
          runtime: "copilot_cli",
        }),
      },
    };
    return base;
  } finally {
    runtimeHarness.cleanup();
    materialized.cleanup();
  }
}

export function buildCompatSnapshot({ repoRoot: workspaceRoot }) {
  return {
    kind: "compat-lab-snapshot-suite",
    fixtures: listCompatFixtures().map((fixture) =>
      buildCompatFixtureSnapshot({
        repoRoot: workspaceRoot,
        fixtureId: fixture.id,
      })
    ),
  };
}
