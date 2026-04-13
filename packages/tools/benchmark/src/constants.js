export const PHASE19_BENCHMARK_SCHEMA_VERSION = "0.1.0";

export const PHASE19_DOCS_ROOT = "docs-private/validation/phase-3-5";
export const PHASE19_SCENARIOS_DIR = `${PHASE19_DOCS_ROOT}/scenarios`;
export const PHASE19_RUNS_DIR = `${PHASE19_DOCS_ROOT}/runs`;
export const PHASE19_CASE_STUDIES_DIR = `${PHASE19_DOCS_ROOT}/case-studies`;

export const PHASE19_RUN_INDEX_PATH = `${PHASE19_RUNS_DIR}/index.json`;
export const PHASE19_ROUND1_SCORE_PATH = `${PHASE19_RUNS_DIR}/round1-score.json`;

export const REQUIRED_ROUND_ONE_TASK_IDS = ["W1", "W2a", "W2b", "W3"];
export const REQUIRED_SCENARIO_TASK_IDS = ["C1", ...REQUIRED_ROUND_ONE_TASK_IDS];

export const PRIMARY_TEXT_FIELDS_FOR_WORDING_CHECK = [
  "task_statement",
  "weekly_reuse_reason",
  "negative_evidence_note",
  "baseline_method",
  "pairslash_method",
];

export const LANE_SUPPORT_LEVEL_ALIASES = Object.freeze({
  "stable-tested": "stable_tested",
  stable_tested: "stable_tested",
  degraded: "degraded",
  prep: "prep",
  preview: "preview",
  blocked: "blocked",
  unsupported: "unsupported",
});
