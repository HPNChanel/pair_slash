import { spawnSync } from "node:child_process";
import process from "node:process";

const testFiles = [
  "packages/core/spec-core/tests/spec-core.test.js",
  "packages/core/spec-core/tests/manifest-v2.conformance.test.js",
  "packages/core/spec-core/tests/project-memory.test.js",
  "packages/core/contract-engine/tests/contract-engine.test.js",
  "tests/contracts/contract-engine.contracts.test.js",
  "packages/core/policy-engine/tests/policy-engine.test.js",
  "tests/policy/policy-engine.contracts.test.js",
  "packages/runtimes/codex/adapter/tests/runtime-codex-adapter.test.js",
  "packages/runtimes/copilot/adapter/tests/runtime-copilot-adapter.test.js",
  "packages/core/memory-engine/tests/memory-engine.test.js",
  "packages/tools/lint-bridge/tests/lint-bridge.test.js",
  "packages/runtimes/codex/compiler/tests/compiler-codex.test.js",
  "packages/runtimes/copilot/compiler/tests/compiler-copilot.test.js",
  "packages/tools/installer/tests/installer.test.js",
  "packages/tools/trace/tests/trace.test.js",
  "packages/tools/doctor/tests/doctor.test.js",
  "packages/tools/cli/tests/cli.test.js",
  "tests/repo-normalization.test.js",
  "tests/truth-governance.test.js",
  "tests/phase11/retrieval-lane.test.js",
  "tests/phase11/ci-lane.test.js",
  "tests/phase11/delegation-lane.test.js",
  "tests/preview/preview.command.test.js",
  "tests/phase5/phase5.hardening-sweep.test.js",
  "packages/tools/compat-lab/tests/compat-lab.test.js",
  "packages/tools/compat-lab/tests/acceptance.test.js",
  "packages/tools/compat-lab/tests/evals.test.js",
  "packages/tools/compat-lab/tests/matrix.test.js",
  "packages/tools/compat-lab/tests/docs-surface.test.js",
];

let exitCode = 0;

for (const testFile of testFiles) {
  const result = spawnSync(process.execPath, [testFile], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    exitCode = result.status ?? 1;
    break;
  }
}

process.exitCode = exitCode;
