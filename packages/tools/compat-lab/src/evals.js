import { existsSync } from "node:fs";
import { join } from "node:path";

import { previewMemoryWrite } from "@pairslash/memory-engine";
import { planInstall } from "@pairslash/installer";
import { runDoctor } from "@pairslash/doctor";
import { loadPackManifestRecords, stableYaml, writeTextFile } from "@pairslash/spec-core";

import { materializeCompatFixture } from "./materialize.js";
import { installCompatRuntimeShims } from "./runtime-fixtures.js";

const FIXED_MEMORY_REQUEST = Object.freeze({
  kind: "constraint",
  title: "Compat lab explicit write discipline",
  statement: "Phase 6 preview behavior must stay explicit and reviewable.",
  evidence: "compat-lab regression fixture",
  scope: "whole-project",
  confidence: "high",
  action: "append",
  tags: ["compat-lab", "phase6"],
  source_refs: ["packages/tools/compat-lab/src/evals.js"],
  updated_by: "compat-lab",
  timestamp: "2026-03-28T00:00:00.000Z",
});

export const DEFAULT_COMPAT_EVALS = [
  {
    id: "workflow-selection.node-service.codex",
    category: "workflow_selection",
    fixture_id: "repo-node-service",
  },
  {
    id: "policy-gates.write-authority.hidden-write",
    category: "policy_gates",
    fixture_id: "repo-write-authority-memory",
  },
  {
    id: "compatibility-errors.conflict-existing-runtime.copilot",
    category: "compatibility_errors",
    fixture_id: "repo-conflict-existing-runtime",
  },
  {
    id: "preview-behavior.docs-heavy.codex",
    category: "preview_behavior",
    fixture_id: "repo-docs-heavy",
  },
  {
    id: "degraded-lane.windows-prep.codex",
    category: "degraded_lane_handling",
    fixture_id: "repo-node-service",
  },
  {
    id: "no-silent-fallback.unsafe-repo.codex",
    category: "no_silent_fallback",
    fixture_id: "repo-unsafe-repo",
  },
];

function mutateManifest(tempRoot, packId, mutate) {
  const record = loadPackManifestRecords(tempRoot).find((entry) => entry.packId === packId && !entry.error);
  if (!record) {
    throw new Error(`could not locate manifest for ${packId}`);
  }
  const updated = mutate(structuredClone(record.manifest)) ?? record.manifest;
  writeTextFile(record.manifestPath, stableYaml(updated));
}

function buildEvalResult(definition, payload, durationMs) {
  return {
    id: definition.id,
    category: definition.category,
    fixture_id: definition.fixture_id,
    status: payload.success ? "pass" : "fail",
    duration_ms: durationMs,
    summary: payload.summary,
    details: payload.details ?? {},
  };
}

function runEval(definition, execute) {
  const startedAt = Date.now();
  try {
    const payload = execute();
    return buildEvalResult(definition, payload, Date.now() - startedAt);
  } catch (error) {
    return buildEvalResult(
      definition,
      {
        success: false,
        summary: error.message,
        details: {
          error_message: error.message,
        },
      },
      Date.now() - startedAt,
    );
  }
}

function withFixture({ repoRoot, fixtureId, runtimeHarness, target = "repo" }, run) {
  const materialized = materializeCompatFixture({
    repoRoot,
    fixtureId,
  });
  try {
    if (target === "user") {
      runtimeHarness.setHome(materialized.homeRoot);
    } else {
      runtimeHarness.restoreHome();
    }
    return run(materialized);
  } finally {
    runtimeHarness.restoreHome();
    materialized.cleanup();
  }
}

function runWorkflowSelectionEval({ repoRoot, runtimeHarness }) {
  const definition = DEFAULT_COMPAT_EVALS.find((entry) => entry.id === "workflow-selection.node-service.codex");
  return runEval(definition, () =>
    withFixture(
      {
        repoRoot,
        fixtureId: definition.fixture_id,
        runtimeHarness,
      },
      ({ tempRoot, fixture }) => {
        const report = runDoctor({
          repoRoot: tempRoot,
          runtime: "codex_cli",
          target: "repo",
          packs: fixture.source_packs,
          _os_override: "darwin",
          _shell_override: "zsh",
        });
        const success =
          report.first_workflow_guidance.recommended_pack_id === fixture.primary_pack_id &&
          report.first_workflow_guidance.commands.some((command) =>
            command.includes(`preview install ${fixture.primary_pack_id}`)
          );
        return {
          success,
          summary: success
            ? "doctor selects the backend workflow for a node-service fixture"
            : "doctor did not recommend the expected workflow for the node-service fixture",
          details: {
            recommended_pack_id: report.first_workflow_guidance.recommended_pack_id,
            commands: report.first_workflow_guidance.commands.slice(),
          },
        };
      },
    )
  );
}

function runPolicyGateEval({ repoRoot, runtimeHarness }) {
  const definition = DEFAULT_COMPAT_EVALS.find((entry) => entry.id === "policy-gates.write-authority.hidden-write");
  return runEval(definition, () =>
    withFixture(
      {
        repoRoot,
        fixtureId: definition.fixture_id,
        runtimeHarness,
      },
      ({ tempRoot }) => {
        const preview = previewMemoryWrite({
          repoRoot: tempRoot,
          request: FIXED_MEMORY_REQUEST,
          runtime: "codex_cli",
          target: "repo",
          policyContext: {
            hidden_write_attempted: true,
          },
        });
        const reasonCodes = (preview.policy_verdict.reasons ?? []).map((reason) => reason.code);
        const success =
          preview.policy_verdict.overall_verdict === "deny" &&
          reasonCodes.includes("POLICY-HIDDEN-WRITE-BLOCKED") &&
          preview.ready_for_apply === false;
        return {
          success,
          summary: success
            ? "memory preview blocks hidden authoritative writes explicitly"
            : "memory preview failed to block hidden authoritative writes",
          details: {
            overall_verdict: preview.policy_verdict.overall_verdict,
            reason_codes: reasonCodes,
            ready_for_apply: preview.ready_for_apply,
          },
        };
      },
    )
  );
}

function runCompatibilityErrorEval({ repoRoot, runtimeHarness }) {
  const definition = DEFAULT_COMPAT_EVALS.find(
    (entry) => entry.id === "compatibility-errors.conflict-existing-runtime.copilot",
  );
  return runEval(definition, () =>
    withFixture(
      {
        repoRoot,
        fixtureId: definition.fixture_id,
        runtimeHarness,
      },
      ({ tempRoot, fixture }) => {
        const preview = planInstall({
          repoRoot: tempRoot,
          runtime: "copilot_cli",
          target: "repo",
          packs: fixture.source_packs,
        });
        const blockedOperationCount = preview.plan.operations.filter(
          (operation) => operation.kind === "blocked_conflict",
        ).length;
        const success = !preview.plan.can_apply && blockedOperationCount > 0;
        return {
          success,
          summary: success
            ? "compatibility errors are surfaced as explicit blocked conflicts"
            : "runtime conflicts were not surfaced as explicit blocked conflicts",
          details: {
            can_apply: preview.plan.can_apply,
            blocked_operation_count: blockedOperationCount,
            errors: preview.plan.errors.slice(),
          },
        };
      },
    )
  );
}

function runPreviewBehaviorEval({ repoRoot, runtimeHarness }) {
  const definition = DEFAULT_COMPAT_EVALS.find((entry) => entry.id === "preview-behavior.docs-heavy.codex");
  return runEval(definition, () =>
    withFixture(
      {
        repoRoot,
        fixtureId: definition.fixture_id,
        runtimeHarness,
      },
      ({ tempRoot, fixture }) => {
        const preview = planInstall({
          repoRoot: tempRoot,
          runtime: "codex_cli",
          target: "repo",
          packs: fixture.source_packs,
        });
        const installDir = join(tempRoot, ".agents", "skills", fixture.primary_pack_id);
        const success =
          preview.plan.preview_boundary.no_commit_on_preview === true &&
          preview.plan.preview_boundary.preview_only === true &&
          existsSync(installDir) === false;
        return {
          success,
          summary: success
            ? "preview stays non-mutating for the docs-heavy fixture"
            : "preview mutated the fixture or lost explicit preview boundaries",
          details: {
            preview_boundary: { ...preview.plan.preview_boundary },
            install_dir_exists: existsSync(installDir),
          },
        };
      },
    )
  );
}

function runDegradedLaneEval({ repoRoot, runtimeHarness }) {
  const definition = DEFAULT_COMPAT_EVALS.find((entry) => entry.id === "degraded-lane.windows-prep.codex");
  return runEval(definition, () =>
    withFixture(
      {
        repoRoot,
        fixtureId: definition.fixture_id,
        runtimeHarness,
      },
      ({ tempRoot }) => {
        const report = runDoctor({
          repoRoot: tempRoot,
          runtime: "codex_cli",
          target: "repo",
          _os_override: "win32",
          _shell_override: "powershell",
        });
        const success =
          report.support_lane.lane_status === "prep" &&
          report.support_verdict === "degraded";
        return {
          success,
          summary: success
            ? "Windows prep lane is reported explicitly as degraded"
            : "Windows prep lane semantics regressed",
          details: {
            lane_status: report.support_lane.lane_status,
            support_verdict: report.support_verdict,
            summary: report.support_lane.summary,
          },
        };
      },
    )
  );
}

function runNoSilentFallbackEval({ repoRoot, runtimeHarness }) {
  const definition = DEFAULT_COMPAT_EVALS.find((entry) => entry.id === "no-silent-fallback.unsafe-repo.codex");
  return runEval(definition, () =>
    withFixture(
      {
        repoRoot,
        fixtureId: definition.fixture_id,
        runtimeHarness,
      },
      ({ tempRoot, fixture }) => {
        mutateManifest(tempRoot, fixture.primary_pack_id, (manifest) => {
          manifest.runtime_bindings.copilot_cli.compatibility.direct_invocation = "blocked";
          manifest.runtime_targets.copilot_cli.compatibility.direct_invocation = "blocked";
          return manifest;
        });
        const preview = planInstall({
          repoRoot: tempRoot,
          runtime: "codex_cli",
          target: "repo",
          packs: fixture.source_packs,
        });
        const success =
          preview.plan.policy_summary.no_silent_fallback === true &&
          preview.plan.policy_summary.unsupported_runtime_capability === true &&
          preview.plan.commitability.blocked === true &&
          preview.plan.can_apply === false;
        return {
          success,
          summary: success
            ? "unsupported runtime capability is blocked without silent fallback"
            : "unsupported capability did not produce an explicit no-silent-fallback block",
          details: {
            policy_summary: { ...preview.plan.policy_summary },
            commitability: { ...preview.plan.commitability },
          },
        };
      },
    )
  );
}

export function runCompatBehaviorEvals({ repoRoot } = {}) {
  const runtimeHarness = installCompatRuntimeShims();
  try {
    const results = [
      runWorkflowSelectionEval({ repoRoot, runtimeHarness }),
      runPolicyGateEval({ repoRoot, runtimeHarness }),
      runCompatibilityErrorEval({ repoRoot, runtimeHarness }),
      runPreviewBehaviorEval({ repoRoot, runtimeHarness }),
      runDegradedLaneEval({ repoRoot, runtimeHarness }),
      runNoSilentFallbackEval({ repoRoot, runtimeHarness }),
    ];
    return {
      kind: "compat-behavior-eval-suite",
      status: results.every((result) => result.status === "pass") ? "pass" : "fail",
      results,
      summary: {
        total: results.length,
        passed: results.filter((result) => result.status === "pass").length,
        failed: results.filter((result) => result.status !== "pass").length,
      },
    };
  } finally {
    runtimeHarness.cleanup();
  }
}

export function formatCompatBehaviorEvalsText(report) {
  const lines = [
    "Compat behavior eval suite",
    `Status: ${report.status.toUpperCase()}`,
    `Passing: ${report.summary.passed}/${report.summary.total}`,
    "",
  ];
  for (const result of report.results) {
    lines.push(`- ${result.id}: ${result.status.toUpperCase()} (${result.duration_ms}ms)`);
    lines.push(`  ${result.summary}`);
  }
  return `${lines.join("\n")}\n`;
}
