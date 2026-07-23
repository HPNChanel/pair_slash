// PairSlash CLI argument parser.
//
// Phase M1 (modernization foundation): extracted from bin/pairslash.js.
// No behavioral change — the existing cli.test.js suite is the contract.

import { normalizeRuntime, normalizeTarget } from "@pairslash/spec-core";

import { INSTALL_PACK_SET_VALUES } from "./internals.ts";

export function defaultOptions() {
  return {
    runtime: "auto",
    target: "repo",
    packs: [],
    format: "text",
    apply: false,
    preview: false,
    dryRun: false,
    phase4: false,
    yes: false,
    nonInteractive: false,
    planOut: null,
    from: null,
    to: null,
    force: false,
    strict: false,
    packSet: "bootstrap",
    packSetProvided: false,
    requestPath: null,
    recordKind: null,
    title: null,
    statement: null,
    evidence: null,
    scope: null,
    scopeDetail: null,
    confidence: null,
    recordAction: null,
    tags: [],
    sourceRefs: [],
    supersedes: null,
    updatedBy: null,
    taskScope: null,
    evidenceSources: [],
    strictness: "strict-gate-fail-fast",
    maxCandidates: 20,
    auditScope: null,
    mode: "report-only",
    focus: [],
    sessionId: null,
    latest: false,
    out: null,
    bundle: false,
    supportBundle: false,
    includeDoctor: false,
    surface: null,
  };
}

function splitList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseOptions(argv) {
  const options = defaultOptions();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--runtime") {
      const runtime = argv[index + 1];
      options.runtime = runtime === "auto" || runtime === "all" ? runtime : normalizeRuntime(runtime);
      index += 1;
      continue;
    }
    if (token === "--target") {
      options.target = normalizeTarget(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--packs") {
      options.packs = splitList(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--pack-set") {
      const packSet = argv[index + 1];
      if (!INSTALL_PACK_SET_VALUES.includes(packSet)) {
        throw new Error(`invalid --pack-set value: ${packSet}; expected one of ${INSTALL_PACK_SET_VALUES.join(", ")}`);
      }
      options.packSet = packSet;
      options.packSetProvided = true;
      index += 1;
      continue;
    }
    if (token === "--all") {
      options.packSet = "core";
      options.packSetProvided = true;
      continue;
    }
    if (token === "--format") {
      options.format = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--apply") {
      options.apply = true;
      continue;
    }
    if (token === "--yes") {
      options.yes = true;
      continue;
    }
    if (token === "--non-interactive") {
      options.nonInteractive = true;
      continue;
    }
    if (token === "--preview") {
      options.preview = true;
      continue;
    }
    if (token === "--dry-run") {
      options.preview = true;
      options.dryRun = true;
      continue;
    }
    if (token === "--plan-out") {
      options.planOut = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--from") {
      options.from = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--to") {
      options.to = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--force") {
      options.force = true;
      continue;
    }
    if (token === "--phase4") {
      options.phase4 = true;
      continue;
    }
    if (token === "--strict") {
      options.strict = true;
      continue;
    }
    if (token === "--request") {
      options.requestPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--kind") {
      options.recordKind = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--title") {
      options.title = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--statement") {
      options.statement = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--evidence") {
      options.evidence = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--scope") {
      options.scope = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--scope-detail") {
      options.scopeDetail = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--confidence") {
      options.confidence = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--action") {
      options.recordAction = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--tags") {
      options.tags = splitList(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--source-refs") {
      options.sourceRefs = splitList(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--supersedes") {
      options.supersedes = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--updated-by") {
      options.updatedBy = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--task-scope") {
      options.taskScope = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--evidence-sources") {
      options.evidenceSources = splitList(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--strictness") {
      options.strictness = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--max-candidates") {
      const parsed = Number.parseInt(argv[index + 1], 10);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("invalid --max-candidates value: expected integer >= 1");
      }
      options.maxCandidates = parsed;
      index += 1;
      continue;
    }
    if (token === "--audit-scope") {
      options.auditScope = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--mode") {
      options.mode = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--focus") {
      options.focus = splitList(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--session") {
      options.sessionId = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--latest") {
      options.latest = true;
      continue;
    }
    if (token === "--out") {
      options.out = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--bundle") {
      options.bundle = true;
      continue;
    }
    if (token === "--support-bundle") {
      options.supportBundle = true;
      continue;
    }
    if (token === "--include-doctor") {
      options.includeDoctor = true;
      continue;
    }
    if (token === "--surface") {
      options.surface = argv[index + 1];
      index += 1;
      continue;
    }
    if (!token.startsWith("--")) {
      options.packs.push(token);
    }
  }
  options.packs = [...new Set(options.packs)];
  return options;
}
