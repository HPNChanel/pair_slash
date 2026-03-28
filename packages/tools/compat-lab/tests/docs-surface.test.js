import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "../../../../tests/compat-lab-helpers.js";

const docsUnderGuard = [
  "docs/workflows/install-guide.md",
  "docs/workflows/phase-4-install-commands.md",
  "docs/workflows/phase-4-quickstart.md",
  "docs/compatibility/runtime-verification.md",
  "docs/runtime-mapping/pilot-acceptance.md",
  "docs/releases/release-checklist-0.4.0.md",
  "docs/releases/phase-4-acceptance-checklist.md",
  "packs/core/pairslash-plan/contract.md",
  "packs/core/pairslash-plan/example-invocation.md",
  "packs/core/pairslash-memory-write-global/contract.md",
  "packs/core/pairslash-memory-write-global/example-invocation.md",
];

const forbiddenPatterns = [
  /\/skills list/g,
  /(?<![A-Za-z0-9_.-])\/pairslash-[a-z0-9-]+(?![A-Za-z0-9_.-])/g,
  /\$pairslash-[a-z0-9-]+/g,
  /cp -r packs\/core\//g,
  /Copy-Item -Recurse packs\\core\\/g,
];

test("release docs and shipped docs stay /skills-first without legacy invocation paths", () => {
  for (const relativePath of docsUnderGuard) {
    const absolutePath = join(repoRoot, relativePath);
    const content = readFileSync(absolutePath, "utf8");
    for (const pattern of forbiddenPatterns) {
      const matches = content.match(pattern);
      assert.equal(
        Boolean(matches),
        false,
        `${relativePath} contains forbidden surface '${pattern.source}'`,
      );
    }
  }
});

const phase6StatusDocs = [
  "docs/releases/release-checklist-0.4.0.md",
  "docs/releases/phase-4-acceptance-checklist.md",
];

const stalePhase6Patterns = [
  /Deferred to Phase 6/g,
  /compat-lab bootstrap keeps 5 fixtures/g,
  /Phase 6: expand compat-lab beyond bootstrap fixtures and fake runtime lanes/g,
  /Phase 6: promote acceptance slice into full compat-lab with richer fixture coverage and issue triage tooling/g,
];

test("release checklists do not describe shipped Phase 6 compat-lab work as deferred", () => {
  for (const relativePath of phase6StatusDocs) {
    const absolutePath = join(repoRoot, relativePath);
    const content = readFileSync(absolutePath, "utf8");
    for (const pattern of stalePhase6Patterns) {
      const matches = content.match(pattern);
      assert.equal(
        Boolean(matches),
        false,
        `${relativePath} contains stale Phase 6 status text '${pattern.source}'`,
      );
    }
  }
});

const acceptanceDocs = [
  "docs/workflows/phase-4-quickstart.md",
  "docs/runtime-mapping/pilot-acceptance.md",
];

const staleAcceptanceCommandPatterns = [
  /npm run test:phase4:acceptance/g,
  /artifacts\/phase4-acceptance-(macos|linux|windows-prep)\.json/g,
];

test("acceptance docs keep compat-lab canonical command and artifact names", () => {
  for (const relativePath of acceptanceDocs) {
    const absolutePath = join(repoRoot, relativePath);
    const content = readFileSync(absolutePath, "utf8");
    for (const pattern of staleAcceptanceCommandPatterns) {
      const matches = content.match(pattern);
      assert.equal(
        Boolean(matches),
        false,
        `${relativePath} contains stale acceptance command or artifact '${pattern.source}'`,
      );
    }
    assert.match(content, /npm run test:acceptance/);
    assert.match(content, /artifacts\/compat-lab-acceptance-/);
  }
});
