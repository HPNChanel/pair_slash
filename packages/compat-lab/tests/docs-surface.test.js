import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "../../../tests/phase4-helpers.js";

const docsUnderGuard = [
  "docs/workflows/install-guide.md",
  "docs/workflows/phase-4-install-commands.md",
  "docs/compatibility/runtime-verification.md",
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
