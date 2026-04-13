import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { sha256 } from "@pairslash/spec-core";

import { buildPhase19Paths, listRunIds, resolveRunDir } from "./paths.js";

function parseJson(pathLike) {
  return JSON.parse(readFileSync(pathLike, "utf8"));
}

function digestFile(pathLike) {
  return sha256(readFileSync(pathLike));
}

export function replayBenchmarkRun({ repoRoot = process.cwd(), runId }) {
  if (!runId) {
    throw new Error("replay requires runId");
  }

  const paths = buildPhase19Paths(repoRoot);
  const runDir = resolveRunDir(repoRoot, runId);
  const runPath = join(runDir, "run.json");
  const replayManifestPath = join(runDir, "replay.manifest.json");
  const artifactManifestPath = join(runDir, "artifacts.manifest.json");

  if (!existsSync(runPath) || !existsSync(replayManifestPath) || !existsSync(artifactManifestPath)) {
    throw new Error(`replay-missing-required-files:${runId}`);
  }

  const replayManifest = parseJson(replayManifestPath);
  const artifactManifest = parseJson(artifactManifestPath);

  const drifts = [];
  const runDigest = sha256(readFileSync(runPath));
  if (runDigest !== replayManifest.run_digest_sha256) {
    drifts.push("run.json digest drifted");
  }

  for (const artifact of artifactManifest.artifacts ?? []) {
    const expected = replayManifest.artifact_digests?.[artifact.ref] ?? null;
    if (!artifact.exists) {
      drifts.push(`artifact missing: ${artifact.ref}`);
      continue;
    }
    const actual = digestFile(artifact.absolute_path);
    if (expected && expected !== actual) {
      drifts.push(`artifact digest drift: ${artifact.ref}`);
    }
  }

  return {
    kind: "phase19-benchmark-replay",
    run_id: runId,
    ok: drifts.length === 0,
    drift_count: drifts.length,
    drifts,
    replay_manifest_path: replayManifestPath,
    artifact_manifest_path: artifactManifestPath,
    runs_root: paths.runsDir,
  };
}

export function replayBenchmarkRuns({ repoRoot = process.cwd(), runIds = null } = {}) {
  const ids = runIds && runIds.length > 0 ? runIds : listRunIds(repoRoot);
  const reports = ids.map((runId) => replayBenchmarkRun({ repoRoot, runId }));
  return {
    kind: "phase19-benchmark-replay-suite",
    generated_at: new Date().toISOString(),
    run_count: reports.length,
    pass_count: reports.filter((report) => report.ok).length,
    fail_count: reports.filter((report) => !report.ok).length,
    reports,
  };
}

export function formatReplayReportText(report) {
  if (report.kind === "phase19-benchmark-replay") {
    const lines = [
      `Replay run: ${report.run_id}`,
      `Status: ${report.ok ? "PASS" : "FAIL"}`,
      `Drifts: ${report.drift_count}`,
    ];
    for (const drift of report.drifts) {
      lines.push(`- ${drift}`);
    }
    return `${lines.join("\n")}\n`;
  }

  const lines = [
    "Replay suite",
    `Run count: ${report.run_count}`,
    `Pass: ${report.pass_count}`,
    `Fail: ${report.fail_count}`,
  ];

  for (const entry of report.reports) {
    lines.push(`- ${entry.run_id}: ${entry.ok ? "PASS" : "FAIL"}`);
  }

  return `${lines.join("\n")}\n`;
}
