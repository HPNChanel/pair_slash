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
    repoRoot,
    version: "0.4.0",
  });
  assert.equal(artifact.runtime_lanes.length, 4);
  assert.equal(artifact.evidence_policy.canonical_entrypoint, "/skills");
  assert.equal(artifact.runtime_lanes.some((lane) => lane.support_level === "stable-tested"), false);
  assert.ok(artifact.runtime_lanes.some((lane) => lane.support_level === "degraded"));
  assert.ok(artifact.runtime_lanes.some((lane) => lane.support_level === "prep"));
  assert.ok(
    artifact.runtime_lanes.every((lane) => lane.evidence_source.startsWith("docs/evidence/live-runtime/")),
  );
  assert.ok(
    artifact.runtime_lanes.every((lane) => lane.evidence_data_ref.startsWith("docs/evidence/live-runtime/")),
  );
  assert.ok(
    artifact.runtime_lanes.every(
      (lane) =>
        Array.isArray(lane.fake_evidence_refs) &&
        lane.fake_evidence_refs.includes("packages/tools/compat-lab/src/acceptance.js"),
    ),
  );
  assert.ok(
    artifact.runtime_lanes.every(
      (lane) =>
        Array.isArray(lane.shim_evidence_refs) &&
        lane.shim_evidence_refs.includes("packages/tools/compat-lab/src/runtime-fixtures.js"),
    ),
  );
  assert.ok(
    artifact.runtime_lanes.some(
      (lane) => lane.lane_id === "codex-cli-repo-macos" && lane.support_level === "degraded" && lane.actual_evidence_class === "live_smoke",
    ),
  );
  assert.ok(
    artifact.runtime_lanes.some(
      (lane) => lane.lane_id === "copilot-cli-user-linux" && lane.support_level === "prep" && lane.actual_evidence_class === null,
    ),
  );
  assert.equal(artifact.release_gates.length, 4);
  assert.ok(artifact.generated_from.evals.length >= 6);
  const markdown = renderCompatibilityMatrixMarkdown({
    repoRoot,
    version: "0.4.0",
  });
  assert.match(markdown, /Fake acceptance evidence/);
  assert.match(markdown, /Shim acceptance evidence/);
});

test("generated compatibility docs stay in sync with committed artifacts", () => {
  const markdown = renderCompatibilityMatrixMarkdown({
    repoRoot,
    version: "0.4.0",
  });
  const yaml = renderRuntimeSurfaceMatrixYaml({
    repoRoot,
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
