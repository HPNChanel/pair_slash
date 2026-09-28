import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readdirSync, readFileSync } from "node:fs";

import { validateSkillSpec } from "../src/index.ts";
import { repoRoot } from "../../../../tests/phase4-helpers.js";

function skill(content, dirName = "pairslash-plan") {
  return validateSkillSpec({ content, dirName });
}

const VALID_FRONTMATTER = [
  "---",
  "name: pairslash-plan",
  "description: Create a structured execution plan before code changes.",
  "---",
  "",
  "# pairslash-plan",
].join("\n");

test("all core pack SKILL.md files pass the Agent Skills spec validator", () => {
  const coreDir = join(repoRoot, "packs", "core");
  const packDirs = readdirSync(coreDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.ok(packDirs.length > 0, "expected core packs on disk");
  for (const packId of packDirs) {
    const verdict = validateSkillSpec({
      content: readFileSync(join(coreDir, packId, "SKILL.md"), "utf8"),
      dirName: packId,
    });
    assert.equal(verdict.ok, true, `${packId} errors: ${verdict.errors.join("; ")}`);
  }
});

test("validator accepts a minimal spec-compliant skill", () => {
  const verdict = skill(VALID_FRONTMATTER);
  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.errors, []);
});

test("validator rejects missing frontmatter", () => {
  const verdict = skill("# no frontmatter\nbody only\n");
  assert.equal(verdict.ok, false);
  assert.ok(verdict.errors.some((message) => message.includes("frontmatter")));
});

test("validator rejects missing name and empty description", () => {
  const verdict = skill("---\ndescription: \"\"\n---\nbody\n");
  assert.equal(verdict.ok, false);
  assert.ok(verdict.errors.some((message) => message.includes('"name"')));
  assert.ok(verdict.errors.some((message) => message.includes('"description"')));
});

test("validator enforces the name charset and length", () => {
  for (const bad of ["PairSlash-Plan", "pairslash_plan", "-plan", "plan-", "plan--x", "p".repeat(65)]) {
    const verdict = skill(`---\nname: ${bad}\ndescription: ok\n---\n`, bad === "p".repeat(65) ? "pairslash-plan" : bad);
    assert.equal(verdict.ok, false, `expected failure for name=${bad}`);
  }
});

test("validator enforces parent-directory name match", () => {
  const verdict = skill(VALID_FRONTMATTER, "different-dir");
  assert.equal(verdict.ok, false);
  assert.ok(verdict.errors.some((message) => message.includes("parent directory")));
});

test("validator rejects control characters in name and description", () => {
  const bel = String.fromCharCode(7);
  const verdict = skill(`---
name: pairslash-plan
description: "ok${bel}bad"
---
`);
  assert.ok(verdict.errors.some((message) => message.includes("control")));
});

test("validator enforces description length cap", () => {
  const verdict = skill(`---\nname: pairslash-plan\ndescription: ${"x".repeat(1025)}\n---\n`);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.errors.some((message) => message.includes("1024")));
});

test("validator enforces compatibility type and length", () => {
  const bad = skill("---\nname: pairslash-plan\ndescription: ok\ncompatibility: 12\n---\n");
  assert.equal(bad.ok, false);
  const long = skill(
    `---\nname: pairslash-plan\ndescription: ok\ncompatibility: ${"x".repeat(501)}\n---\n`,
  );
  assert.equal(long.ok, false);
});

test("validator enforces metadata map-of-strings", () => {
  const verdict = skill("---\nname: pairslash-plan\ndescription: ok\nmetadata:\n  count: 3\n---\n");
  assert.equal(verdict.ok, false);
  assert.ok(verdict.errors.some((message) => message.includes("metadata")));
});

test("validator treats unknown fields as warnings, not errors", () => {
  const verdict = skill("---\nname: pairslash-plan\ndescription: ok\nfuture-field: yes\n---\n");
  assert.equal(verdict.ok, true);
  assert.ok(verdict.warnings.some((message) => message.includes("future-field")));
});

test("validator errors on wrong-casing of recognized fields", () => {
  const verdict = skill("---\nname: pairslash-plan\ndescription: ok\nName: other\n---\n");
  assert.equal(verdict.ok, false);
  assert.ok(verdict.errors.some((message) => message.includes("casing")));
});

test("validator rejects duplicate frontmatter keys", () => {
  const verdict = skill("---\nname: pairslash-plan\nname: other\ndescription: ok\n---\n");
  assert.equal(verdict.ok, false);
});

test("validator warns on experimental allowed-tools", () => {
  const verdict = skill("---\nname: pairslash-plan\ndescription: ok\nallowed-tools: bash read\n---\n");
  assert.equal(verdict.ok, true);
  assert.ok(verdict.warnings.some((message) => message.includes("allowed-tools")));
});
