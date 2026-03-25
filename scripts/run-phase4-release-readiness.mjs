import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const requiredDocs = [
  "docs/validation/phase-3-5/README.md",
  "docs/validation/phase-3-5/problem-statement.md",
  "docs/validation/phase-3-5/benchmark-tasks.md",
  "docs/validation/phase-3-5/scoring-rubric.md",
  "docs/validation/phase-3-5/runbook.md",
  "docs/validation/phase-3-5/evidence-log.md",
  "docs/validation/phase-3-5/messaging-narrative.md",
  "docs/validation/phase-3-5/verdict.md",
  "docs/architecture/pack-manifest-v2-practical-spec.md",
  "docs/architecture/compiler-v2-implement-oriented.md",
  "docs/workflows/phase-4-install-commands.md",
  "docs/workflows/phase-4-doctor-troubleshooting.md",
  "docs/releases/release-checklist-0.4.0.md",
  "packages/compat-lab/fixtures/README.md",
];

for (const file of requiredDocs) {
  if (!existsSync(file)) {
    console.error(`missing required Phase 4 release doc: ${file}`);
    process.exit(1);
  }
}

const verdictFile = "docs/validation/phase-3-5/verdict.md";
const verdictContents = readFileSync(verdictFile, "utf8");
const evidenceLogFile = "docs/validation/phase-3-5/evidence-log.md";
const evidenceLogContents = readFileSync(evidenceLogFile, "utf8");

if (!/^Gate status: GO$/m.test(verdictContents)) {
  console.error(
    `Phase 3.5 validation gate is not GO in ${verdictFile}. ` +
      "Do not declare Phase 4 release readiness until problem-solution evidence passes."
  );
  process.exit(1);
}

if (!/^### Recorded Run ID:/m.test(evidenceLogContents)) {
  console.error(
    `Phase 3.5 evidence log has no recorded benchmark runs in ${evidenceLogFile}. ` +
      "Do not declare Phase 4 release readiness without run evidence."
  );
  process.exit(1);
}

const result = spawnSync(process.execPath, ["scripts/run-phase4-tests.mjs"], {
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Phase 4 automated release-readiness checks passed.");
