import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "./phase4-helpers.js";

test("root repo layout is normalized and legacy root buckets are removed", () => {
  assert.equal(existsSync(join(repoRoot, "examples")), false);
  assert.equal(existsSync(join(repoRoot, "fixtures")), false);
  assert.equal(existsSync(join(repoRoot, "schemas")), false);
  assert.equal(existsSync(join(repoRoot, "research")), false);
  assert.equal(existsSync(join(repoRoot, "templates")), false);

  assert.equal(existsSync(join(repoRoot, "docs", "examples")), true);
  assert.equal(existsSync(join(repoRoot, "docs-private", "archive", "research", "phase-3.5")), true);
  assert.equal(existsSync(join(repoRoot, "tests", "fixtures", "phase5", "contracts")), true);
  assert.equal(existsSync(join(repoRoot, "packages", "core", "spec-core", "schemas", "contracts")), true);
});

test("node-only docs and workflow references use the canonical npm validation commands", () => {
  const files = [
    "README.md",
    "AGENTS.md",
    "docs-private/workflows/phase-2-operations.md",
    ".github/copilot-instructions.md",
    ".github/workflows/repo-checks.yml",
  ];

  for (const relativePath of files) {
    const contents = readFileSync(join(repoRoot, relativePath), "utf8");
    assert.ok(contents.includes("npm run lint"), `${relativePath} should reference npm run lint`);
    assert.ok(contents.includes("npm run test"), `${relativePath} should reference npm run test`);
  }

  const workflow = readFileSync(join(repoRoot, ".github", "workflows", "repo-checks.yml"), "utf8");
  assert.ok(workflow.includes("npm run lint"));
  assert.ok(workflow.includes("npm run test"));
  assert.ok(workflow.includes("npm run test:release"));
});
