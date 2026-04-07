import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import YAML from "yaml";

import { exists, relativeFrom, walkFiles } from "./utils.js";

const PROJECT_MEMORY_ROOT = ".pairslash/project-memory/";
const PROJECT_MEMORY_INDEX_PATH = ".pairslash/project-memory/90-memory-index.yaml";
const RECORD_EXTENSIONS = new Set([".yaml", ".yml"]);
const LAYER_PRECEDENCE = [
  "global-project-memory",
  "task-memory",
  "session",
  "staging",
  "audit-log",
];
const LAYER_ALIASES = {
  sessions: "session",
};
const GENERIC_READ_WORKFLOW_PROFILE = {
  profile_id: "generic-read-profile",
  required_fields: ["runtime", "target"],
  optional_fields: ["packs", "format", "strict", "source"],
  sections: [
    ["summary", "Summary"],
    ["details", "Details"],
  ],
  failure_categories: [],
  read_layers: [
    {
      layer: "global-project-memory",
      label: "Global Project Memory",
      authority: "authoritative",
      resolution_mode: "project-memory-index",
      paths: [PROJECT_MEMORY_INDEX_PATH, PROJECT_MEMORY_ROOT],
    },
  ],
};

export const READ_WORKFLOW_PROFILES = {
  "pairslash-onboard-repo": {
    profile_id: "pairslash-onboard-repo",
    required_fields: ["repo_root"],
    optional_fields: ["focus", "include_memory_candidates"],
    sections: [
      ["repository_snapshot", "Repository snapshot"],
      ["runtime_compatibility", "Runtime compatibility"],
      ["memory_model_status", "Memory model status"],
      ["risks_and_gaps", "Risks and gaps"],
      ["recommended_next_workflows", "Recommended next workflows"],
    ],
    failure_categories: [
      {
        code: "CONTRACT-REPO-MISSING",
        type: "validation-failure",
        retryable: true,
        description: "Repository root must resolve before onboarding can proceed.",
      },
    ],
    read_layers: [
      {
        layer: "global-project-memory",
        label: "Global Project Memory",
        authority: "authoritative",
        resolution_mode: "project-memory-index",
        paths: [PROJECT_MEMORY_INDEX_PATH, PROJECT_MEMORY_ROOT],
      },
      {
        layer: "task-memory",
        label: "Task Memory",
        authority: "supporting",
        resolution_mode: "filesystem-scan",
        paths: [".pairslash/task-memory/"],
      },
    ],
  },
  "pairslash-plan": {
    profile_id: "pairslash-plan",
    required_fields: ["goal"],
    optional_fields: ["scope_hint", "constraints"],
    sections: [
      ["goal", "Goal"],
      ["constraints", "Constraints"],
      ["relevant_project_memory", "Relevant project memory"],
      ["proposed_steps", "Proposed steps"],
      ["files_likely_affected", "Files likely affected"],
      ["tests_and_checks", "Tests and checks"],
      ["risks", "Risks"],
      ["rollback", "Rollback"],
      ["open_questions", "Open questions"],
    ],
    failure_categories: [
      {
        code: "CONTRACT-GOAL-INCOMPLETE",
        type: "validation-failure",
        retryable: true,
        description: "Plan generation requires a concrete goal before actionable steps can be emitted.",
      },
      {
        code: "CONTRACT-PROJECT-MEMORY-GAP",
        type: "tool-unavailable",
        retryable: true,
        description: "Project memory gaps must be surfaced explicitly instead of silently omitted.",
      },
    ],
    read_layers: [
      {
        layer: "global-project-memory",
        label: "Global Project Memory",
        authority: "authoritative",
        resolution_mode: "explicit-paths",
        paths: [
          ".pairslash/project-memory/00-project-charter.yaml",
          ".pairslash/project-memory/10-stack-profile.yaml",
          ".pairslash/project-memory/50-constraints.yaml",
          PROJECT_MEMORY_INDEX_PATH,
        ],
      },
      {
        layer: "task-memory",
        label: "Task Memory",
        authority: "supporting",
        resolution_mode: "filesystem-scan",
        paths: [".pairslash/task-memory/"],
      },
    ],
  },
  "pairslash-review": {
    profile_id: "pairslash-review",
    required_fields: ["review_subject", "diff_source"],
    optional_fields: ["scope_hint", "strictness"],
    sections: [
      ["summary", "Summary"],
      ["findings", "Findings"],
      ["missing_tests", "Missing tests"],
      ["open_questions", "Open questions"],
      ["recommendation", "Recommendation"],
    ],
    failure_categories: [
      {
        code: "CONTRACT-DIFF-MISSING",
        type: "validation-failure",
        retryable: true,
        description: "Review workflow requires an explicit diff or patch source.",
      },
    ],
    read_layers: [
      {
        layer: "global-project-memory",
        label: "Global Project Memory",
        authority: "authoritative",
        resolution_mode: "project-memory-index",
        paths: [PROJECT_MEMORY_INDEX_PATH, PROJECT_MEMORY_ROOT],
      },
      {
        layer: "task-memory",
        label: "Task Memory",
        authority: "supporting",
        resolution_mode: "filesystem-scan",
        paths: [".pairslash/task-memory/"],
      },
    ],
  },
  "pairslash-command-suggest": {
    profile_id: "pairslash-command-suggest",
    required_fields: ["intent"],
    optional_fields: ["scope_hint", "platform"],
    sections: [
      ["intent_summary", "Intent summary"],
      ["suggested_commands", "Suggested commands"],
      ["safety_notes", "Safety notes"],
      ["follow_up_workflow", "Follow-up workflow"],
    ],
    failure_categories: [
      {
        code: "CONTRACT-INTENT-MISSING",
        type: "validation-failure",
        retryable: true,
        description: "Command suggestion requires a concrete user intent.",
      },
    ],
    read_layers: [
      {
        layer: "global-project-memory",
        label: "Global Project Memory",
        authority: "authoritative",
        resolution_mode: "explicit-paths",
        paths: [
          ".pairslash/project-memory/10-stack-profile.yaml",
          ".pairslash/project-memory/20-commands.yaml",
          ".pairslash/project-memory/50-constraints.yaml",
          PROJECT_MEMORY_INDEX_PATH,
        ],
      },
    ],
  },
  "pairslash-memory-candidate": {
    profile_id: "pairslash-memory-candidate",
    required_fields: ["task_scope"],
    optional_fields: ["evidence_sources", "strictness", "max_candidates"],
    sections: [
      ["plan", "PLAN"],
      ["candidates", "CANDIDATES"],
      ["reconciliation", "RECONCILIATION"],
      ["next_action", "NEXT_ACTION"],
    ],
    failure_categories: [
      {
        code: "CONTRACT-TASK-SCOPE-MISSING",
        type: "validation-failure",
        retryable: true,
        description: "Candidate extraction requires an explicit task scope.",
      },
      {
        code: "CONTRACT-RECONCILIATION-REQUIRED",
        type: "policy-blocked",
        retryable: true,
        description: "Candidate extraction cannot claim durable novelty without authoritative reconciliation.",
      },
    ],
    read_layers: [
      {
        layer: "global-project-memory",
        label: "Global Project Memory",
        authority: "authoritative",
        resolution_mode: "project-memory-index",
        paths: [PROJECT_MEMORY_INDEX_PATH, PROJECT_MEMORY_ROOT],
      },
      {
        layer: "task-memory",
        label: "Task Memory",
        authority: "supporting",
        resolution_mode: "filesystem-scan",
        paths: [".pairslash/task-memory/"],
      },
      {
        layer: "session",
        label: "Session Artifacts",
        authority: "supporting",
        resolution_mode: "filesystem-scan",
        paths: [".pairslash/sessions/"],
      },
      {
        layer: "staging",
        label: "Staging Artifacts",
        authority: "supporting",
        resolution_mode: "filesystem-scan",
        paths: [".pairslash/staging/"],
      },
      {
        layer: "audit-log",
        label: "Audit Log",
        authority: "supporting",
        resolution_mode: "filesystem-scan",
        paths: [".pairslash/audit-log/"],
      },
    ],
  },
  "pairslash-memory-audit": {
    profile_id: "pairslash-memory-audit",
    required_fields: ["audit_scope"],
    optional_fields: ["mode", "focus"],
    sections: [
      ["plan", "PLAN"],
      ["findings", "FINDINGS"],
      ["summary", "SUMMARY"],
      ["remediation_order", "REMEDIATION_ORDER"],
      ["next_action", "NEXT_ACTION"],
    ],
    failure_categories: [
      {
        code: "CONTRACT-AUDIT-SCOPE-MISSING",
        type: "validation-failure",
        retryable: true,
        description: "Memory audit requires an explicit audit scope.",
      },
    ],
    read_layers: [
      {
        layer: "global-project-memory",
        label: "Global Project Memory",
        authority: "authoritative",
        resolution_mode: "project-memory-index",
        paths: [PROJECT_MEMORY_INDEX_PATH, PROJECT_MEMORY_ROOT],
      },
      {
        layer: "task-memory",
        label: "Task Memory",
        authority: "supporting",
        resolution_mode: "filesystem-scan",
        paths: [".pairslash/task-memory/"],
      },
      {
        layer: "audit-log",
        label: "Audit Log",
        authority: "supporting",
        resolution_mode: "filesystem-scan",
        paths: [".pairslash/audit-log/"],
      },
    ],
  },
};

function cloneProfile(profile) {
  return structuredClone(profile);
}

function normalizePackId(input) {
  if (typeof input === "string") {
    return input;
  }
  if (input && typeof input === "object") {
    return input.pack_name ?? input.pack_id ?? null;
  }
  return null;
}

function normalizeLayerId(layerId) {
  return LAYER_ALIASES[layerId] ?? layerId;
}

function layerOrderIndex(layerId) {
  const normalized = normalizeLayerId(layerId);
  const index = LAYER_PRECEDENCE.indexOf(normalized);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function normalizeLayerDefinition(layer) {
  const normalizedLayer = normalizeLayerId(layer.layer);
  if (normalizedLayer === layer.layer) {
    return layer;
  }
  return {
    ...layer,
    layer: normalizedLayer,
  };
}

function withCanonicalLayerOrder(profile) {
  return {
    ...profile,
    read_layers: profile.read_layers
      .map(normalizeLayerDefinition)
      .sort((left, right) => layerOrderIndex(left.layer) - layerOrderIndex(right.layer)),
  };
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function uniqueValues(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

function toRepoRelativePath(repoRoot, absolutePath) {
  const relativePath = relativeFrom(repoRoot, absolutePath);
  return relativePath.startsWith(".")
    ? relativePath
    : `.${relativePath.startsWith("/") ? "" : "/"}${relativePath}`;
}

function parseYamlDocuments(filePath) {
  return YAML.parseAllDocuments(readFileSync(filePath, "utf8"))
    .map((document) => document.toJSON())
    .filter(Boolean);
}

function createLayerResult(layer, precedence) {
  return {
    layer: layer.layer,
    label: layer.label,
    precedence,
    authority: layer.authority,
    resolution_mode: layer.resolution_mode,
    resolution_status: "missing",
    configured_paths: layer.paths.slice(),
    resolved_paths: [],
    missing_paths: [],
    warnings: [],
    resolved_records: [],
  };
}

function addUnique(target, value) {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function addRecord(target, record) {
  const key = `${record.file}::${record.kind ?? ""}::${record.title ?? ""}`;
  if (!target.some((entry) => `${entry.file}::${entry.kind ?? ""}::${entry.title ?? ""}` === key)) {
    target.push(record);
  }
}

function updateLayerStatus(layer) {
  if (layer.resolved_paths.length === 0 && layer.missing_paths.length > 0) {
    layer.resolution_status = "missing";
    return;
  }
  if (layer.missing_paths.length > 0 || layer.warnings.length > 0) {
    layer.resolution_status = "partial";
    return;
  }
  layer.resolution_status = "resolved";
}

function resolveFilesystemPaths(repoRoot, configuredPath) {
  const absolutePath = resolve(repoRoot, configuredPath);
  if (!exists(absolutePath)) {
    return {
      resolved_paths: [],
      missing_paths: [configuredPath],
    };
  }
  if (configuredPath.endsWith("/")) {
    return {
      resolved_paths: walkFiles(absolutePath).map((path) => toRepoRelativePath(repoRoot, path)),
      missing_paths: [],
    };
  }
  return {
    resolved_paths: [configuredPath],
    missing_paths: [],
  };
}

function loadProjectMemoryIndex(repoRoot) {
  const absolutePath = resolve(repoRoot, PROJECT_MEMORY_INDEX_PATH);
  if (!exists(absolutePath)) {
    return {
      path: PROJECT_MEMORY_INDEX_PATH,
      available: false,
      warnings: [`missing:${PROJECT_MEMORY_INDEX_PATH}`],
      active_records: [],
      records_by_file: new Map(),
    };
  }
  try {
    const parsed = YAML.parse(readFileSync(absolutePath, "utf8")) ?? {};
    const sourceRecords = Array.isArray(parsed.records) ? parsed.records : [];
    const activeRecords = [];
    const recordsByFile = new Map();
    for (const entry of sourceRecords) {
      if (!entry || typeof entry !== "object" || typeof entry.file !== "string" || entry.file.trim() === "") {
        continue;
      }
      if (entry.status !== "active") {
        continue;
      }
      const record = {
        file: `${PROJECT_MEMORY_ROOT}${entry.file}`.replace("//", "/"),
        kind: entry.kind ?? null,
        title: entry.title ?? null,
        status: entry.status ?? null,
        scope: entry.scope ?? null,
        scope_detail: entry.scope_detail ?? null,
      };
      activeRecords.push(record);
      const bucket = recordsByFile.get(record.file) ?? [];
      bucket.push(record);
      recordsByFile.set(record.file, bucket);
    }
    return {
      path: PROJECT_MEMORY_INDEX_PATH,
      available: true,
      warnings: [],
      active_records: activeRecords,
      records_by_file: recordsByFile,
    };
  } catch (error) {
    return {
      path: PROJECT_MEMORY_INDEX_PATH,
      available: false,
      warnings: [`unreadable:${PROJECT_MEMORY_INDEX_PATH}:${error.message}`],
      active_records: [],
      records_by_file: new Map(),
    };
  }
}

function resolveGlobalProjectMemoryLayer(repoRoot, layer, precedence, projectMemoryIndex) {
  const result = createLayerResult(layer, precedence);
  for (const configuredPath of layer.paths) {
    if (configuredPath === PROJECT_MEMORY_INDEX_PATH) {
      const resolution = resolveFilesystemPaths(repoRoot, configuredPath);
      for (const path of resolution.resolved_paths) {
        addUnique(result.resolved_paths, path);
      }
      for (const path of resolution.missing_paths) {
        addUnique(result.missing_paths, path);
      }
      if (!projectMemoryIndex.available) {
        for (const warning of projectMemoryIndex.warnings) {
          addUnique(result.warnings, warning);
        }
      }
      continue;
    }
    if (layer.resolution_mode === "project-memory-index" && configuredPath === PROJECT_MEMORY_ROOT) {
      if (projectMemoryIndex.available) {
        for (const record of projectMemoryIndex.active_records) {
          const absolutePath = resolve(repoRoot, record.file);
          if (exists(absolutePath)) {
            addUnique(result.resolved_paths, record.file);
          } else {
            addUnique(result.missing_paths, record.file);
          }
          addRecord(result.resolved_records, record);
        }
        continue;
      }
      const resolution = resolveFilesystemPaths(repoRoot, configuredPath);
      for (const path of resolution.resolved_paths) {
        addUnique(result.resolved_paths, path);
      }
      for (const path of resolution.missing_paths) {
        addUnique(result.missing_paths, path);
      }
      for (const warning of projectMemoryIndex.warnings) {
        addUnique(result.warnings, warning);
      }
      addUnique(result.warnings, `fallback:filesystem-scan:${configuredPath}`);
      continue;
    }
    const resolution = resolveFilesystemPaths(repoRoot, configuredPath);
    for (const path of resolution.resolved_paths) {
      addUnique(result.resolved_paths, path);
      for (const record of projectMemoryIndex.records_by_file.get(path) ?? []) {
        addRecord(result.resolved_records, record);
      }
    }
    for (const path of resolution.missing_paths) {
      addUnique(result.missing_paths, path);
    }
  }
  updateLayerStatus(result);
  return result;
}

function resolveSupportingLayer(repoRoot, layer, precedence) {
  const result = createLayerResult(layer, precedence);
  for (const configuredPath of layer.paths) {
    const resolution = resolveFilesystemPaths(repoRoot, configuredPath);
    for (const path of resolution.resolved_paths) {
      addUnique(result.resolved_paths, path);
    }
    for (const path of resolution.missing_paths) {
      addUnique(result.missing_paths, path);
    }
  }
  updateLayerStatus(result);
  return result;
}

function coerceProfile(input, options) {
  if (input && typeof input === "object" && Array.isArray(input.read_layers)) {
    return withCanonicalLayerOrder(input);
  }
  return getReadWorkflowProfile(input, options);
}

function buildClaimKey(record) {
  return [
    normalizeText(record.kind),
    normalizeText(record.title),
    normalizeText(record.scope),
    normalizeText(record.scope_detail),
  ].join("|");
}

function coerceRecordForClaim(rawRecord, layerId) {
  if (!rawRecord || typeof rawRecord !== "object") {
    return null;
  }
  if (
    layerId === "staging" &&
    rawRecord.kind === "memory-write-staging-artifact" &&
    rawRecord.request?.record &&
    typeof rawRecord.request.record === "object"
  ) {
    const candidate = rawRecord.request.record;
    if (typeof candidate.kind === "string" && typeof candidate.title === "string") {
      return candidate;
    }
    return null;
  }
  if (typeof rawRecord.kind === "string" && typeof rawRecord.title === "string") {
    return rawRecord;
  }
  return null;
}

function extractLayerClaimRecords({ repoRoot, layer }) {
  const claims = [];
  const warnings = [];
  for (const relativePath of layer.resolved_paths) {
    if (!RECORD_EXTENSIONS.has(extname(relativePath).toLowerCase())) {
      continue;
    }
    const absolutePath = resolve(repoRoot, relativePath);
    try {
      const documents = parseYamlDocuments(absolutePath);
      for (const document of documents) {
        const record = coerceRecordForClaim(document, layer.layer);
        if (!record) {
          continue;
        }
        claims.push({
          claim_key: buildClaimKey(record),
          layer: layer.layer,
          precedence: layer.precedence,
          authority: layer.authority,
          file: relativePath,
          kind: record.kind,
          title: record.title,
          scope: typeof record.scope === "string" ? record.scope : null,
          scope_detail: typeof record.scope_detail === "string" ? record.scope_detail : null,
          statement: typeof record.statement === "string" ? record.statement : null,
        });
      }
    } catch (error) {
      warnings.push(`unreadable-claim-source:${relativePath}:${error.message}`);
    }
  }
  return { claims, warnings };
}

function buildRecordResolution({ layers, claimRecords }) {
  const sortedClaims = claimRecords
    .slice()
    .sort((left, right) => {
      if (left.precedence !== right.precedence) {
        return left.precedence - right.precedence;
      }
      if (left.file !== right.file) {
        return left.file.localeCompare(right.file);
      }
      return left.claim_key.localeCompare(right.claim_key);
    });
  const grouped = new Map();
  for (const claim of sortedClaims) {
    const bucket = grouped.get(claim.claim_key) ?? [];
    bucket.push(claim);
    grouped.set(claim.claim_key, bucket);
  }
  const resolvedClaims = [];
  const conflicts = [];
  const gapFills = [];
  for (const [claimKey, candidates] of grouped.entries()) {
    const selected = candidates[0];
    const shadowed = candidates.slice(1).map((entry) => {
      const selectedStatement = normalizeText(selected.statement);
      const shadowedStatement = normalizeText(entry.statement);
      const statementConflict =
        selectedStatement !== "" &&
        shadowedStatement !== "" &&
        selectedStatement !== shadowedStatement;
      const reasonBase =
        selected.authority === "authoritative"
          ? "shadowed-by-authoritative"
          : "shadowed-by-lower-authority-fill";
      const reason = statementConflict ? `${reasonBase}-conflict` : reasonBase;
      if (statementConflict) {
        conflicts.push({
          claim_key: claimKey,
          selected_layer: selected.layer,
          selected_authority: selected.authority,
          selected_file: selected.file,
          shadowed_layer: entry.layer,
          shadowed_authority: entry.authority,
          shadowed_file: entry.file,
          reason,
        });
      }
      return {
        layer: entry.layer,
        authority: entry.authority,
        file: entry.file,
        reason,
      };
    });
    const resolutionType =
      selected.authority === "authoritative" ? "authoritative-selected" : "supporting-gap-fill";
    const resolvedClaim = {
      claim_key: claimKey,
      kind: selected.kind,
      title: selected.title,
      scope: selected.scope,
      scope_detail: selected.scope_detail,
      selected: {
        layer: selected.layer,
        authority: selected.authority,
        file: selected.file,
      },
      resolution_type: resolutionType,
      shadowed,
    };
    resolvedClaims.push(resolvedClaim);
    if (resolutionType === "supporting-gap-fill") {
      gapFills.push({
        claim_key: claimKey,
        kind: selected.kind,
        title: selected.title,
        selected_layer: selected.layer,
        selected_file: selected.file,
      });
    }
  }
  resolvedClaims.sort((left, right) => left.claim_key.localeCompare(right.claim_key));
  conflicts.sort((left, right) => left.claim_key.localeCompare(right.claim_key));
  gapFills.sort((left, right) => left.claim_key.localeCompare(right.claim_key));

  const byLayer = new Map();
  for (const claim of claimRecords) {
    const bucket = byLayer.get(claim.layer) ?? [];
    addRecord(bucket, {
      file: claim.file,
      kind: claim.kind,
      title: claim.title,
      status: null,
      scope: claim.scope,
      scope_detail: claim.scope_detail,
    });
    byLayer.set(claim.layer, bucket);
  }
  for (const layer of layers) {
    for (const claimRecord of byLayer.get(layer.layer) ?? []) {
      addRecord(layer.resolved_records, claimRecord);
    }
  }

  return {
    precedence_rule: LAYER_PRECEDENCE.slice(),
    resolved_claims: resolvedClaims,
    conflicts,
    gap_fills: gapFills,
  };
}

export function getReadWorkflowProfile(input, { includeFallback = false } = {}) {
  const packId = normalizePackId(input);
  const profile = packId ? READ_WORKFLOW_PROFILES[packId] : null;
  if (profile) {
    return withCanonicalLayerOrder(cloneProfile(profile));
  }
  return includeFallback ? withCanonicalLayerOrder(cloneProfile(GENERIC_READ_WORKFLOW_PROFILE)) : null;
}

export function listReadWorkflowPaths(input, { includeFallback = false } = {}) {
  const profile = coerceProfile(input, { includeFallback });
  if (!profile) {
    return [];
  }
  return uniqueValues(profile.read_layers.flatMap((layer) => layer.paths));
}

export function resolveReadAuthority({ repoRoot, packId = null, manifest = null } = {}) {
  const profile = getReadWorkflowProfile(manifest ?? packId, { includeFallback: true });
  const projectMemoryIndex = loadProjectMemoryIndex(repoRoot);
  const layers = profile.read_layers.map((layer, index) =>
    layer.layer === "global-project-memory"
      ? resolveGlobalProjectMemoryLayer(repoRoot, layer, index + 1, projectMemoryIndex)
      : resolveSupportingLayer(repoRoot, layer, index + 1),
  );
  const claimRecords = [];
  for (const layer of layers) {
    const extracted = extractLayerClaimRecords({ repoRoot, layer });
    for (const claim of extracted.claims) {
      claimRecords.push(claim);
    }
    for (const warning of extracted.warnings) {
      addUnique(layer.warnings, warning);
    }
    updateLayerStatus(layer);
  }
  const authoritativeSources = uniqueValues(
    layers
      .filter((layer) => layer.authority === "authoritative")
      .flatMap((layer) => layer.resolved_paths),
  );
  const warnings = uniqueValues(layers.flatMap((layer) => layer.warnings));
  const missingPaths = uniqueValues(layers.flatMap((layer) => layer.missing_paths));
  const recordResolution = buildRecordResolution({ layers, claimRecords });

  return {
    profile_id: profile.profile_id,
    uses_shared_loader: true,
    authoritative_sources: authoritativeSources,
    missing_paths: missingPaths,
    warnings,
    layers,
    record_resolution: recordResolution,
  };
}
