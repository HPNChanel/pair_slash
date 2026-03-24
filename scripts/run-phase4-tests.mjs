import { spawnSync } from "node:child_process";
import process from "node:process";

const testFiles = [
  "packages/spec-core/tests/spec-core.test.js",
  "packages/lint-bridge/tests/lint-bridge.test.js",
  "packages/compiler-codex/tests/compiler-codex.test.js",
  "packages/compiler-copilot/tests/compiler-copilot.test.js",
  "packages/installer/tests/installer.test.js",
  "packages/doctor/tests/doctor.test.js",
  "packages/cli/tests/cli.test.js",
  "packages/compat-lab/tests/compat-lab.test.js",
];

let exitCode = 0;

for (const testFile of testFiles) {
  const result = spawnSync(process.execPath, ["--test", testFile], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    exitCode = result.status ?? 1;
    break;
  }
}

process.exitCode = exitCode;
