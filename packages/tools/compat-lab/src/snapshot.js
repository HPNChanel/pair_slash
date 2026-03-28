import { discoverPackManifestPaths, loadPackManifest } from "@pairslash/spec-core";
import { compileCodexPack } from "@pairslash/compiler-codex";
import { compileCopilotPack } from "@pairslash/compiler-copilot";
import { applyInstall, planInstall } from "@pairslash/installer";
import { runDoctor } from "@pairslash/doctor";

import { materializeCompatFixture } from "./materialize.js";
import {
  buildPathMarkers,
  normalizeCompiledPack,
  normalizeDoctorReport,
  normalizeInstallState,
  normalizePreviewPlan,
} from "./normalize.js";
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

function laneOverrides(runtime, target) {
  if (runtime === "codex_cli" && target === "repo") {
    return {
      os_override: "darwin",
      shell_override: "zsh",
    };
  }
  if (runtime === "copilot_cli" && target === "user") {
    return {
      os_override: "linux",
      shell_override: "bash",
    };
  }
  if (runtime === "copilot_cli" && target === "repo") {
    return {
      os_override: "linux",
      shell_override: "bash",
    };
  }
  return {
    os_override: "win32",
    shell_override: "powershell",
  };
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
  const overrides = laneOverrides(runtime, target);
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
    _os_override: overrides.os_override,
    _shell_override: overrides.shell_override,
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
    _os_override: overrides.os_override,
    _shell_override: overrides.shell_override,
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
    runtimeHarness.setHome(materialized.homeRoot);
    return {
      kind: "compat-fixture-snapshot",
      fixture_id: materialized.fixture.id,
      repo_archetype: materialized.fixture.repo_archetype,
      purpose: materialized.fixture.purpose,
      primary_pack_id: materialized.fixture.primary_pack_id,
      source_packs: materialized.fixture.source_packs.slice(),
      supported_workflows: materialized.fixture.supported_workflows.slice(),
      expected_capabilities: materialized.fixture.expected_capabilities.slice(),
      modeled_risks: materialized.fixture.modeled_risks.slice(),
      runtimes: {
        codex_cli: buildRuntimeSnapshot({
          workspaceRoot,
          tempRoot: materialized.tempRoot,
          homeRoot: materialized.homeRoot,
          runtimeBinRoot,
          packIds: materialized.fixture.source_packs,
          runtime: "codex_cli",
          target: "repo",
        }),
        copilot_cli: buildRuntimeSnapshot({
          workspaceRoot,
          tempRoot: materialized.tempRoot,
          homeRoot: materialized.homeRoot,
          runtimeBinRoot,
          packIds: materialized.fixture.source_packs,
          runtime: "copilot_cli",
          target: "user",
        }),
      },
    };
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
