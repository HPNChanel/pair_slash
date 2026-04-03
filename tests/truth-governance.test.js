import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

import { repoRoot } from "./phase4-helpers.js";

const CHARTER_PATH = "docs/phase-12/authoritative-program-charter.md";
const CHARTER_FILE = "authoritative-program-charter.md";
const LEGAL_PACKAGING_STATUS_PATH = "docs/releases/legal-packaging-status.md";
const LICENSE_PATH = "LICENSE";
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

test("phase 9 active docs point to the charter instead of the baseline reality lock", () => {
  const derivativeFiles = [
    "docs/phase-9/README.md",
    "docs/phase-9/onboarding-path.md",
    "docs/phase-9/maintainer-playbook.md",
    "docs/phase-9/issue-taxonomy.md",
    "docs/phase-9/contributor-model.md",
    "docs/phase-9/examples-and-benchmarks.md",
    "docs/phase-9/oss-positioning.md",
  ];

  for (const relativePath of derivativeFiles) {
    const contents = read(relativePath);
    assert.ok(
      contents.includes(`truth_source: ${CHARTER_PATH}`),
      `${relativePath} should declare the charter as its truth source`,
    );
    assert.equal(
      contents.includes("baseline_source: docs/phase-9/phase-9-baseline-reality-lock.md"),
      false,
      `${relativePath} should not point to the Phase 9 baseline as a competing truth source`,
    );
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

test("public claim policy keeps narrative guardrails and release wording templates", () => {
  const policyPath = "docs/releases/public-claim-policy.md";
  const contents = read(policyPath);

  for (const heading of [
    "## Public narrative principles",
    "## Release notes opening template",
    "## Allowed verbs",
    "## Forbidden verbs",
    "## Allowed confidence language",
    "## Forbidden maturity inflation",
    "## Do not say",
  ]) {
    assert.ok(contents.includes(heading), `${policyPath} should include ${heading}`);
  }
});

test("compatibility matrix distinguishes implementation, deterministic, live, and public support truth", () => {
  const matrixPath = "docs/compatibility/compatibility-matrix.md";
  const contents = read(matrixPath);

  for (const term of ["`implemented`", "`deterministic-tested`", "`live-evidence-backed`", "`publicly supported`"]) {
    assert.ok(contents.includes(term), `${matrixPath} should explain ${term}`);
  }
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

test("legal and packaging status is wired into current truth roots", () => {
  const contents = read(LEGAL_PACKAGING_STATUS_PATH);
  assert.ok(
    contents.includes("license_status: apache-2.0-repo-source"),
    `${LEGAL_PACKAGING_STATUS_PATH} should explain the current legal status`,
  );
  assert.ok(
    contents.includes("Package-manager publication is not part of the current public surface."),
    `${LEGAL_PACKAGING_STATUS_PATH} should record the current package boundary`,
  );
  assert.ok(contents.includes("Apache-2.0"), `${LEGAL_PACKAGING_STATUS_PATH} should record the repository license`);

  const charterContents = read(CHARTER_PATH);
  assert.ok(charterContents.includes(LEGAL_PACKAGING_STATUS_PATH), `${CHARTER_PATH} should point to ${LEGAL_PACKAGING_STATUS_PATH}`);

  const publicClaimPolicy = read("docs/releases/public-claim-policy.md");
  assert.ok(
    publicClaimPolicy.includes(LEGAL_PACKAGING_STATUS_PATH),
    "docs/releases/public-claim-policy.md should point to the legal/package boundary",
  );

  const releaseChecklist = read("docs/releases/release-checklist-0.4.0.md");
  assert.ok(
    releaseChecklist.includes(LEGAL_PACKAGING_STATUS_PATH),
    "docs/releases/release-checklist-0.4.0.md should require the legal/package boundary doc",
  );

  const record = YAML.parse(read(".pairslash/project-memory/00-project-charter.yaml"));
  assert.equal(record.truth_sources.legal_package_status, LEGAL_PACKAGING_STATUS_PATH);
});

test("repository license and manifest SPDX metadata stay normalized", () => {
  const licenseContents = read(LICENSE_PATH);
  assert.ok(licenseContents.includes("Apache License"), `${LICENSE_PATH} should ship the Apache license text`);

  const rootManifest = JSON.parse(read("package.json"));
  assert.equal(rootManifest.license, "Apache-2.0", "package.json should declare Apache-2.0");

  const packageJsonPaths = [
    "packages/advanced/ci-engine/package.json",
    "packages/advanced/delegation-engine/package.json",
    "packages/core/contract-engine/package.json",
    "packages/core/memory-engine/package.json",
    "packages/core/policy-engine/package.json",
    "packages/core/spec-core/package.json",
    "packages/runtimes/codex/adapter/package.json",
    "packages/runtimes/codex/compiler/package.json",
    "packages/runtimes/copilot/adapter/package.json",
    "packages/runtimes/copilot/compiler/package.json",
    "packages/tools/cli/package.json",
    "packages/tools/compat-lab/package.json",
    "packages/tools/doctor/package.json",
    "packages/tools/installer/package.json",
    "packages/tools/lint-bridge/package.json",
    "packages/tools/trace/package.json",
  ];

  for (const relativePath of packageJsonPaths) {
    const manifest = JSON.parse(read(relativePath));
    assert.equal(manifest.license, "Apache-2.0", `${relativePath} should declare Apache-2.0`);
  }
});

test("root and package manifests stay private while package publication is not claimed", () => {
  const rootManifest = JSON.parse(read("package.json"));
  assert.equal(rootManifest.private, true, "package.json should remain private");

  const packageJsonPaths = [
    "packages/advanced/ci-engine/package.json",
    "packages/advanced/delegation-engine/package.json",
    "packages/core/contract-engine/package.json",
    "packages/core/memory-engine/package.json",
    "packages/core/policy-engine/package.json",
    "packages/core/spec-core/package.json",
    "packages/runtimes/codex/adapter/package.json",
    "packages/runtimes/codex/compiler/package.json",
    "packages/runtimes/copilot/adapter/package.json",
    "packages/runtimes/copilot/compiler/package.json",
    "packages/tools/cli/package.json",
    "packages/tools/compat-lab/package.json",
    "packages/tools/doctor/package.json",
    "packages/tools/installer/package.json",
    "packages/tools/lint-bridge/package.json",
    "packages/tools/trace/package.json",
  ];

  for (const relativePath of packageJsonPaths) {
    const manifest = JSON.parse(read(relativePath));
    assert.equal(manifest.private, true, `${relativePath} should remain private`);
  }
});

test("repo-local install docs do not imply package-manager publication", () => {
  for (const relativePath of ["README.md", "docs/workflows/install-guide.md", "docs/workflows/phase-4-quickstart.md"]) {
    const contents = read(relativePath);
    assert.ok(contents.includes("repo-local"), `${relativePath} should describe the repo-local install path`);
    assert.equal(
      contents.includes("npm install pairslash"),
      false,
      `${relativePath} should not imply a published npm install surface`,
    );
  }
});

test("contributor-facing docs distinguish source licensing from package publication", () => {
  const contents = read("CONTRIBUTING.md");
  assert.ok(contents.includes("Apache-2.0"), "CONTRIBUTING.md should record the repository source license");
  assert.ok(contents.includes("remain `private`"), "CONTRIBUTING.md should keep package publication bounded");
});

test("legacy planning and benchmark docs stay derivative instead of owning current truth", () => {
  const positioningPath = "docs/phase-9/oss-positioning.md";
  const benchmarkTasksPath = "docs/validation/phase-3-5/benchmark-tasks.md";

  const positioningContents = read(positioningPath);
  assert.equal(
    positioningContents.includes("Use this file as the source of truth for the next Phase 9 public surfaces:"),
    false,
    `${positioningPath} should not own downstream truth`,
  );
  assert.ok(
    positioningContents.includes("does not own current phase truth"),
    `${positioningPath} should mark itself derivative`,
  );

  const benchmarkTasksContents = read(benchmarkTasksPath);
  assert.equal(
    benchmarkTasksContents.includes("the active source of truth for the current business-validation phase"),
    false,
    `${benchmarkTasksPath} should not claim current phase authority`,
  );
  assert.ok(
    benchmarkTasksContents.includes("docs/validation/phase-3-5/verdict.md"),
    `${benchmarkTasksPath} should point to the product-validation verdict`,
  );
  assert.ok(
    benchmarkTasksContents.includes(CHARTER_PATH),
    `${benchmarkTasksPath} should point to the charter for the phase statement`,
  );
});

test("resolved repo license does not flatten current truth roots into public package claims", () => {
  const record = YAML.parse(read(".pairslash/project-memory/00-project-charter.yaml"));
  assert.equal(record.identity.license_status, "apache-2.0-repo-source");

  const disallowedPhrases = [
    "PairSlash is the OSS trust layer for terminal-native AI workflows.",
    "PairSlash is the OSS trust layer for terminal-native AI workflows on exactly two runtimes",
    'PairSlash la OSS trust layer cho terminal-native AI workflows tren Codex CLI va GitHub Copilot CLI.',
    "OSS trust layer for terminal-native AI workflows on Codex CLI and GitHub Copilot CLI.",
    "PairSlash is already a published npm package.",
    "The Apache-2.0 repo license means every `@pairslash/*` package is public.",
  ];

  for (const relativePath of [
    "README.md",
    CHARTER_PATH,
    LEGAL_PACKAGING_STATUS_PATH,
    ".pairslash/project-memory/00-project-charter.yaml",
  ]) {
    const contents = read(relativePath);
    for (const phrase of disallowedPhrases) {
      assert.equal(
        contents.includes(phrase),
        false,
        `${relativePath} should not overclaim package publicness from the repo license`,
      );
    }
  }

  const publicClaimPolicy = read("docs/releases/public-claim-policy.md");
  assert.ok(
    publicClaimPolicy.includes("## Do not say"),
    "docs/releases/public-claim-policy.md should keep the explicit forbidden wording list",
  );
});
