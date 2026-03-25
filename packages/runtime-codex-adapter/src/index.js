import { accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { basename, join, posix } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

export const runtime = "codex_cli";
export const shortName = "codex";
export const bundleKind = "codex-skill-bundle";
export const canonicalEntrypoint = "/skills";
export const executable = "codex";
export const supportedInstallSurfaces = [
  "canonical_skill",
  "support_doc",
  "metadata",
  "context",
  "config",
  "mcp",
];

export function renderDirectInvocation(packId) {
  return `$${packId}`;
}

export function resolveConfigHome({ repoRoot, target }) {
  return target === "repo" ? join(repoRoot, ".agents") : join(homedir(), ".agents");
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
      return posix.join("agents", asset.file_name);
    case "context":
      return posix.join("fragments", "context", asset.file_name);
    case "config":
      return posix.join("fragments", "config", asset.file_name);
    case "mcp":
      return posix.join("fragments", "mcp", asset.file_name);
    default:
      throw new Error(`codex runtime does not support install surface ${asset.install_surface}`);
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
      `codex runtime path ${normalizedPath} does not match install surface ${asset.install_surface} -> ${expectedPath}`,
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
    throw new Error("codex runtime asset is missing a relative path");
  }
  return validateAssetRelativePath(asset, candidate);
}

export function supportsInstallSurface(surface) {
  return supportedInstallSurfaces.includes(surface);
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
  const result = spawnRuntime(["--version"]);
  const rawVersion = result.stdout?.trim() || result.stderr?.trim() || "";
  const version = extractSemver(rawVersion) || rawVersion || "unknown";
  if (result.status === 0) {
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
    error: result.error?.message || result.stderr?.trim() || "codex not found",
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
