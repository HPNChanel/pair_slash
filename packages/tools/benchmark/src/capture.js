import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

import {
  ensureDir,
  relativeFrom,
  sha256,
  stableJson,
  writeTextFile,
} from "@pairslash/spec-core";

import { parseStructuredFile } from "./io.js";
import { buildPhase19Paths } from "./paths.js";
import { validateBenchmarkRunRecord } from "./run-record.js";
import { buildScenarioIndex, loadScenarioDefinitions, validateScenarioDefinitions } from "./scenarios.js";
import { loadPhase19BenchmarkContext } from "./truth.js";

function loadRunInput(repoRoot, { inputPath = null, runRecord = null } = {}) {
  if (runRecord && typeof runRecord === "object") {
    return runRecord;
  }
  if (!inputPath) {
    throw new Error("capture requires --input <path> or runRecord object");
  }
  return parseStructuredFile(resolve(repoRoot, inputPath));
}

function resolveArtifactPath(repoRoot, runDir, ref) {
  if (isAbsolute(ref)) {
    return ref;
  }
  if (ref.startsWith("./") || ref.startsWith("../")) {
    return resolve(runDir, ref);
  }
  return resolve(repoRoot, ref);
}

function digestFile(path) {
  const buffer = readFileSync(path);
  return {
    sha256: sha256(buffer),
    size_bytes: buffer.byteLength,
  };
}

function buildArtifactManifest({ repoRoot, runDir, runRecord }) {
  const artifacts = (runRecord.artifact_refs ?? [])
    .map((ref) => {
      const absolutePath = resolveArtifactPath(repoRoot, runDir, ref);
      const present = existsSync(absolutePath);
      const digest = present ? digestFile(absolutePath) : { sha256: null, size_bytes: null };
      return {
        ref,
        absolute_path: absolutePath,
        repo_relative_path: relativeFrom(repoRoot, absolutePath),
        exists: present,
        sha256: digest.sha256,
        size_bytes: digest.size_bytes,
      };
    })
    .sort((left, right) => left.ref.localeCompare(right.ref));

  return {
    kind: "phase19-benchmark-artifact-manifest",
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    run_id: runRecord.run_id,
    artifact_count: artifacts.length,
    missing_artifact_count: artifacts.filter((artifact) => artifact.exists !== true).length,
    artifacts,
  };
}

function buildReplayManifest({ runRecord, artifactManifest }) {
  return {
    kind: "phase19-benchmark-replay-manifest",
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    run_id: runRecord.run_id,
    run_digest_sha256: sha256(stableJson(runRecord)),
    artifact_digests: Object.fromEntries(
      artifactManifest.artifacts
        .filter((artifact) => artifact.exists)
        .map((artifact) => [artifact.ref, artifact.sha256]),
    ),
  };
}

function loadRunIndex(runIndexPath) {
  if (!existsSync(runIndexPath)) {
    return {
      kind: "phase19-benchmark-run-index",
      schema_version: "1.0.0",
      generated_at: new Date().toISOString(),
      runs: [],
    };
  }
  return JSON.parse(readFileSync(runIndexPath, "utf8"));
}

function upsertRunIndex(runIndex, runEntry) {
  const rest = (runIndex.runs ?? []).filter((entry) => entry.run_id !== runEntry.run_id);
  const runs = [...rest, runEntry].sort((left, right) => left.run_id.localeCompare(right.run_id));
  return {
    ...runIndex,
    generated_at: new Date().toISOString(),
    runs,
  };
}

export function captureBenchmarkRun({
  repoRoot = process.cwd(),
  inputPath = null,
  runRecord = null,
  allowOverwrite = false,
} = {}) {
  const context = loadPhase19BenchmarkContext(repoRoot);
  const scenarios = loadScenarioDefinitions(repoRoot);
  const scenarioValidation = validateScenarioDefinitions(scenarios, context);
  if (!scenarioValidation.ok) {
    throw new Error(`scenario-validation-failed:${scenarioValidation.errors.join("|")}`);
  }

  const rawRunRecord = loadRunInput(repoRoot, { inputPath, runRecord });
  const runValidation = validateBenchmarkRunRecord(rawRunRecord, context, buildScenarioIndex(scenarios));
  if (!runValidation.ok) {
    throw new Error(`run-validation-failed:${runValidation.errors.join("|")}`);
  }

  const paths = buildPhase19Paths(repoRoot);
  const runId = runValidation.normalized_record.run_id;
  const runDir = join(paths.runsDir, runId);

  if (existsSync(runDir) && !allowOverwrite) {
    throw new Error(`run-already-exists:${runId}`);
  }

  ensureDir(runDir);

  const runPath = join(runDir, "run.json");
  const artifactManifest = buildArtifactManifest({
    repoRoot,
    runDir,
    runRecord: runValidation.normalized_record,
  });
  const replayManifest = buildReplayManifest({
    runRecord: runValidation.normalized_record,
    artifactManifest,
  });

  writeTextFile(runPath, stableJson(runValidation.normalized_record));
  writeTextFile(join(runDir, "artifacts.manifest.json"), stableJson(artifactManifest));
  writeTextFile(join(runDir, "replay.manifest.json"), stableJson(replayManifest));

  ensureDir(paths.runsDir);
  const runIndex = loadRunIndex(paths.runIndexPath);
  const nextRunIndex = upsertRunIndex(runIndex, {
    run_id: runId,
    task_card_id: runValidation.normalized_record.task_card_id,
    scenario_id: runValidation.normalized_record.scenario_id,
    workflow_id: runValidation.normalized_record.workflow_id,
    runtime_id: runValidation.normalized_record.runtime_id,
    lane_id: runValidation.normalized_record.lane_id,
    include_in_rollup: runValidation.normalized_record.include_in_rollup,
    captured_at: runValidation.normalized_record.validation_timestamp,
    paths: {
      run: relativeFrom(repoRoot, runPath),
      artifacts_manifest: relativeFrom(repoRoot, join(runDir, "artifacts.manifest.json")),
      replay_manifest: relativeFrom(repoRoot, join(runDir, "replay.manifest.json")),
    },
  });
  writeTextFile(paths.runIndexPath, stableJson(nextRunIndex));

  return {
    kind: "phase19-benchmark-capture",
    ok: true,
    run_id: runId,
    run_path: relativeFrom(repoRoot, runPath),
    artifact_manifest_path: relativeFrom(repoRoot, join(runDir, "artifacts.manifest.json")),
    replay_manifest_path: relativeFrom(repoRoot, join(runDir, "replay.manifest.json")),
    missing_artifact_count: artifactManifest.missing_artifact_count,
    warnings: runValidation.warnings,
  };
}
