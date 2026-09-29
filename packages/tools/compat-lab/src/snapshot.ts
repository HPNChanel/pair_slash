import { discoverPackManifestPaths, loadPackManifest } from "@pairslash/spec-core";
import { compileCodexPack } from "@pairslash/compiler-codex";
import { compileCopilotPack } from "@pairslash/compiler-copilot";
import { applyInstall, planInstall } from "@pairslash/installer";
import { runDoctor } from "@pairslash/doctor";

import { materializeCompatFixture } from "./materialize.ts";
import {
  buildPathMarkers,
  normalizeCompiledPack,
  normalizeDoctorReport,
  normalizeInstallState,
  normalizePreviewPlan,
} from "./normalize.ts";
import { installCompatRuntimeShims } from "./runtime-fixtures.ts";
import { listCompatFixtures } from "./fixtures.ts";

function manifestPathsFor(tempRoot: any, packIds: string[] | undefined) {
  return discoverPackManifestPaths(tempRoot)
    .map((manifestPath: string) => ({ manifestPath, manifest: loadPackManifest(manifestPath) }))
    .filter(({ manifest }: any) => (packIds ?? []).includes(manifest.pack.id))
    .sort((left: any, right: any) => left.manifest.pack.id.localeCompare(right.manifest.pack.id))
    .map(({ manifestPath }: any) => manifestPath);
}

function compileForRuntime(runtime: string | undefined, tempRoot: any, manifestPath: string) {
  return runtime === "codex_cli"
    ? compileCodexPack({ repoRoot: tempRoot, manifestPath })
    : compileCopilotPack({ repoRoot: tempRoot, manifestPath });
}

function laneOverrides(runtime: string | undefined, target: any) {
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
}: { workspaceRoot?: any; tempRoot?: any; homeRoot?: any; runtimeBinRoot?: any; packIds?: string[]; runtime?: string; target?: any }) {
  const overrides = laneOverrides(runtime, target);
  const markers = buildPathMarkers({
    workspaceRoot,
    repoRoot: tempRoot,
    homeRoot,
    runtimeBinRoot,
  });
  const compiled = manifestPathsFor(tempRoot, packIds)
    .map((manifestPath: string) => compileForRuntime(runtime, tempRoot, manifestPath))
    .map((pack: any) => normalizeCompiledPack(pack, markers));

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

  const snapshot: any = {
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
      errors: preview.plan.errors.map((error: any) => error),
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

export function buildCompatFixtureSnapshot({ repoRoot: workspaceRoot, fixtureId }: any) {
  const materialized = materializeCompatFixture({
    repoRoot: workspaceRoot,
    fixtureId,
  });
  const runtimeHarness = installCompatRuntimeShims();

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

export function buildCompatSnapshot({ repoRoot: workspaceRoot }: any) {
  return {
    kind: "compat-lab-snapshot-suite",
    fixtures: listCompatFixtures().map((fixture: any) =>
      buildCompatFixtureSnapshot({
        repoRoot: workspaceRoot,
        fixtureId: fixture.id,
      })
    ),
  };
}
