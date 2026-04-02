import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

import { repoRoot } from "./phase4-helpers.js";

const CHARTER_PATH = "docs/phase-12/authoritative-program-charter.md";
const CHARTER_FILE = "authoritative-program-charter.md";
const OFFICIAL_STAGE_SENTENCE =
  "PairSlash is currently at Phase 3.5 business validation on top of a technically shipped Phase 4 installability substrate with additional Phase 5/6 hardening in the repo.";

function read(relativePath) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

test("authoritative program charter exists with the required section contract", () => {
  const absolutePath = join(repoRoot, CHARTER_PATH);
  assert.equal(existsSync(absolutePath), true);

  const contents = read(CHARTER_PATH);
  const requiredSections = [
    "## 1. Charter Purpose",
    "## 2. Canonical Product Statement",
    "## 3. Current Program Truth",
    "## 4. Official Phase Statement",
    "## 5. Authority Hierarchy",
    "## 6. Claim Ladder",
    "## 7. Support Boundary Rules",
    "## 8. Sync Policy",
    "## 9. Anti-Drift Rules",
    "## 10. Official Answer Bank",
    "## 11. Phase 12 Exit Gate",
    '## "Founder/Maintainer Single Answer"',
  ];

  for (const heading of requiredSections) {
    assert.ok(contents.includes(heading), `${CHARTER_PATH} should include ${heading}`);
  }

  assert.ok(
    normalizeWhitespace(contents).includes(OFFICIAL_STAGE_SENTENCE),
    `${CHARTER_PATH} should contain the official stage sentence`,
  );
});

test("official stage sentence is synced into public entry docs", () => {
  const mirroredFiles = [
    "README.md",
    "docs/phase-9/README.md",
    "docs/phase-9/onboarding-path.md",
  ];

  for (const relativePath of mirroredFiles) {
    const contents = normalizeWhitespace(read(relativePath));
    assert.ok(contents.includes(OFFICIAL_STAGE_SENTENCE), `${relativePath} should reuse the official stage sentence`);
    assert.ok(contents.includes(CHARTER_FILE), `${relativePath} should point to the authoritative charter`);
  }
});

test("public claim policy points to the charter instead of owning stage truth", () => {
  const policyPath = "docs/releases/public-claim-policy.md";
  const contents = read(policyPath);

  assert.ok(contents.includes(CHARTER_PATH), `${policyPath} should point to the authoritative charter`);
  assert.equal(contents.includes("## Current stage"), false, `${policyPath} should not own a current-stage section`);
  assert.equal(
    normalizeWhitespace(contents).includes(OFFICIAL_STAGE_SENTENCE),
    false,
    `${policyPath} should not restate the official phase sentence as its own truth root`,
  );
});

test("charter system record points to the markdown charter and verdict sources", () => {
  const record = YAML.parse(read(".pairslash/project-memory/00-project-charter.yaml"));

  assert.equal(record.phase, "phase-12-truth-sync");
  assert.equal(normalizeWhitespace(record.stage_statement), OFFICIAL_STAGE_SENTENCE);
  assert.equal(record.truth_sources.program_charter, CHARTER_PATH);
  assert.equal(record.truth_sources.product_validation_verdict, "docs/validation/phase-3-5/verdict.md");
  assert.equal(record.truth_sources.scoped_release_verdict, "docs/releases/scoped-release-verdict.md");
  assert.equal(record.truth_sources.public_claim_policy, "docs/releases/public-claim-policy.md");
  assert.equal(record.truth_sources.runtime_support_matrix, "docs/compatibility/compatibility-matrix.md");
});

test("release checklist requires the authoritative charter", () => {
  const checklistPath = "docs/releases/release-checklist-0.4.0.md";
  const contents = read(checklistPath);

  assert.ok(contents.includes(CHARTER_PATH), `${checklistPath} should require the authoritative charter`);
});
