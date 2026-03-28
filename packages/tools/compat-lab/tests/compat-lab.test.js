import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildCompatFixtureSnapshot,
  buildCompatGolden,
  listCompatFixtures,
  listCompatGoldens,
  runCompatSmoke,
} from "@pairslash/compat-lab";

import { repoRoot } from "../../../../tests/compat-lab-helpers.js";

const goldenRoot = resolve(repoRoot, "packages", "tools", "compat-lab", "goldens");
const SNAPSHOT_FIXTURES = [
  "repo-monorepo-workspaces",
  "repo-conflict-existing-runtime",
];

test("compat-lab registers Phase 6 fixture corpus with required archetypes", () => {
  const fixtures = listCompatFixtures();
  assert.deepEqual(
    fixtures.map((fixture) => fixture.id),
    [
      "repo-basic-readonly",
      "repo-write-authority-memory",
      "repo-backend-mcp",
      "repo-monorepo-workspaces",
      "repo-conflict-existing-runtime",
      "repo-node-service",
      "repo-python-service",
      "repo-docs-heavy",
      "repo-infra-repo",
      "repo-unsafe-repo",
    ],
  );
  for (const fixture of fixtures) {
    assert.ok(fixture.repo_archetype);
    assert.ok(fixture.primary_pack_id);
    assert.ok(fixture.supported_workflows.length > 0);
    assert.ok(fixture.expected_capabilities.length > 0);
    assert.ok(fixture.modeled_risks.length > 0);
    assert.ok(fixture.supported_lanes.length > 0);
  }
});

for (const fixtureId of SNAPSHOT_FIXTURES) {
  test(`compat fixture snapshot matches golden for ${fixtureId}`, () => {
    const actual = buildCompatFixtureSnapshot({
      repoRoot,
      fixtureId,
    });
    const expected = JSON.parse(
      readFileSync(resolve(goldenRoot, `fixture-snapshot.${fixtureId}.json`), "utf8"),
    );
    assert.deepEqual(actual, expected);
  });
}

for (const golden of listCompatGoldens()) {
  test(`compat golden matches committed artifact for ${golden.id}`, () => {
    const actual = buildCompatGolden({
      repoRoot,
      goldenId: golden.id,
    });
    const expected = JSON.parse(
      readFileSync(resolve(goldenRoot, `${golden.id}.json`), "utf8"),
    );
    assert.deepEqual(actual, expected);
  });
}

test("compat-lab smoke lanes cover Phase 6 compile/install/doctor gates", () => {
  const results = runCompatSmoke({
    repoRoot,
  });
  assert.equal(results.length, 6);

  const byId = new Map(results.map((result) => [result.id, result]));

  assert.equal(byId.get("compile.node-service.codex").bundle_kind, "codex-skill-bundle");
  assert.equal(byId.get("compile.node-service.codex").pack_count, 2);

  assert.equal(byId.get("compile.python-service.copilot").bundle_kind, "copilot-package-bundle");
  assert.equal(byId.get("compile.python-service.copilot").pack_count, 2);

  assert.equal(byId.get("install.docs-heavy.codex.repo").can_apply, true);
  assert.equal(byId.get("install.docs-heavy.codex.repo").support_verdict, "pass");
  assert.equal(byId.get("install.docs-heavy.codex.repo").lane_status, "supported");
  assert.equal(byId.get("install.docs-heavy.codex.repo").policy_summary.no_silent_fallback, true);

  assert.equal(byId.get("install.infra-repo.copilot.user").can_apply, true);
  assert.equal(byId.get("install.infra-repo.copilot.user").support_verdict, "warn");
  assert.equal(byId.get("install.infra-repo.copilot.user").lane_status, "supported");

  assert.equal(byId.get("doctor.backend-mcp.codex.windows-prep").support_verdict, "degraded");
  assert.equal(byId.get("doctor.backend-mcp.codex.windows-prep").lane_status, "prep");

  assert.equal(byId.get("install.conflict.copilot.repo").can_apply, false);
  assert.equal(byId.get("install.conflict.copilot.repo").support_verdict, "fail");
  assert.ok(byId.get("install.conflict.copilot.repo").blocked_operations > 0);
});
