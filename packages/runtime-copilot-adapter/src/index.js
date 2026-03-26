import { accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { basename, join, posix } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

export const runtime = "copilot_cli";
export const shortName = "copilot";
export const bundleKind = "copilot-package-bundle";
export const canonicalEntrypoint = "/skills";
export const executable = "gh";
export const supportedInstallSurfaces = [
  "canonical_skill",
  "support_doc",
  "metadata",
  "agent",
  "hook",
  "mcp",
];

export function renderDirectInvocation(packId) {
  return `/${packId}`;
}

export function resolveConfigHome({ repoRoot, target }) {
  return target === "repo" ? join(repoRoot, ".github") : join(homedir(), ".copilot");
}

export function resolveInstallRoot(options) {
  return join(resolveConfigHome(options), "skills");
}

export function resolvePackInstallDir(options, packId) {
  return join(resolveInstallRoot(options), packId);
}

export function resolveAssetPath(asset) {
  switch (asset.install_surface) {
    case "canonical_skill":
    case "support_doc":
      return asset.source_relpath ?? asset.file_name;
    case "metadata":
      return posix.join("package", asset.file_name);
    case "agent":
      return posix.join("agents", asset.file_name);
    case "hook":
      return posix.join("hooks", asset.file_name);
    case "mcp":
      return posix.join("mcp", asset.file_name);
    default:
      throw new Error(`copilot runtime does not support install surface ${asset.install_surface}`);
  }
}

function toPosix(value) {
  return value.split("\\").join("/");
}

export function validateAssetRelativePath(asset, relativePath) {
  const normalizedPath = toPosix(relativePath);
  const expectedPath = resolveAssetPath({
    install_surface: asset.install_surface,
    source_relpath: asset.source_relpath ?? asset.source_path ?? null,
    file_name: asset.file_name ?? basename(normalizedPath),
  });
  if (normalizedPath !== expectedPath) {
    throw new Error(
      `copilot runtime path ${normalizedPath} does not match install surface ${asset.install_surface} -> ${expectedPath}`,
    );
  }
  return normalizedPath;
}

export function resolveRuntimeAssetPath(asset) {
  const candidate =
    asset.generated_relpath ??
    asset.generated_path ??
    asset.source_relpath ??
    asset.source_path ??
    asset.file_name;
  if (!candidate) {
    throw new Error("copilot runtime asset is missing a relative path");
  }
  return validateAssetRelativePath(asset, candidate);
}

export function supportsInstallSurface(surface) {
  return supportedInstallSurfaces.includes(surface);
}

export function describeEnforcementBoundary(manifest = null) {
  return [
    "slash-entrypoint:/skills",
    `direct-invocation-prefix:${renderDirectInvocation(manifest?.pack_name ?? "pack-id").slice(0, 1)}`,
    `install-surfaces:${supportedInstallSurfaces.join(",")}`,
    "metadata-surface:package/pairslash-bundle.json",
  ];
}

export function describePolicyEnforcement() {
  return {
    runtime,
    primary_enforcement: "pairslash-wrapper-plus-hook-assist",
    hook_support: "advisory",
    supported_surfaces: [
      "agent",
      "canonical_skill",
      "direct_invocation",
      "hook",
      "mcp",
      "metadata",
      "support_doc",
    ],
    surface_notes: [
      "PairSlash wrapper/runtime adapter remains authoritative for Copilot CLI policy enforcement.",
      "Copilot hooks may assist preflight enforcement, but policy must not rely on hooks alone.",
    ],
  };
}

function spawnRuntime(args) {
  const options = { encoding: "utf8" };
  const direct = spawnSync(executable, args, options);
  if (
    process.platform !== "win32" ||
    !["ENOENT", "EINVAL"].includes(direct.error?.code ?? "")
  ) {
    return direct;
  }
  return spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", executable, ...args], options);
}

function extractSemver(rawValue) {
  const match = typeof rawValue === "string" ? rawValue.match(/(\d+\.\d+\.\d+)/) : null;
  return match?.[1] ?? null;
}

export function detectRuntime() {
  const copilot = spawnRuntime(["copilot", "--help"]);
  const ghVersion = spawnRuntime(["--version"]);
  const versionLine = ghVersion.stdout?.trim().split(/\r?\n/, 1)[0] ?? "";
  const version = extractSemver(versionLine) || versionLine || "unknown";
  if (copilot.status === 0) {
    return {
      available: true,
      executable,
      version,
    };
  }
  return {
    available: false,
    executable,
    version: null,
    error: copilot.error?.message || copilot.stderr?.trim() || "gh copilot not found",
  };
}

export function checkWritablePath(path) {
  try {
    accessSync(path, constants.W_OK);
    return { writable: true };
  } catch (error) {
    return { writable: false, error: error.message };
  }
}
