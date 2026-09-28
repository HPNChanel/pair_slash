import test from "node:test";
import assert from "node:assert/strict";

import {
  buildReadinessReport,
  detectGhSkillSupport,
  listCorePackManifests,
  parseDryRunOutput,
} from "../scripts/verify-skill-publish-readiness.mjs";

import { repoRoot } from "./phase4-helpers.js";

test("parseDryRunOutput extracts tab-separated diagnostics", () => {
  const diagnostics = parseDryRunOutput(
    "warning\tdemo-skill\trecommended field missing: license\n" +
      "error\tbroken-skill\tname does not match directory\n" +
      "\nDry run complete. Use without --dry-run to publish.\n",
  );
  assert.deepEqual(diagnostics, [
    { severity: "warning", skill: "demo-skill", message: "recommended field missing: license" },
    { severity: "error", skill: "broken-skill", message: "name does not match directory" },
  ]);
});

test("parseDryRunOutput tolerates empty and noise output", () => {
  assert.deepEqual(parseDryRunOutput(""), []);
  assert.deepEqual(parseDryRunOutput("Dry run complete.\nUse --tag to publish.\n"), []);
});

test("buildReadinessReport marks unavailable explicitly when gh is absent", () => {
  const report = buildReadinessReport({
    repoRoot: "repo",
    packIds: ["pack-a", "pack-b"],
    ghAvailable: false,
    diagnostics: [],
  });
  assert.equal(report.verdict, "unavailable");
  assert.equal(report.tool.available, false);
  assert.ok(report.skills.every((skill) => skill.status === "unavailable"));
});

test("buildReadinessReport fails closed on skill errors", () => {
  const report = buildReadinessReport({
    repoRoot: "repo",
    packIds: ["good-pack", "bad-pack"],
    ghAvailable: true,
    diagnostics: [
      { severity: "warning", skill: "good-pack", message: "recommended field missing: license" },
      { severity: "error", skill: "bad-pack", message: "name does not match directory" },
    ],
  });
  assert.equal(report.verdict, "fail");
  assert.equal(report.skills.find((s) => s.pack_id === "good-pack").status, "pass");
  assert.equal(report.skills.find((s) => s.pack_id === "bad-pack").status, "fail");
});

test("buildReadinessReport is deterministic for identical inputs", () => {
  const input = {
    repoRoot: "repo",
    packIds: ["b", "a"],
    ghAvailable: true,
    diagnostics: [{ severity: "warning", skill: "a", message: "w" }],
  };
  assert.deepEqual(buildReadinessReport(input), buildReadinessReport(input));
});

test("detectGhSkillSupport reports availability without throwing", () => {
  const ok = detectGhSkillSupport(() => ({ status: 0 }));
  assert.equal(ok.available, true);
  const missing = detectGhSkillSupport(() => ({ status: 1 }));
  assert.equal(missing.available, false);
  const error = detectGhSkillSupport(() => ({ status: null, error: new Error("ENOENT") }));
  assert.equal(error.available, false);
});

test("listCorePackManifests enumerates the canonical core pack set", () => {
  const manifests = listCorePackManifests(repoRoot);
  assert.equal(manifests.length, 11);
  assert.ok(manifests.every((path) => path.endsWith("pack.manifest.yaml")));
  assert.ok(manifests.some((path) => path.includes("pairslash-plan")));
});
