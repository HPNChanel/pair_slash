import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  PHASE19_CASE_STUDIES_DIR,
  PHASE19_DOCS_ROOT,
  PHASE19_ROUND1_SCORE_PATH,
  PHASE19_RUN_INDEX_PATH,
  PHASE19_RUNS_DIR,
  PHASE19_SCENARIOS_DIR,
} from "./constants.js";

export function buildPhase19Paths(repoRoot = process.cwd()) {
  const root = resolve(repoRoot);
  return {
    repoRoot: root,
    docsRoot: resolve(root, PHASE19_DOCS_ROOT),
    scenariosDir: resolve(root, PHASE19_SCENARIOS_DIR),
    runsDir: resolve(root, PHASE19_RUNS_DIR),
    caseStudiesDir: resolve(root, PHASE19_CASE_STUDIES_DIR),
    runIndexPath: resolve(root, PHASE19_RUN_INDEX_PATH),
    roundOneScorePath: resolve(root, PHASE19_ROUND1_SCORE_PATH),
  };
}

export function resolveRunDir(repoRoot, runId) {
  return join(buildPhase19Paths(repoRoot).runsDir, runId);
}

export function resolveRunFile(repoRoot, runId) {
  return join(resolveRunDir(repoRoot, runId), "run.json");
}

export function listRunIds(repoRoot) {
  const runsDir = buildPhase19Paths(repoRoot).runsDir;
  if (!existsSync(runsDir)) {
    return [];
  }
  return readdirSync(runsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((runId) => existsSync(join(runsDir, runId, "run.json")))
    .sort((left, right) => left.localeCompare(right));
}

export function listScenarioFiles(repoRoot) {
  const scenariosDir = buildPhase19Paths(repoRoot).scenariosDir;
  if (!existsSync(scenariosDir)) {
    return [];
  }
  return readdirSync(scenariosDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(yaml|yml)$/i.test(entry.name))
    .map((entry) => join(scenariosDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
}
