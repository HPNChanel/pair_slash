import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPluginManifest,
  buildPluginProvenance,
  manifestDigestForPlugin,
  PLUGIN_FORMAT_VERSION,
} from "../src/index.ts";

const manifest = {
  pack_name: "pairslash-plan",
  display_name: "PairSlash Plan",
  pack_version: "0.4.0",
  summary: "Create a structured execution plan before code changes.",
  category: "planning",
};

test("buildPluginManifest emits the Copilot plugin.json shape", () => {
  const plugin = buildPluginManifest({ manifest, runtime: "copilot_cli" });
  assert.equal(plugin.name, "pairslash-plan");
  assert.equal(plugin.version, "0.4.0");
  assert.equal(plugin.license, "Apache-2.0");
  assert.equal(plugin.skills, "skills/");
  assert.equal(plugin.category, "planning");
  assert.deepEqual(plugin.keywords, ["pairslash", "planning"]);
  assert.ok(!("agents" in plugin));
  assert.ok(!("author" in plugin));
  assert.ok(!("mcpServers" in plugin));
  assert.ok(!("hooks" in plugin));
});

test("buildPluginManifest emits the Codex .codex-plugin shape with interface block", () => {
  const plugin = buildPluginManifest({ manifest, runtime: "codex_cli" });
  assert.equal(plugin.name, "pairslash-plan");
  assert.equal(plugin.interface.displayName, "PairSlash Plan");
  assert.equal(plugin.interface.developerName, "PairSlash");
  assert.equal(plugin.interface.category, "planning");
  assert.ok(!("agents" in plugin));
});

test("buildPluginManifest truncates description to the 1024-char cap", () => {
  const long = { ...manifest, summary: "x".repeat(2000), display_name: undefined };
  const plugin = buildPluginManifest({ manifest: long, runtime: "copilot_cli" });
  assert.equal(plugin.description.length, 1024);
});

test("buildPluginManifest fails closed on unknown runtimes", () => {
  assert.throws(() => buildPluginManifest({ manifest, runtime: "claude" }), /unsupported runtime/);
});

test("buildPluginProvenance is deterministic and carries pack identity", () => {
  const digest = manifestDigestForPlugin(manifest);
  const first = buildPluginProvenance({ manifest, runtime: "codex_cli", manifestDigest: digest });
  const second = buildPluginProvenance({ manifest, runtime: "codex_cli", manifestDigest: digest });
  assert.deepEqual(first, second);
  assert.equal(first.format_version, PLUGIN_FORMAT_VERSION);
  assert.equal(first.pack_id, "pairslash-plan");
  assert.equal(first.invocation_surface, "/skills");
  assert.equal(first.distribution_mode, "plugin");
  assert.ok(!("emitted_at" in first));
});
