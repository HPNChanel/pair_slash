import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";

import { stableJson } from "../packages/core/spec-core/src/index.ts";
import { compileCopilotPack } from "../packages/runtimes/copilot/compiler/src/index.ts";

const REPORT_KIND = "pairslash.skill-publish-readiness/v1";
const GH_SKILL_PROBE = ["skill", "publish", "--help"];
const GH_DRY_RUN_ARGS = ["skill", "publish", "--dry-run"];

export function detectGhSkillSupport(spawn = spawnSync) {
  const result = spawn("gh", GH_SKILL_PROBE, { encoding: "utf8" });
  return { available: result.status === 0 };
}

export function listCorePackManifests(repoRoot) {
  const categoryDir = join(repoRoot, "packs", "core");
  return readdirSync(categoryDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(categoryDir, entry.name, "pack.manifest.yaml")))
    .map((entry) => join(categoryDir, entry.name, "pack.manifest.yaml"))
    .sort();
}

export function parseDryRunOutput(text) {
  const diagnostics = [];
  for (const rawLine of String(text ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const parts = line.split("\t").map((part) => part.trim());
    const [severity, skill, ...rest] = parts;
    if (severity === "warning" || severity === "error") {
      diagnostics.push({
        severity,
        skill: skill || null,
        message: rest.join(" "),
      });
    }
  }
  return diagnostics;
}

export function buildReadinessReport({ repoRoot, packIds, ghAvailable, diagnostics }) {
  const skills = packIds.map((packId) => {
    const packDiagnostics = diagnostics.filter((d) => d.skill === packId);
    const errors = packDiagnostics.filter((d) => d.severity === "error");
    return {
      pack_id: packId,
      status: ghAvailable === false ? "unavailable" : errors.length > 0 ? "fail" : "pass",
      diagnostics: packDiagnostics,
    };
  });
  const verdict = ghAvailable === false
    ? "unavailable"
    : skills.every((skill) => skill.status === "pass")
      ? "pass"
      : "fail";
  return {
    kind: REPORT_KIND,
    repo_root: repoRoot,
    tool: {
      name: "gh",
      command: `gh ${GH_DRY_RUN_ARGS.join(" ")}`,
      available: ghAvailable,
      note: "capability-detected optional tooling; 'unavailable' is not a failure",
    },
    skills,
    verdict,
  };
}

function stagePluginBundles(repoRoot, stagingRoot, manifestPaths) {
  const packIds = [];
  for (const manifestPath of manifestPaths) {
    const compiled = compileCopilotPack({ repoRoot, manifestPath, emitMode: "plugin" });
    for (const file of compiled.files) {
      const absolutePath = join(stagingRoot, file.relative_path);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, file.content);
    }
    packIds.push(compiled.pack_id ?? manifestPath.split(/[\\/]/).at(-2));
  }
  return packIds.sort();
}

function main() {
  const repoRoot = process.cwd();
  const { available } = detectGhSkillSupport();
  const manifestPaths = listCorePackManifests(repoRoot);
  const packIds = manifestPaths.map((p) => p.split(/[\\/]/).at(-2)).sort();

  if (!available) {
    const report = buildReadinessReport({ repoRoot, packIds, ghAvailable: false, diagnostics: [] });
    console.log(stableJson(report));
    return 0;
  }

  const stagingRoot = mkdtempSync(join(tmpdir(), "pairslash-skill-publish-"));
  try {
    const stagedPackIds = stagePluginBundles(repoRoot, stagingRoot, manifestPaths);
    const dryRun = spawnSync("gh", GH_DRY_RUN_ARGS, { cwd: stagingRoot, encoding: "utf8" });
    const diagnostics = parseDryRunOutput(`${dryRun.stdout ?? ""}\n${dryRun.stderr ?? ""}`);
    if (dryRun.status !== 0) {
      diagnostics.push({ severity: "error", skill: null, message: `gh exited ${dryRun.status}` });
    }
    const report = buildReadinessReport({
      repoRoot,
      packIds: stagedPackIds,
      ghAvailable: true,
      diagnostics,
    });
    console.log(stableJson(report));
    return report.verdict === "pass" ? 0 : 1;
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, "/")}`).href) {
  process.exitCode = main();
}
