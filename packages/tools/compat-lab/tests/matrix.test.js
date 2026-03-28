import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildCompatibilityMatrixArtifact,
  renderCompatibilityMatrixMarkdown,
  renderRuntimeSurfaceMatrixYaml,
} from "@pairslash/compat-lab";

import { repoRoot } from "../../../../tests/compat-lab-helpers.js";

test("compatibility matrix artifact exposes public support semantics", () => {
  const artifact = buildCompatibilityMatrixArtifact({
    version: "0.4.0",
  });
  assert.equal(artifact.runtime_lanes.length, 4);
  assert.ok(artifact.runtime_lanes.some((lane) => lane.support_level === "stable-tested"));
  assert.ok(artifact.runtime_lanes.some((lane) => lane.support_level === "degraded"));
  assert.ok(artifact.runtime_lanes.some((lane) => lane.support_level === "prep"));
  assert.equal(artifact.release_gates.length, 4);
  assert.ok(artifact.generated_from.evals.length >= 6);
});

test("generated compatibility docs stay in sync with committed artifacts", () => {
  const markdown = renderCompatibilityMatrixMarkdown({
    version: "0.4.0",
  });
  const yaml = renderRuntimeSurfaceMatrixYaml({
    version: "0.4.0",
  });
  assert.equal(
    markdown,
    readFileSync(join(repoRoot, "docs", "compatibility", "compatibility-matrix.md"), "utf8"),
  );
  assert.equal(
    yaml,
    readFileSync(join(repoRoot, "docs", "compatibility", "runtime-surface-matrix.yaml"), "utf8"),
  );
});
