import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

import { runCli } from "../../packages/tools/cli/src/bin/pairslash.js";
import {
  CI_CAPABILITY_DEFAULTS,
  CI_POLICY_ACTIONS,
  CI_POLICY_CONTRACT,
  evaluateCiPolicy,
  runCiLane,
} from "../../packages/advanced/ci-engine/src/index.js";
import { createTempRepo, repoRoot } from "../phase4-helpers.js";

const serial = { concurrency: false };

function findVerdict(result, action) {
  return result.policy_verdicts.active.find((verdict) => verdict.action === action);
}

test("ci lane is disabled by default", serial, () => {
  const fixture = createTempRepo();
  try {
    const result = runCiLane({
      repoRoot: fixture.tempRoot,
      invocation: "explicit",
      repoPolicyExplicit: true,
    });

    assert.equal(result.capability_flags.ci_lane_enabled, false);
    assert.equal(result.report.status, "blocked");
    const readRepoVerdict = findVerdict(result, CI_POLICY_ACTIONS.READ_REPO);
    assert.equal(readRepoVerdict.overall_verdict, "deny");
    assert.ok(readRepoVerdict.reasons.some((reason) => reason.code === "CI-LANE-DISABLED"));
  } finally {
    fixture.cleanup();
  }
});

test("ci lane denies direct commit by default", serial, () => {
  const verdict = evaluateCiPolicy({
    action: CI_POLICY_ACTIONS.COMMIT,
    capabilities: {
      ci_lane_enabled: true,
      ci_plan_only: false,
    },
    explicitInvocation: true,
    repoPolicyExplicit: true,
  });

  assert.equal(verdict.overall_verdict, "deny");
  assert.ok(verdict.reasons.some((reason) => reason.code === "CI-COMMIT-DISABLED"));
});

test("ci lane denies direct Global Project Memory write", serial, () => {
  const verdict = evaluateCiPolicy({
    action: CI_POLICY_ACTIONS.WRITE_GLOBAL_MEMORY,
    capabilities: {
      ci_lane_enabled: true,
      ci_plan_only: false,
    },
    explicitInvocation: true,
    repoPolicyExplicit: true,
  });

  assert.equal(verdict.overall_verdict, "deny");
  assert.ok(verdict.reasons.some((reason) => reason.code === "CI-GLOBAL-MEMORY-WRITE-DENIED"));
});

test("ci report and patch artifact include provenance metadata", serial, () => {
  const fixture = createTempRepo();
  try {
    mkdirSync(join(fixture.tempRoot, "docs"), { recursive: true });
    writeFileSync(join(fixture.tempRoot, "docs", "ci-note.txt"), "before\n");

    const result = runCiLane({
      repoRoot: fixture.tempRoot,
      invocation: "explicit",
      repoPolicyExplicit: true,
      capabilities: {
        ci_lane_enabled: true,
        ci_plan_only: false,
        ci_generate_patch_artifact: true,
      },
      checks: [
        {
          id: "repo.has-core-packs",
          type: "path_exists",
          path: "packs/core",
          required: true,
        },
      ],
      patchCandidates: [
        {
          id: "docs-ci-note",
          path: "docs/ci-note.txt",
          after: "after\n",
          description: "proposal-only change",
        },
      ],
      provenance: {
        runtime: "codex_cli",
        execution_context: "compat-lab",
        trigger_type: "manual",
        shim_status: "shim",
        live_evidence: false,
      },
    });

    assert.equal(result.report.kind, "ci-lane-report");
    assert.equal(result.report.status, "pass");
    assert.equal(result.artifacts.length, 1);
    assert.equal(result.artifacts[0].kind, "ci-patch-artifact");
    assert.equal(result.artifacts[0].label, "candidate-artifact");
    assert.equal(result.artifacts[0].authoritative, false);
    assert.equal(result.artifacts[0].truth_tier, "supplemental");
    assert.ok(result.artifacts[0].diff.includes("diff --git"));

    assert.equal(result.provenance.kind, "ci-provenance");
    assert.equal(typeof result.provenance.ci_run_id, "string");
    assert.notEqual(result.provenance.ci_run_id, "");
    assert.equal(typeof result.provenance.repo_snapshot_ref, "string");
    assert.equal(result.provenance.runtime, "codex_cli");
    assert.equal(result.provenance.execution_context, "compat-lab");
    assert.equal(result.provenance.source_pack_id, "pairslash-ci-addon");
    assert.equal(result.provenance.lane_package_version, "0.1.0");
    assert.equal(typeof result.provenance.policy_verdict, "string");
    assert.equal(result.provenance.shim_status, "shim");
    assert.equal(result.provenance.live_evidence, false);
    assert.equal(result.provenance.evidence_tier, "deterministic-simulated");
  } finally {
    fixture.cleanup();
  }
});

test("ci provenance distinguishes simulated and live evidence tiers", serial, () => {
  const fixture = createTempRepo();
  try {
    const simulated = runCiLane({
      repoRoot: fixture.tempRoot,
      invocation: "explicit",
      repoPolicyExplicit: true,
      capabilities: {
        ci_lane_enabled: true,
        ci_plan_only: false,
      },
      provenance: {
        runtime: "codex_cli",
        shim_status: "shim",
        live_evidence: false,
      },
    });
    const live = runCiLane({
      repoRoot: fixture.tempRoot,
      invocation: "explicit",
      repoPolicyExplicit: true,
      capabilities: {
        ci_lane_enabled: true,
        ci_plan_only: false,
      },
      provenance: {
        runtime: "codex_cli",
        shim_status: "none",
        live_evidence: true,
      },
    });

    assert.equal(simulated.provenance.evidence_tier, "deterministic-simulated");
    assert.equal(live.provenance.evidence_tier, "live-disposable");
  } finally {
    fixture.cleanup();
  }
});

test("ci package absent does not break core lint command", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  const ciPackagePath = join(repoRoot, "packages", "advanced", "ci-engine");
  const temporaryMissingPath = join(repoRoot, "packages", "advanced", "ci-engine.__tmp_missing__");
  let output = "";

  if (existsSync(temporaryMissingPath)) {
    rmSync(temporaryMissingPath, { recursive: true, force: true });
  }

  try {
    assert.equal(existsSync(ciPackagePath), true);
    renameSync(ciPackagePath, temporaryMissingPath);

    const exitCode = await runCli({
      argv: ["lint", "pairslash-plan", "--runtime", "all", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });

    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.equal(payload.kind, "lint-report");
    assert.equal(payload.ok, true);
  } finally {
    if (existsSync(temporaryMissingPath)) {
      renameSync(temporaryMissingPath, ciPackagePath);
    }
    fixture.cleanup();
  }
});

test("advanced ci pack manifest stays aligned with lane defaults", serial, () => {
  const manifestPath = join(repoRoot, "packs", "advanced", "ci", "pack.manifest.yaml");
  const manifest = YAML.parse(readFileSync(manifestPath, "utf8"));

  assert.equal(manifest.package.name, "@pairslash/ci-engine-advanced");
  assert.deepEqual(manifest.capability_flags, CI_CAPABILITY_DEFAULTS);
  assert.deepEqual(manifest.policy_contract.decisions, CI_POLICY_CONTRACT.decisions);
  assert.equal(manifest.policy_contract.no_direct_commit, true);
  assert.equal(manifest.policy_contract.no_direct_global_memory_write, true);
});
