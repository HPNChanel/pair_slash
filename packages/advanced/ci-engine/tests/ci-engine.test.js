import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as ciEngine from "../src/index.ts";
import {
  CI_POLICY_ACTIONS,
  evaluateCiPolicy,
  runCiLane,
  validateProposalProvenance,
  writeCiProposals,
} from "../src/index.ts";

function withTempDir(run) {
  const root = mkdtempSync(join(tmpdir(), "pairslash-ci-engine-"));
  try {
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function collectFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        out.push(full.slice(root.length + 1).replaceAll("\\", "/"));
      }
    }
  };
  walk(root);
  return out.sort();
}

const enabledCapabilities = {
  ci_lane_enabled: true,
  ci_plan_only: false,
  ci_generate_patch_artifact: true,
};

const explicitProvenance = {
  ci_run_id: "run-test-1",
  created_at: "2026-09-29T00:00:00.000Z",
  commit_sha: "0123456789abcdef0123456789abcdef01234567",
  runtime: "codex_cli",
  shim_status: "shim",
  live_evidence: false,
};

test("module exposes no apply path", () => {
  const names = Object.keys(ciEngine);
  assert.equal(
    names.filter((name) => /apply|commit|merge/i.test(name)).length,
    0,
  );
});

test("apply-shaped actions are denied by policy", () => {
  for (const action of [
    CI_POLICY_ACTIONS.COMMIT,
    CI_POLICY_ACTIONS.MERGE,
    CI_POLICY_ACTIONS.WRITE_GLOBAL_MEMORY,
  ]) {
    const verdict = evaluateCiPolicy({
      action,
      capabilities: enabledCapabilities,
      explicitInvocation: true,
      repoPolicyExplicit: true,
    });
    assert.equal(verdict.overall_verdict, "deny", action);
  }
});

test("run report is deterministic given identical explicit provenance", () => {
  withTempDir((root) => {
    mkdirSync(join(root, "packages"), { recursive: true });
    mkdirSync(join(root, "packs", "core"), { recursive: true });
    const options = {
      repoRoot: root,
      invocation: "explicit",
      repoPolicyExplicit: true,
      capabilities: enabledCapabilities,
      provenance: explicitProvenance,
    };
    const first = runCiLane(options);
    const second = runCiLane(options);
    assert.deepEqual(first, second);
    assert.equal(first.report.status, "pass");
    assert.equal(first.provenance.ci_run_id_origin, "explicit");
  });
});

test("proposals write only under staging dir with full provenance", () => {
  withTempDir((root) => {
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs", "note.txt"), "before\n");
    const result = runCiLane({
      repoRoot: root,
      invocation: "explicit",
      repoPolicyExplicit: true,
      capabilities: enabledCapabilities,
      checks: [{ id: "c", type: "path_exists", path: "docs", required: true }],
      patchCandidates: [
        { id: "docs-note", path: "docs/note.txt", after: "after\n" },
      ],
      provenance: explicitProvenance,
    });
    assert.equal(result.artifacts.length, 1);
    assert.equal(result.artifacts[0].apply_mode, "manual-only");

    const before = collectFiles(root);
    const writeResult = writeCiProposals({ repoRoot: root, runResult: result });
    assert.equal(writeResult.refused, false);
    assert.equal(writeResult.errors.length, 0);
    const after = collectFiles(root);
    const created = after.filter((path) => !before.includes(path));
    assert.ok(created.length > 0);
    for (const path of created) {
      assert.ok(
        path.startsWith(".pairslash/staging/ci-proposals/run-test-1/"),
        `proposal write escaped staging boundary: ${path}`,
      );
    }
    const patch = readFileSync(
      join(root, ".pairslash", "staging", "ci-proposals", "run-test-1", "docs-note.patch"),
      "utf8",
    );
    assert.ok(patch.includes("diff --git"));
    const index = readFileSync(
      join(root, ".pairslash", "staging", "ci-proposals", "run-test-1", "proposals.yaml"),
      "utf8",
    );
    assert.match(index, /kind: ci-proposal-index/);
    assert.match(index, /authoritative: false/);
    assert.match(index, /apply_mode: manual-only/);
  });
});

test("incomplete provenance refuses proposal writes fail-closed", () => {
  withTempDir((root) => {
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs", "note.txt"), "before\n");
    const result = runCiLane({
      repoRoot: root,
      invocation: "explicit",
      repoPolicyExplicit: true,
      capabilities: enabledCapabilities,
      patchCandidates: [
        { id: "docs-note", path: "docs/note.txt", after: "after\n" },
      ],
      provenance: { runtime: "codex_cli", shim_status: "shim" },
    });
    assert.equal(result.artifacts.length, 1);
    assert.equal(result.provenance.ci_run_id_origin, "generated");

    const before = collectFiles(root);
    const writeResult = writeCiProposals({ repoRoot: root, runResult: result });
    assert.equal(writeResult.refused, true);
    assert.ok(
      writeResult.errors.some((error) => error.includes("ci-provenance-run-id-missing")),
    );
    assert.ok(
      writeResult.errors.some((error) => error.includes("ci-provenance-commit-sha-missing")),
    );
    assert.deepEqual(collectFiles(root), before);
  });
});

test("proposal provenance validator enforces run id, commit sha, capabilities", () => {
  const base = {
    ci_run_id: "run-1",
    ci_run_id_origin: "explicit",
    commit_sha: "abc123",
    capability_flags: enabledCapabilities,
  };
  assert.deepEqual(validateProposalProvenance(base), []);
  assert.ok(
    validateProposalProvenance({ ...base, ci_run_id_origin: "generated" }).length > 0,
  );
  assert.ok(validateProposalProvenance({ ...base, commit_sha: null }).length > 0);
  assert.ok(validateProposalProvenance({ ...base, capability_flags: null }).length > 0);
});

test("unsafe artifact ids cannot escape the run dir", () => {
  withTempDir((root) => {
    const runResult = {
      artifacts: [
        {
          kind: "ci-patch-artifact",
          schema_version: "0.1.0",
          artifact_id: "../../escape",
          label: "candidate-artifact",
          authoritative: false,
          truth_tier: "supplemental",
          apply_mode: "manual-only",
          target_path: "docs/x.txt",
          diff: "diff --git a/docs/x.txt b/docs/x.txt\n",
          description: null,
          source_file: "x.txt",
        },
      ],
      provenance: {
        ci_run_id: "run-safe",
        ci_run_id_origin: "explicit",
        commit_sha: "abc123",
        capability_flags: enabledCapabilities,
      },
    };
    const writeResult = writeCiProposals({ repoRoot: root, runResult });
    assert.equal(writeResult.refused, false);
    for (const path of writeResult.written) {
      assert.ok(path.startsWith(".pairslash/staging/ci-proposals/run-safe/"), path);
    }
    assert.equal(existsSync(join(root, "escape")), false);
  });
});
