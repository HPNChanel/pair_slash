import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DEFAULT_SMOKE_LANES,
  buildCompatFixtureSnapshot,
  listCompatFixtures,
  runCompatSmoke,
} from "@pairslash/compat-lab";

import { repoRoot } from "../../../../tests/phase4-helpers.js";

const goldenRoot = resolve(repoRoot, "packages", "tools", "compat-lab", "goldens");

test("compat-lab registers five phase4 bootstrap fixtures", () => {
  assert.deepEqual(
    listCompatFixtures().map((fixture) => fixture.id),
    [
      "repo-basic-readonly",
      "repo-write-authority-memory",
      "repo-backend-mcp",
      "repo-monorepo-workspaces",
      "repo-conflict-existing-runtime",
    ],
  );
});

for (const fixture of listCompatFixtures()) {
  test(`compat-lab snapshot matches golden for ${fixture.id}`, () => {
    const actual = buildCompatFixtureSnapshot({
      repoRoot,
      fixtureId: fixture.id,
    });
    const expected = JSON.parse(
      readFileSync(resolve(goldenRoot, `${fixture.id}.json`), "utf8"),
    );
    assert.deepEqual(actual, expected);
  });
}

test("compat-lab smoke lanes cover compile/install/doctor bootstrap paths", () => {
  const results = runCompatSmoke({
    repoRoot,
  });
  assert.equal(results.length, DEFAULT_SMOKE_LANES.length);

  const byId = new Map(results.map((result) => [result.id, result]));

  assert.equal(byId.get("compile.monorepo.copilot").bundle_kind, "copilot-package-bundle");
  assert.equal(byId.get("compile.monorepo.copilot").pack_count, 2);

  assert.equal(byId.get("install.basic.codex.repo").can_apply, true);
  assert.equal(byId.get("install.basic.codex.repo").support_verdict, "degraded");

  assert.equal(byId.get("install.basic.copilot.user").can_apply, true);
  assert.equal(byId.get("install.basic.copilot.user").support_verdict, "degraded");

  assert.equal(byId.get("install.write-authority.codex.repo").can_apply, true);
  assert.equal(byId.get("install.write-authority.codex.repo").support_verdict, "degraded");

  assert.equal(byId.get("doctor.backend-mcp.codex.repo").support_verdict, "degraded");

  assert.equal(byId.get("install.conflict.copilot.repo").can_apply, false);
  assert.equal(byId.get("install.conflict.copilot.repo").support_verdict, "fail");
  assert.ok(byId.get("install.conflict.copilot.repo").blocked_operations > 0);
});
