import { compileCodexPack } from "@pairslash/compiler-codex";
import { compileCopilotPack } from "@pairslash/compiler-copilot";
import { applyInstall, planInstall } from "@pairslash/installer";
import { runDoctor } from "@pairslash/doctor";
import { discoverPackManifestPaths, loadPackManifest } from "@pairslash/spec-core";

import { materializeCompatFixture } from "./materialize.js";
import { installCompatRuntimeShims } from "./runtime-fixtures.js";

export const DEFAULT_SMOKE_LANES = [
  {
    id: "compile.node-service.codex",
    fixture_id: "repo-node-service",
    kind: "compile",
    runtime: "codex_cli",
  },
  {
    id: "compile.python-service.copilot",
    fixture_id: "repo-python-service",
    kind: "compile",
    runtime: "copilot_cli",
  },
  {
    id: "install.docs-heavy.codex.repo",
    fixture_id: "repo-docs-heavy",
    kind: "install",
    runtime: "codex_cli",
    target: "repo",
    os_override: "darwin",
    shell_override: "zsh",
  },
  {
    id: "install.infra-repo.copilot.user",
    fixture_id: "repo-infra-repo",
    kind: "install",
    runtime: "copilot_cli",
    target: "user",
    os_override: "linux",
    shell_override: "bash",
  },
  {
    id: "doctor.backend-mcp.codex.windows-prep",
    fixture_id: "repo-backend-mcp",
    kind: "doctor",
    runtime: "codex_cli",
    target: "repo",
    os_override: "win32",
    shell_override: "powershell",
  },
  {
    id: "install.conflict.copilot.repo",
    fixture_id: "repo-conflict-existing-runtime",
    kind: "install",
    runtime: "copilot_cli",
    target: "repo",
    os_override: "linux",
    shell_override: "bash",
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
    policy_summary: preview.plan.policy_summary ? { ...preview.plan.policy_summary } : null,
  };
  if (preview.plan.can_apply) {
    const result = applyInstall(preview);
    out.applied_packs = result.state.packs.map((pack) => pack.id);
  }
  return out;
}

function doctorLane({ tempRoot, lane, packIds }) {
  const report = runDoctor({
    repoRoot: tempRoot,
    runtime: lane.runtime,
    target: lane.target,
    packs: packIds,
    _os_override: lane.os_override,
    _shell_override: lane.shell_override,
  });
  return {
    support_verdict: report.support_verdict,
    lane_status: report.support_lane.lane_status,
    issue_count: report.issues.length,
  };
}

export function runCompatSmoke({ repoRoot, lanes = DEFAULT_SMOKE_LANES } = {}) {
  const runtimeHarness = installCompatRuntimeShims();
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
            lane,
            packIds,
          });
          results.push({
            id: lane.id,
            kind: lane.kind,
            runtime: lane.runtime,
            target: lane.target,
            ...install,
            support_verdict: doctor.support_verdict,
            lane_status: doctor.lane_status,
            issue_count: doctor.issue_count,
          });
          continue;
        }

        if (lane.kind === "doctor") {
          const doctor = doctorLane({
            tempRoot: materialized.tempRoot,
            lane,
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
