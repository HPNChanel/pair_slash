import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

export const COMPAT_RUNTIME_FIXTURE_MODE = "deterministic_fake_shim_acceptance";

export const COMPAT_RUNTIME_FIXTURE_EVIDENCE_CLASSES = Object.freeze({
  deterministic: "deterministic_test",
  fake: "fake_acceptance",
  shim: "shim_acceptance",
  live: "live_verification",
});

export const COMPAT_RUNTIME_FIXTURE_BOUNDARY = Object.freeze({
  live_evidence_collected: false,
  public_support_promotion_allowed: false,
  live_registry_root: "docs/evidence/live-runtime",
  live_runbook_ref: "docs/compatibility/runtime-verification.md",
});

export const COMPAT_RUNTIME_FIXTURE_REFS = Object.freeze({
  deterministic_refs: [
    "packages/tools/compat-lab/tests/acceptance.test.js",
    "packages/tools/compat-lab/tests/matrix.test.js",
  ],
  fake_acceptance_refs: ["packages/tools/compat-lab/src/acceptance.js"],
  shim_acceptance_refs: ["packages/tools/compat-lab/src/runtime-fixtures.js"],
  live_evidence_refs: [],
});

function writeExecutable(path: string, contents: any) {
  writeFileSync(path, contents, { mode: 0o755 });
  try {
    chmodSync(path, 0o755);
  } catch {
    // chmod is best-effort for cross-platform test harnesses.
  }
}

function writeCodexShim(binDir: any, version: string) {
  writeFileSync(
    join(binDir, "codex.cmd"),
    [
      "@echo off",
      "if \"%1\"==\"--version\" (",
      `  echo ${version}`,
      "  exit /b 0",
      ")",
      "echo unsupported codex command 1>&2",
      "exit /b 1",
      "",
    ].join("\r\n"),
  );
  if (process.platform === "win32") {
    return;
  }
  writeExecutable(
    join(binDir, "codex"),
    [
      "#!/bin/sh",
      "if [ \"$1\" = \"--version\" ]; then",
      `  printf '%s\\n' '${version}'`,
      "  exit 0",
      "fi",
      "printf '%s\\n' 'unsupported codex command' >&2",
      "exit 1",
      "",
    ].join("\n"),
  );
}

function writeCopilotShim(binDir: any, copilotVersion: any, ghVersion: any, { standaloneBinary = true }: { standaloneBinary?: any } = {}) {
  writeFileSync(
    join(binDir, "gh.cmd"),
    [
      "@echo off",
      "if \"%1\"==\"--version\" (",
      `  echo gh version ${ghVersion}`,
      "  exit /b 0",
      ")",
      "if \"%1\"==\"copilot\" if \"%2\"==\"--help\" (",
      "  echo gh copilot help",
      "  exit /b 0",
      ")",
      "if \"%1\"==\"copilot\" if \"%2\"==\"--version\" (",
      `  echo ${copilotVersion}`,
      "  exit /b 0",
      ")",
      "echo unsupported gh command 1>&2",
      "exit /b 1",
      "",
    ].join("\r\n"),
  );
  if (standaloneBinary) {
    writeFileSync(
      join(binDir, "copilot.cmd"),
      [
        "@echo off",
        "if \"%1\"==\"--version\" (",
        `  echo ${copilotVersion}`,
        "  exit /b 0",
        ")",
        "if \"%1\"==\"--help\" (",
        "  echo copilot help",
        "  exit /b 0",
        ")",
        "echo unsupported copilot command 1>&2",
        "exit /b 1",
        "",
      ].join("\r\n"),
    );
  }
  if (process.platform === "win32") {
    return;
  }
  writeExecutable(
    join(binDir, "gh"),
    [
      "#!/bin/sh",
      "if [ \"$1\" = \"--version\" ]; then",
      `  printf '%s\\n' 'gh version ${ghVersion}'`,
      "  exit 0",
      "fi",
      "if [ \"$1\" = \"copilot\" ] && [ \"$2\" = \"--help\" ]; then",
      "  printf '%s\\n' 'gh copilot help'",
      "  exit 0",
      "fi",
      "if [ \"$1\" = \"copilot\" ] && [ \"$2\" = \"--version\" ]; then",
      `  printf '%s\\n' '${copilotVersion}'`,
      "  exit 0",
      "fi",
      "printf '%s\\n' 'unsupported gh command' >&2",
      "exit 1",
      "",
    ].join("\n"),
  );
  if (standaloneBinary) {
    writeExecutable(
      join(binDir, "copilot"),
      [
        "#!/bin/sh",
        "if [ \"$1\" = \"--version\" ]; then",
        `  printf '%s\\n' '${copilotVersion}'`,
        "  exit 0",
        "fi",
        "if [ \"$1\" = \"--help\" ]; then",
        "  printf '%s\\n' 'copilot help'",
        "  exit 0",
        "fi",
        "printf '%s\\n' 'unsupported copilot command' >&2",
        "exit 1",
        "",
      ].join("\n"),
    );
  }
}

export function installCompatRuntimeShims({
  codexVersion = "0.153.4",
  copilotVersion = "1.0.88",
  ghVersion = "2.96.0",
  standaloneCopilotBinary = true,
}: any = {}) {
  const binDir = join(tmpdir(), `pairslash-compat-runtime-${process.pid}-${Date.now()}`);
  mkdirSync(binDir, { recursive: true });

  const previousPath = process.env.PATH ?? "";
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  const previousCodexVersion = process.env.PAIRSLASH_FAKE_CODEX_VERSION;
  const previousCopilotVersion = process.env.PAIRSLASH_FAKE_COPILOT_VERSION;

  writeCodexShim(binDir, codexVersion);
  writeCopilotShim(binDir, copilotVersion, ghVersion, { standaloneBinary: standaloneCopilotBinary });

  process.env.PATH = `${binDir}${delimiter}${previousPath}`;
  process.env.PAIRSLASH_FAKE_CODEX_VERSION = codexVersion;
  process.env.PAIRSLASH_FAKE_COPILOT_VERSION = copilotVersion;

  return {
    binDir,
    setHome(homePath: any) {
      mkdirSync(homePath, { recursive: true });
      process.env.HOME = homePath;
      process.env.USERPROFILE = homePath;
    },
    restoreHome() {
      process.env.HOME = previousHome;
      process.env.USERPROFILE = previousUserProfile;
    },
    cleanup() {
      process.env.PATH = previousPath;
      process.env.HOME = previousHome;
      process.env.USERPROFILE = previousUserProfile;
      if (previousCodexVersion === undefined) {
        delete process.env.PAIRSLASH_FAKE_CODEX_VERSION;
      } else {
        process.env.PAIRSLASH_FAKE_CODEX_VERSION = previousCodexVersion;
      }
      if (previousCopilotVersion === undefined) {
        delete process.env.PAIRSLASH_FAKE_COPILOT_VERSION;
      } else {
        process.env.PAIRSLASH_FAKE_COPILOT_VERSION = previousCopilotVersion;
      }
      rmSync(binDir, { recursive: true, force: true });
    },
  };
}

export const installFakeRuntimes = installCompatRuntimeShims;
