import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

import { repoRoot } from "./phase4-helpers.js";

const CHARTER_PATH = "docs/phase-12/authoritative-program-charter.md";
const CHARTER_FILE = "authoritative-program-charter.md";
const READ_AUTHORITY_CHARTER_PATH = "docs/architecture/phase-17-read-authority-charter.md";
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

function collectMarkdownFiles(relativeDir) {
  const rootDir = join(repoRoot, relativeDir);
  const out = [];

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const childRelativePath = join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectMarkdownFiles(childRelativePath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(childRelativePath.replaceAll("\\", "/"));
    }
  }

  return out;
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

test("phase 17 read authority charter exists with the required contract sections", () => {
  const absolutePath = join(repoRoot, READ_AUTHORITY_CHARTER_PATH);
  assert.equal(existsSync(absolutePath), true);

  const contents = read(READ_AUTHORITY_CHARTER_PATH);
  for (const heading of [
    "## Precedence Contract",
    "## Explain-Context Contract",
    "## Conflict Taxonomy",
    "## Policy Notes for Global / Task / Session / Staging",
    "## Acceptance Matrix",
    "## Out-of-Scope Decisions",
  ]) {
    assert.ok(contents.includes(heading), `${READ_AUTHORITY_CHARTER_PATH} should include ${heading}`);
  }
  assert.ok(
    contents.includes("global-project-memory > task-memory > session > staging > audit-log"),
    `${READ_AUTHORITY_CHARTER_PATH} should state the official precedence rule`,
  );
  for (const workflowId of [
    "`explain-context`",
    "`pairslash-plan`",
    "`pairslash-memory-candidate`",
    "`pairslash-memory-audit`",
  ]) {
    assert.ok(contents.includes(workflowId), `${READ_AUTHORITY_CHARTER_PATH} should include ${workflowId}`);
  }
  for (const label of [
    "Authoritative statement:",
    "Anti-overclaim statement:",
    "Exit gate sentence:",
  ]) {
    assert.ok(contents.includes(label), `${READ_AUTHORITY_CHARTER_PATH} should include ${label}`);
  }
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

test("public-facing markdown does not expose docs-private paths", () => {
  const markdownFiles = [
    "README.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    ...collectMarkdownFiles("docs"),
    ...collectMarkdownFiles("packages"),
    ...collectMarkdownFiles("packs"),
  ];

  for (const relativePath of markdownFiles) {
    const contents = read(relativePath);
    assert.equal(
      contents.includes("docs-private/"),
      false,
      `${relativePath} should not expose docs-private paths in public-facing markdown`,
    );
  }
});

test("phase 9 active docs point to the charter instead of the baseline reality lock", () => {
  const derivativeFiles = [
    "docs/phase-9/README.md",
    "docs/phase-9/onboarding-path.md",
    "docs-private/phase-9/maintainer-playbook.md",
    "docs-private/phase-9/issue-taxonomy.md",
    "docs-private/phase-9/contributor-model.md",
    "docs-private/phase-9/examples-and-benchmarks.md",
    "docs-private/phase-9/oss-positioning.md",
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

test("phase 17 read authority charter is wired into phase truth and claim guardrails", () => {
  const charterContents = read(CHARTER_PATH);
  assert.ok(
    charterContents.includes(READ_AUTHORITY_CHARTER_PATH),
    `${CHARTER_PATH} should point to the read-authority charter`,
  );

  const publicClaimPolicy = read("docs/releases/public-claim-policy.md");
  assert.ok(
    publicClaimPolicy.includes(READ_AUTHORITY_CHARTER_PATH),
    "docs/releases/public-claim-policy.md should point to the read-authority charter",
  );
  assert.ok(
    publicClaimPolicy.includes("Do not claim authoritative read-path completion unless the shared loader"),
    "docs/releases/public-claim-policy.md should keep the authoritative read-path overclaim guardrail explicit",
  );
});

test("phase 17 read workflow skills keep authoritative read-path guardrails explicit", () => {
  const planSkill = normalizeWhitespace(read("packs/core/pairslash-plan/SKILL.md"));
  assert.ok(planSkill.includes("Global Project Memory is authoritative on read."));
  assert.ok(planSkill.includes("must not silently override a matching Global Project Memory claim"));

  const candidateSkill = normalizeWhitespace(read("packs/core/pairslash-memory-candidate/SKILL.md"));
  assert.ok(candidateSkill.includes("Resolve memory context in this precedence order:"));
  assert.ok(candidateSkill.includes("Lower layers must not silently override Global Project Memory."));

  const auditSkill = normalizeWhitespace(read("packs/core/pairslash-memory-audit/SKILL.md"));
  assert.ok(auditSkill.includes("## Load sources in precedence order"));
  assert.ok(auditSkill.includes("Global Project Memory remains authoritative on read."));
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
  assert.ok(
    contents.includes("`fake acceptance evidence`"),
    `${matrixPath} should explain fake acceptance evidence separately from live proof`,
  );
  assert.ok(
    contents.includes("`shim acceptance evidence`"),
    `${matrixPath} should explain shim acceptance evidence separately from live proof`,
  );

  assert.ok(
    contents.includes("do not change repository licensing"),
    `${matrixPath} should keep legal/package truth separate from support truth`,
  );
  assert.ok(
    contents.includes("Manual live-run steps required"),
    `${matrixPath} should render manual live verification guardrails`,
  );
  assert.ok(
    contents.includes("Windows promotion gate requires"),
    `${matrixPath} should render Windows promotion guardrails`,
  );
});

test("live runtime evidence index and lane records stay committed", () => {
  const indexPath = "docs/evidence/live-runtime/README.md";
  const contents = read(indexPath);

  for (const laneFile of [
    "codex-cli-repo-macos.md",
    "codex-cli-repo-macos.yaml",
    "copilot-cli-user-linux.md",
    "copilot-cli-user-linux.yaml",
    "codex-cli-repo-windows.md",
    "codex-cli-repo-windows.yaml",
    "copilot-cli-user-windows.md",
    "copilot-cli-user-windows.yaml",
    "schema.live-runtime-lane-record.yaml",
  ]) {
    assert.ok(contents.includes(laneFile), `${indexPath} should list ${laneFile}`);
    assert.equal(existsSync(join(repoRoot, "docs", "evidence", "live-runtime", laneFile)), true);
  }
});

test("runtime-facing install docs keep degraded and prep caveats explicit", () => {
  for (const relativePath of [
    "README.md",
    "docs/workflows/install-guide.md",
    "docs/workflows/phase-4-install-commands.md",
    "docs/workflows/phase-4-quickstart.md",
    "docs/phase-9/onboarding-path.md",
  ]) {
    const contents = read(relativePath);
    assert.ok(contents.includes("compatibility-matrix.md"), `${relativePath} should point to the compatibility matrix`);
    assert.ok(contents.includes("degraded"), `${relativePath} should keep degraded lane wording explicit`);
    assert.ok(contents.includes("prep"), `${relativePath} should keep prep lane wording explicit`);
  }
});

test("scoped release verdict keeps release language separate from validation language", () => {
  const verdictPath = "docs/releases/scoped-release-verdict.md";
  const contents = read(verdictPath);

  assert.ok(contents.includes("Gate status: NO-GO"), `${verdictPath} should fail closed when release-readiness is red`);
  assert.ok(contents.includes("Release-covered runtimes:"), `${verdictPath} should use release-covered wording`);
  assert.equal(contents.includes("Validated runtimes:"), false, `${verdictPath} should avoid validation wording drift`);
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
  const checklistPath = "docs-private/releases/release-checklist-0.4.0.md";
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

  const releaseChecklist = read("docs-private/releases/release-checklist-0.4.0.md");
  assert.ok(
    releaseChecklist.includes(LEGAL_PACKAGING_STATUS_PATH),
    "docs-private/releases/release-checklist-0.4.0.md should require the legal/package boundary doc",
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

  const contributorModel = read("docs-private/phase-9/contributor-model.md");
  assert.ok(
    contributorModel.includes("Apache-2.0"),
    "docs-private/phase-9/contributor-model.md should record the repository source license",
  );
  assert.ok(
    contributorModel.includes(LEGAL_PACKAGING_STATUS_PATH),
    "docs-private/phase-9/contributor-model.md should point to the legal/package boundary",
  );
});

test("compatibility, support, and issue triage docs keep legal/package truth separate from support truth", () => {
  const verificationContents = read("docs/compatibility/runtime-verification.md");
  assert.ok(
    verificationContents.includes("does not publish any `@pairslash/*` package"),
    "docs/compatibility/runtime-verification.md should keep package publication separate from support verification",
  );
  for (const heading of [
    "## A. Live Verification Philosophy",
    "## B. Runbook - Codex CLI",
    "## C. Runbook - GitHub Copilot CLI",
    "## D. Artifact Checklist",
    "## E. Verdict Assignment Rules",
    "## F. Recertification Cadence",
    "## G. Windows/Copilot Promotion Gate",
    "## H. Failure And Rollback Communication Template",
  ]) {
    assert.ok(
      verificationContents.includes(heading),
      `docs/compatibility/runtime-verification.md should include ${heading}`,
    );
  }
  assert.ok(
    verificationContents.includes("Do not substitute compat-lab, fake runtimes, shim acceptance, or `codex exec`"),
    "docs/compatibility/runtime-verification.md should keep fake and non-interactive substitutions explicit",
  );
  assert.ok(
    verificationContents.includes("Copilot prompt-mode direct invocation remains blocked"),
    "docs/compatibility/runtime-verification.md should keep the Copilot direct invocation block explicit",
  );
  assert.ok(
    verificationContents.includes("Windows stays `prep` until a real Windows host records install apply"),
    "docs/compatibility/runtime-verification.md should keep Windows promotion gates explicit",
  );

  const doctorContents = read("docs/workflows/phase-4-doctor-troubleshooting.md");
  assert.ok(
    doctorContents.includes("does not make any `@pairslash/*`"),
    "docs/workflows/phase-4-doctor-troubleshooting.md should keep package publicness separate from doctor verdicts",
  );

  const supportOpsContents = read("docs-private/support/phase-7-support-ops.md");
  assert.ok(
    normalizeWhitespace(supportOpsContents).includes("do not change repository licensing"),
    "docs-private/support/phase-7-support-ops.md should keep legal/package truth separate from support artifacts",
  );

  for (const relativePath of [
    "docs-private/support/triage-playbook.md",
    "docs-private/phase-9/issue-taxonomy.md",
    "docs-private/phase-9/maintainer-playbook.md",
  ]) {
    const contents = read(relativePath);
    assert.ok(
      contents.includes(LEGAL_PACKAGING_STATUS_PATH),
      `${relativePath} should point to the legal/package boundary`,
    );
  }
});

test("phase 9 public narrative docs keep repo source licensing separate from package publication", () => {
  const phase9Readme = read("docs/phase-9/README.md");
  assert.ok(
    phase9Readme.includes("legal-packaging-status.md"),
    "docs/phase-9/README.md should point to the legal/package boundary",
  );
  assert.ok(
    phase9Readme.includes("package-manager publication is not part of the current public surface"),
    "docs/phase-9/README.md should keep package publication bounded",
  );

  const onboardingContents = read("docs/phase-9/onboarding-path.md");
  assert.ok(
    onboardingContents.includes("legal-packaging-status.md"),
    "docs/phase-9/onboarding-path.md should point to the legal/package boundary",
  );
  assert.ok(
    onboardingContents.includes("package-manager publication is not claimed today"),
    "docs/phase-9/onboarding-path.md should keep package publication bounded",
  );

  const positioningContents = read("docs-private/phase-9/oss-positioning.md");
  assert.ok(
    positioningContents.includes("current supported install path remains repo-local and non-published"),
    "docs-private/phase-9/oss-positioning.md should keep source licensing separate from package publication",
  );

  const messagingContents = read("docs-private/validation/phase-3-5/messaging-narrative.md");
  assert.ok(
    messagingContents.includes("PairSlash is already a published npm package."),
    "docs-private/validation/phase-3-5/messaging-narrative.md should block published-package overclaim wording",
  );
});

test("legacy planning and benchmark docs stay derivative instead of owning current truth", () => {
  const positioningPath = "docs-private/phase-9/oss-positioning.md";
  const benchmarkTasksPath = "docs-private/validation/phase-3-5/benchmark-tasks.md";

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
    "docs/phase-9/README.md",
    "docs/phase-9/onboarding-path.md",
    "docs/compatibility/compatibility-matrix.md",
    "docs-private/support/triage-playbook.md",
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
