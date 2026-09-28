import {
  loadBenchmarkTruth,
  loadPackCatalogRecords,
  loadPublicSupportSnapshot,
} from "@pairslash/spec-core";

import { normalizeLaneSupportLevel } from "./run-record.ts";

export function loadPhase19BenchmarkContext(repoRoot: string = process.cwd()) {
  const benchmarkDocuments = loadBenchmarkTruth(repoRoot);
  const publicSupport = loadPublicSupportSnapshot(repoRoot);
  const catalogRecords = loadPackCatalogRecords(repoRoot, { includeAdvanced: false });

  const taskById = new Map(
    (benchmarkDocuments.taskCatalog?.official_tasks ?? []).map((task: any) => [task.task_card_id, task]),
  );
  const catalogByWorkflowId = new Map(
    catalogRecords
      .filter((record: any) => record.catalog_scope === "core")
      .map((record: any) => [record.id, record]),
  );
  const laneById = new Map(
    (publicSupport.runtime_lanes ?? []).map((lane: any) => [lane.lane_id, lane]),
  );
  const laneTemplateById = new Map(
    (benchmarkDocuments.laneWording?.round_one_lane_templates ?? []).map((lane: any) => [lane.lane_id, lane]),
  );

  return {
    repoRoot,
    benchmarkDocuments,
    publicSupport,
    catalogRecords,
    taskById,
    catalogByWorkflowId,
    laneById,
    laneTemplateById,
    primaryScoredLaneId:
      benchmarkDocuments.scoringRubric?.round_one_rollup_rules?.primary_scored_lane ?? null,
  };
}

export function getLaneTruth(context: any, laneId: any) {
  const lane = context.laneById.get(laneId) ?? null;
  if (!lane) {
    return null;
  }
  return {
    lane_id: lane.lane_id,
    runtime_id: lane.runtime_id,
    target: lane.target,
    os_lane: lane.os_lane,
    support_level: normalizeLaneSupportLevel(lane.support_level),
    support_semantics: lane.support_semantics,
    required_evidence_class: lane.required_evidence_class,
    actual_evidence_class: lane.actual_evidence_class,
  };
}
