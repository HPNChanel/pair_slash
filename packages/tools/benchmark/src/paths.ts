import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  PHASE19_CASE_STUDIES_DIR,
  PHASE19_DOCS_ROOT,
  PHASE19_ROUND1_SCORE_PATH,
  PHASE19_RUN_INDEX_PATH,
  PHASE19_RUNS_DIR,
  PHASE19_SCENARIOS_DIR,
} from "./constants.ts";

export function buildPhase19Paths(repoRoot: string = process.cwd()) {
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

export function resolveRunDir(repoRoot: string, runId: any) {
  return join(buildPhase19Paths(repoRoot).runsDir, runId);
}

export function resolveRunFile(repoRoot: string, runId: any) {
  return join(resolveRunDir(repoRoot, runId), "run.json");
}

export function listRunIds(repoRoot: string) {
  const runsDir = buildPhase19Paths(repoRoot).runsDir;
  if (!existsSync(runsDir)) {
    return [];
  }
  return readdirSync(runsDir, { withFileTypes: true })
    .filter((entry: any) => entry.isDirectory())
    .map((entry: any) => entry.name)
    .filter((runId: any) => existsSync(join(runsDir, runId, "run.json")))
    .sort((left: any, right: any) => left.localeCompare(right));
}

export function listScenarioFiles(repoRoot: string) {
  const scenariosDir = buildPhase19Paths(repoRoot).scenariosDir;
  if (!existsSync(scenariosDir)) {
    return [];
  }
  return readdirSync(scenariosDir, { withFileTypes: true })
    .filter((entry: any) => entry.isFile() && /\.(yaml|yml)$/i.test(entry.name))
    .map((entry: any) => join(scenariosDir, entry.name))
    .sort((left: any, right: any) => left.localeCompare(right));
}
