import { compileCodexPack } from "@pairslash/compiler-codex";
import { compileCopilotPack } from "@pairslash/compiler-copilot";
import { applyInstall, planInstall } from "@pairslash/installer";
import { runDoctor } from "@pairslash/doctor";
import { discoverPackManifestPaths, loadPackManifest } from "@pairslash/spec-core";

import { materializeCompatFixture } from "./materialize.js";
import { installFakeRuntimes } from "./runtime-fixtures.js";

export const DEFAULT_SMOKE_LANES = [
  {
    id: "compile.monorepo.copilot",
    fixture_id: "repo-monorepo-workspaces",
    kind: "compile",
    runtime: "copilot_cli",
    expect_bundle_kind: "copilot-package-bundle",
  },
  {
    id: "install.basic.codex.repo",
    fixture_id: "repo-basic-readonly",
    kind: "install",
    runtime: "codex_cli",
    target: "repo",
    expect_can_apply: true,
    expect_verdict: "pass",
  },
  {
    id: "install.basic.copilot.user",
    fixture_id: "repo-basic-readonly",
    kind: "install",
    runtime: "copilot_cli",
    target: "user",
    expect_can_apply: true,
    expect_verdict: "pass",
  },
  {
    id: "install.write-authority.codex.repo",
    fixture_id: "repo-write-authority-memory",
    kind: "install",
    runtime: "codex_cli",
    target: "repo",
    expect_can_apply: true,
    expect_verdict: "pass",
  },
  {
    id: "doctor.backend-mcp.codex.repo",
    fixture_id: "repo-backend-mcp",
    kind: "doctor",
    runtime: "codex_cli",
    target: "repo",
    expect_verdict: "degraded",
  },
  {
    id: "install.conflict.copilot.repo",
    fixture_id: "repo-conflict-existing-runtime",
    kind: "install",
    runtime: "copilot_cli",
    target: "repo",
    expect_can_apply: false,
    expect_verdict: "fail",
  },
];

function manifestPathsFor(tempRoot, packIds) {
  return discoverPackManifestPaths(tempRoot)
    .map((manifestPath) => ({ manifestPath, manifest: loadPackManifest(manifestPath) }))
    .filter(({ manifest }) => packIds.includes(manifest.pack.id))
    .sort((left, right) => left.manifest.pack.id.localeCompare(right.manifest.pack.id))
    .map(({ manifestPath }) => manifestPath);
}

function compileLane({ runtime, tempRoot, packIds }) {
  const compiled = manifestPathsFor(tempRoot, packIds).map((manifestPath) =>
    runtime === "codex_cli"
      ? compileCodexPack({ repoRoot: tempRoot, manifestPath })
      : compileCopilotPack({ repoRoot: tempRoot, manifestPath }),
  );
  return {
    bundle_kind: compiled[0]?.bundle_kind ?? null,
    pack_count: compiled.length,
  };
}

function installLane({ tempRoot, runtime, target, packIds }) {
  const preview = planInstall({
    repoRoot: tempRoot,
    runtime,
    target,
    packs: packIds,
  });
  const out = {
    can_apply: preview.plan.can_apply,
    summary: { ...preview.plan.summary },
    blocked_operations: preview.plan.operations.filter((operation) => operation.kind === "blocked_conflict").length,
  };
  if (preview.plan.can_apply) {
    const result = applyInstall(preview);
    out.applied_packs = result.state.packs.map((pack) => pack.id);
  }
  return out;
}

function doctorLane({ tempRoot, runtime, target, packIds }) {
  const report = runDoctor({
    repoRoot: tempRoot,
    runtime,
    target,
    packs: packIds,
  });
  return {
    support_verdict: report.support_verdict,
    issue_count: report.issues.length,
  };
}

export function runCompatSmoke({ repoRoot, lanes = DEFAULT_SMOKE_LANES } = {}) {
  const runtimeHarness = installFakeRuntimes();
  const results = [];

  try {
    for (const lane of lanes) {
      const materialized = materializeCompatFixture({
        repoRoot,
        fixtureId: lane.fixture_id,
      });
      try {
        if (lane.target === "user") {
          runtimeHarness.setHome(materialized.homeRoot);
        } else {
          runtimeHarness.restoreHome();
        }

        const packIds = materialized.fixture.source_packs.slice();
        if (lane.kind === "compile") {
          const result = compileLane({
            runtime: lane.runtime,
            tempRoot: materialized.tempRoot,
            packIds,
          });
          results.push({
            id: lane.id,
            kind: lane.kind,
            runtime: lane.runtime,
            target: lane.target ?? null,
            ...result,
          });
          continue;
        }

        if (lane.kind === "install") {
          const install = installLane({
            tempRoot: materialized.tempRoot,
            runtime: lane.runtime,
            target: lane.target,
            packIds,
          });
          const doctor = doctorLane({
            tempRoot: materialized.tempRoot,
            runtime: lane.runtime,
            target: lane.target,
            packIds,
          });
          results.push({
            id: lane.id,
            kind: lane.kind,
            runtime: lane.runtime,
            target: lane.target,
            ...install,
            support_verdict: doctor.support_verdict,
            issue_count: doctor.issue_count,
          });
          continue;
        }

        if (lane.kind === "doctor") {
          const doctor = doctorLane({
            tempRoot: materialized.tempRoot,
            runtime: lane.runtime,
            target: lane.target,
            packIds,
          });
          results.push({
            id: lane.id,
            kind: lane.kind,
            runtime: lane.runtime,
            target: lane.target,
            ...doctor,
          });
          continue;
        }

        throw new Error(`unsupported smoke lane kind: ${lane.kind}`);
      } finally {
        materialized.cleanup();
      }
    }
  } finally {
    runtimeHarness.cleanup();
  }

  return results;
}
