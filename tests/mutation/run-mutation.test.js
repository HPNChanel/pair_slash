import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";

import { enumerateMutationSites, planMutants } from "./run-mutation.mjs";
import { repoRoot } from "../phase4-helpers.js";

test("mutation site enumeration is deterministic and scoped to memory-engine src", () => {
  const first = planMutants(resolve(repoRoot, "packages/core/memory-engine"));
  const second = planMutants(resolve(repoRoot, "packages/core/memory-engine"));
  assert.ok(first.length > 0);
  assert.deepEqual(first, second);
  for (const site of first) {
    assert.ok(site.file.startsWith("src/"), site.id);
    assert.match(site.id, /^src\/.+\.ts:\d+:[a-z-]+$/);
  }
});

test("mutation operators cover inversion families without touching comments/imports", () => {
  const source = [
    "import x from \"y\"; // && === should not mutate",
    "const a = left === right && flag === true;",
    "// a comment with === && || operators",
    "if (count >= 2 || items.length <= 0) {",
    "  return false;",
    "}",
  ].join("\n");
  const sites = enumerateMutationSites(source, "src/sample.ts");
  const ids = sites.map((site) => `${site.line}:${site.operator}`);
  assert.ok(ids.includes("2:eq-to-neq"));
  assert.ok(ids.includes("2:and-to-or"));
  assert.ok(ids.includes("2:true-to-false"));
  assert.ok(ids.includes("4:gte-to-gt"));
  assert.ok(ids.includes("4:lte-to-lt"));
  assert.ok(ids.includes("4:or-to-and"));
  assert.ok(ids.includes("5:false-to-true"));
  assert.ok(!sites.some((site) => site.line === 1 || site.line === 3));
});
