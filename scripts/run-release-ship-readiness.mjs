import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const REQUIRED_EVIDENCE_PATH = "docs-private/releases/release-candidate-evidence-0.4.0.md";
const REQUIRED_CHECKLIST_PATH = "docs-private/releases/release-checklist-0.4.0.md";
const REQUIRED_VERDICT_PATH = "docs/releases/scoped-release-verdict.md";
const REQUIRED_CHANGELOG_PATH = "docs/releases/changelog-0.4.0.md";
const REQUIRED_CHECKLIST_ITEMS = [
  "`npm run test:release`",
  "`node scripts/build-release-trust.mjs --out .pairslash/tmp/release-checklist-trust`",
  "`node scripts/verify-release-trust.mjs --trust-dir .pairslash/tmp/release-checklist-trust --mode structural`",
  "Protected CI signed bundle build + verify completed for the release candidate when live-signed publication is intended",
  "`.github/workflows/release-trust-candidate.yml` passed for the candidate with signed artifact upload",
  "`docs-private/releases/release-candidate-evidence-0.4.0.md` includes the protected candidate run id, artifact name, verify result, key id, and commit/tag binding",
  "`npm run test:release:ship`",
  "`npm run test:support`",
];

function runNodeScript(args) {
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function parseGateStatus(contents) {
  const match = contents.match(/Gate status:\s*`?([A-Z-]+)`?/i);
  return match ? match[1].toUpperCase() : null;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function requireFiles(paths) {
  for (const path of paths) {
    if (!existsSync(path)) {
      console.error(`missing required ship-readiness file: ${path}`);
      process.exit(1);
    }
  }
}

function verifyGateStatus(path, label) {
  const contents = readFileSync(path, "utf8");
  const status = parseGateStatus(contents);
  if (status !== "GO") {
    console.error(`${label} must be GO before ship, found: ${status ?? "missing"}`);
    process.exit(1);
  }
}

function verifyChecklist(path) {
  const contents = readFileSync(path, "utf8");
  const missingItems = REQUIRED_CHECKLIST_ITEMS.filter((item) => {
    const pattern = new RegExp(`^- \\[x\\] ${escapeRegex(item)}$`, "m");
    return !pattern.test(contents);
  });
  if (missingItems.length > 0) {
    console.error("release checklist is missing required completed ship items:");
    for (const item of missingItems) {
      console.error(`- ${item}`);
    }
    process.exit(1);
  }
}

requireFiles([
  REQUIRED_EVIDENCE_PATH,
  REQUIRED_CHECKLIST_PATH,
  REQUIRED_VERDICT_PATH,
  REQUIRED_CHANGELOG_PATH,
]);

runNodeScript(["scripts/run-release-readiness.mjs"]);
runNodeScript([
  "scripts/verify-release-candidate-evidence.mjs",
  "--evidence",
  REQUIRED_EVIDENCE_PATH,
]);
verifyGateStatus(REQUIRED_VERDICT_PATH, "scoped release verdict");
verifyGateStatus(REQUIRED_CHANGELOG_PATH, "public changelog gate status");
verifyChecklist(REQUIRED_CHECKLIST_PATH);

console.log("Release ship-readiness checks passed.");
