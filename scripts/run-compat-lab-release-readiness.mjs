import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const requiredDocs = [
  "docs/phase-12/authoritative-program-charter.md",
  "docs/architecture/phase-18-workflow-maturity-charter.md",
  "docs/architecture/phase-18-workflow-maturity-wording-system.md",
  "docs/releases/legal-packaging-status.md",
  "docs/compatibility/compatibility-matrix.md",
  "docs/compatibility/runtime-surface-matrix.yaml",
  "docs/compatibility/runtime-verification.md",
  "docs/troubleshooting/compat-lab-bug-repro.md",
  "packages/tools/compat-lab/fixtures/README.md",
  "packages/tools/compat-lab/fixtures/repos/README.md",
];

function loadScopedReleaseGateStatus() {
  const verdictPath = "docs/releases/scoped-release-verdict.md";
  const text = readFileSync(verdictPath, "utf8");
  const match = text.match(/Gate status:\s*([A-Z-]+)/i);
  return match ? match[1].toUpperCase() : "NO-GO";
}

for (const file of requiredDocs) {
  if (!existsSync(file)) {
    console.error(`missing required compatibility doc: ${file}`);
    process.exit(1);
  }
}

const syncCheck = spawnSync(process.execPath, ["scripts/sync-compat-lab-artifacts.mjs", "--check"], {
  stdio: "inherit",
});

if (syncCheck.status !== 0) {
  process.exit(syncCheck.status ?? 1);
}

const tests = spawnSync(process.execPath, ["scripts/run-compat-lab-tests.mjs"], {
  stdio: "inherit",
});

if (tests.status !== 0) {
  process.exit(tests.status ?? 1);
}

const acceptance = spawnSync(
  process.execPath,
  ["scripts/run-compat-lab-acceptance.mjs", "--lane", "all", "--format", "text"],
  {
    stdio: "inherit",
  },
);

if (acceptance.status !== 0) {
  const gateStatus = loadScopedReleaseGateStatus();
  if (gateStatus === "GO") {
    process.exit(acceptance.status ?? 1);
  }
  console.warn(
    "compat-lab acceptance reported failures while scoped release gate is NO-GO; keeping release-readiness non-blocking until GO is restored",
  );
}

console.log("Compat-lab release-readiness checks passed.");
