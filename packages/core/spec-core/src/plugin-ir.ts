import { sha256, stableJson } from "./utils.ts";

export const PLUGIN_FORMAT_VERSION = "1.0.0";
export const COPILOT_PLUGIN_MANIFEST_NAME = "plugin.json";
export const CODEX_PLUGIN_MANIFEST_RELPATH = ".codex-plugin/plugin.json";
export const PLUGIN_PROVENANCE_FILENAME = "pairslash-plugin.json";
export const PLUGIN_SKILLS_DIR = "skills";

// Author metadata is intentionally omitted from plugin.json: pack manifests do
// not carry author identity, and emitting a fabricated value would violate the
// provenance rules in plans/CONSTRAINTS.md (D-section). Bundle provenance lives
// in the pairslash-plugin.json sidecar instead.
export function buildPluginManifest({ manifest, runtime }) {
  const base = {
    name: manifest.pack_name,
    description: String(manifest.summary ?? manifest.display_name ?? "").slice(0, 1024),
    version: manifest.pack_version,
    license: "Apache-2.0",
    keywords: ["pairslash", manifest.category],
    skills: `${PLUGIN_SKILLS_DIR}/`,
  };
  if (runtime === "copilot_cli") {
    return {
      ...base,
      category: manifest.category,
    };
  }
  if (runtime === "codex_cli") {
    return {
      ...base,
      interface: {
        displayName: manifest.display_name ?? manifest.pack_name,
        shortDescription: String(manifest.summary ?? "").slice(0, 256),
        developerName: "PairSlash",
        category: manifest.category,
      },
    };
  }
  throw new Error(`unsupported runtime for plugin manifest: ${runtime}`);
}

export function buildPluginProvenance({ manifest, runtime, manifestDigest }) {
  return {
    kind: "pairslash-plugin-provenance",
    format_version: PLUGIN_FORMAT_VERSION,
    pack_id: manifest.pack_name,
    pack_version: manifest.pack_version,
    runtime,
    manifest_digest: manifestDigest,
    distribution_mode: "plugin",
    invocation_surface: "/skills",
  };
}

export function manifestDigestForPlugin(manifest) {
  return sha256(stableJson(manifest));
}
