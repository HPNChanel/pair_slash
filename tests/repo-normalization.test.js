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

test("release workflows enforce signed release-trust verification on protected lanes", () => {
  const repoChecks = readFileSync(join(repoRoot, ".github", "workflows", "repo-checks.yml"), "utf8");
  assert.ok(repoChecks.includes("PAIRSLASH_RELEASE_TRUST_REQUIRE_SIGNED"));
  assert.ok(
    repoChecks.includes("PAIRSLASH_RELEASE_TRUST_REQUIRE_SIGNED == '1'"),
    "repo-checks signed artifact steps should be gated to protected signed lanes",
  );
  assert.ok(
    repoChecks.includes("node scripts/build-release-trust.mjs --out artifacts/release-trust"),
    "repo-checks should build signed release-trust artifacts with the canonical script path",
  );
  assert.ok(
    repoChecks.includes("node scripts/verify-release-trust.mjs --trust-dir artifacts/release-trust"),
    "repo-checks should verify signed release-trust artifacts with the canonical script path",
  );

  const nightly = readFileSync(join(repoRoot, ".github", "workflows", "compat-lab-nightly.yml"), "utf8");
  assert.ok(nightly.includes("PAIRSLASH_RELEASE_TRUST_REQUIRE_SIGNED: \"1\""));

  const candidatePath = join(repoRoot, ".github", "workflows", "release-trust-candidate.yml");
  assert.equal(existsSync(candidatePath), true);
  const candidate = readFileSync(candidatePath, "utf8");
  assert.ok(candidate.includes("PAIRSLASH_RELEASE_TRUST_REQUIRE_SIGNED: \"1\""));
  assert.ok(candidate.includes("npm run test:release"));
  assert.ok(candidate.includes("node scripts/build-release-trust.mjs --out artifacts/release-trust"));
  assert.ok(candidate.includes("node scripts/verify-release-trust.mjs --trust-dir artifacts/release-trust"));
});
