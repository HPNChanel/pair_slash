import { existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import process from "node:process";
import { validateReleaseTrustBootstrap } from "@pairslash/spec-core";

const repoRoot = process.cwd();
const requiredDocs = [
  "docs/phase-12/authoritative-program-charter.md",
  "docs/architecture/phase-18-workflow-maturity-charter.md",
  "docs/architecture/phase-18-workflow-maturity-wording-system.md",
  "docs/releases/legal-packaging-status.md",
  "docs/releases/public-claim-policy.md",
  "docs/releases/scoped-release-verdict.md",
  "docs/releases/changelog-0.4.0.md",
  "docs/releases/upgrade-notes-0.4.0.md",
  "docs/compatibility/compatibility-matrix.md",
  "docs/compatibility/runtime-surface-matrix.yaml",
  "docs/compatibility/runtime-verification.md",
  "docs/troubleshooting/compat-lab-bug-repro.md",
  "packages/tools/compat-lab/fixtures/README.md",
  "packages/tools/compat-lab/fixtures/repos/README.md",
  "docs-private/releases/release-checklist-0.4.0.md",
  "docs-private/releases/phase-4-acceptance-checklist.md",
  "trust/first-party-keys.json",
  "trust/pack-authority.yaml",
  "trust/trust-policy.yaml",
  "trust/version-policy.yaml",
];

function runNodeScript(args, env = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      ...env,
    },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function requireDocs() {
  for (const file of requiredDocs) {
    if (!existsSync(resolve(repoRoot, file))) {
      console.error(`missing required release doc or trust asset: ${file}`);
      process.exit(1);
    }
  }
}

function requireTrustBootstrap() {
  const validation = validateReleaseTrustBootstrap({ repoRoot });
  if (validation.ok) {
    return;
  }
  console.error("release-trust bootstrap validation failed:");
  for (const failure of validation.failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

function hasSigningEnv() {
  return Boolean(
    process.env.PAIRSLASH_RELEASE_TRUST_PRIVATE_KEY?.trim() &&
      process.env.PAIRSLASH_RELEASE_TRUST_KEY_ID?.trim(),
  );
}

function requireSignedVerification() {
  return process.env.PAIRSLASH_RELEASE_TRUST_REQUIRE_SIGNED === "1";
}

function makeTrustTempDir(prefix) {
  const releaseRoot = join(repoRoot, ".pairslash", "tmp", "release-trust");
  mkdirSync(releaseRoot, { recursive: true });
  const name = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  return join(releaseRoot, name);
}

function runStructuralTrustGate() {
  const trustDir = makeTrustTempDir("structural");
  try {
    runNodeScript(["scripts/build-release-trust.mjs", "--out", trustDir]);
    runNodeScript(["scripts/verify-release-trust.mjs", "--trust-dir", trustDir, "--mode", "structural"]);
  } finally {
    rmSync(trustDir, { recursive: true, force: true });
  }
}

function runSignedTrustGate() {
  const trustDir = makeTrustTempDir("signed");
  try {
    runNodeScript(["scripts/build-release-trust.mjs", "--out", trustDir]);
    runNodeScript(["scripts/verify-release-trust.mjs", "--trust-dir", trustDir]);
  } finally {
    rmSync(trustDir, { recursive: true, force: true });
  }
}

requireDocs();
requireTrustBootstrap();
runNodeScript(["scripts/run-compat-lab-release-readiness.mjs"]);
runStructuralTrustGate();

if (requireSignedVerification()) {
  if (!hasSigningEnv()) {
    console.error(
      "signed release-trust verification is required but PAIRSLASH_RELEASE_TRUST_PRIVATE_KEY / PAIRSLASH_RELEASE_TRUST_KEY_ID are missing",
    );
    process.exit(1);
  }
  runSignedTrustGate();
}

console.log("Release-readiness checks passed.");
