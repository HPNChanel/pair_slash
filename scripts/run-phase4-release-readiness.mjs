import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const requiredDocs = [
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

const result = spawnSync(process.execPath, ["scripts/run-phase4-tests.mjs"], {
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Phase 4 automated release-readiness checks passed.");
