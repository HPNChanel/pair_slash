import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DEFAULT_PREFLIGHT_EVENTS,
  isPairslashHookEvent,
  listAdvisoryHookBindings,
  listNativeHookBindings,
  normalizeHookEvents,
  PAIRSLASH_HOOK_EVENTS,
  renderPluginHooksConfig,
  renderPreflightScript,
  resolvePreflightHooks,
} from "../src/index.ts";

const writeAuthorityManifest = {
  pack_name: "pairslash-memory-write-global",
  workflow_class: "write-authority",
};

const readOrientedManifest = {
  pack_name: "pairslash-plan",
  workflow_class: "read-oriented",
};

function buildIr({ manifest, events }) {
  const preflight = resolvePreflightHooks(
    events ? { ...manifest, hooks: { preflight: { events } } } : manifest,
  );
  return {
    pack: {
      id: manifest.pack_name,
      workflow_class: manifest.workflow_class,
    },
    policy: {
      memory_permissions: { global_project_memory: "write" },
    },
    hooks: { preflight },
  };
}

test("resolvePreflightHooks defaults emit=true for write-authority packs", () => {
  const resolved = resolvePreflightHooks(writeAuthorityManifest);
  assert.equal(resolved.emit, true);
  assert.equal(resolved.declared, false);
  assert.deepEqual(resolved.events, [...DEFAULT_PREFLIGHT_EVENTS]);
});

test("resolvePreflightHooks defaults emit=false for other workflow classes", () => {
  for (const workflow_class of ["read-oriented", "dual-mode"]) {
    const resolved = resolvePreflightHooks({ pack_name: "p", workflow_class });
    assert.equal(resolved.emit, false, workflow_class);
  }
});

test("manifest declaration overrides emit and events", () => {
  const resolved = resolvePreflightHooks({
    ...readOrientedManifest,
    hooks: { preflight: { emit: true, events: ["prompt-submit"] } },
  });
  assert.equal(resolved.emit, true);
  assert.equal(resolved.declared, true);
  assert.deepEqual(resolved.events, ["prompt-submit"]);

  const disabled = resolvePreflightHooks({
    ...writeAuthorityManifest,
    hooks: { preflight: { emit: false } },
  });
  assert.equal(disabled.emit, false);
});

test("normalizeHookEvents filters unknown canonical events and falls back to defaults", () => {
  assert.deepEqual(normalizeHookEvents(["bogus", "turn-stop"]), ["turn-stop"]);
  assert.deepEqual(normalizeHookEvents([]), [...DEFAULT_PREFLIGHT_EVENTS]);
  assert.deepEqual(normalizeHookEvents(undefined), [...DEFAULT_PREFLIGHT_EVENTS]);
  assert.ok(PAIRSLASH_HOOK_EVENTS.every((event) => isPairslashHookEvent(event)));
});

test("codex maps every canonical event but drops non-advisory ones at emission", () => {
  const all = listNativeHookBindings({ runtime: "codex_cli", events: PAIRSLASH_HOOK_EVENTS });
  assert.equal(all.length, PAIRSLASH_HOOK_EVENTS.length);
  const advisory = listAdvisoryHookBindings({ runtime: "codex_cli", events: PAIRSLASH_HOOK_EVENTS });
  assert.ok(!advisory.some((binding) => binding.canonical === "session-end"));
  assert.ok(advisory.some((binding) => binding.native === "Stop"));
});

test("copilot skips events without an advisory channel instead of emitting dead hooks", () => {
  const advisory = listAdvisoryHookBindings({ runtime: "copilot_cli", events: PAIRSLASH_HOOK_EVENTS });
  const canonical = advisory.map((binding) => binding.canonical).sort();
  assert.deepEqual(canonical, ["post-tool-use", "prompt-submit", "session-start"]);
  assert.ok(!advisory.some((binding) => binding.canonical === "turn-stop"));
});

test("renderPluginHooksConfig emits codex hooks.json wiring for default events", () => {
  const ir = buildIr({ manifest: writeAuthorityManifest });
  const config = JSON.parse(renderPluginHooksConfig({ ir, runtime: "codex_cli" }));
  assert.ok(typeof config.description === "string");
  assert.ok(config.description.includes("advisory") || config.description.includes("Advisory"));
  assert.deepEqual(Object.keys(config.hooks).sort(), ["SessionStart", "Stop"]);
  const stopEntry = config.hooks.Stop[0].hooks[0];
  assert.equal(stopEntry.type, "command");
  assert.ok(stopEntry.command.includes("turn-stop"));
  assert.ok(stopEntry.commandWindows.includes("turn-stop"));
  assert.ok(stopEntry.command.includes("$PLUGIN_ROOT"));
});

test("renderPluginHooksConfig emits copilot legacy hooks.json with bash+powershell commands", () => {
  const ir = buildIr({ manifest: writeAuthorityManifest });
  const config = JSON.parse(renderPluginHooksConfig({ ir, runtime: "copilot_cli" }));
  assert.equal(config.version, 1);
  // turn-stop has no advisory channel on Copilot — only sessionStart is wired.
  assert.deepEqual(Object.keys(config.hooks), ["sessionStart"]);
  const entry = config.hooks.sessionStart[0];
  assert.equal(entry.type, "command");
  assert.ok(entry.bash.includes("$PLUGIN_ROOT"));
  assert.ok(entry.powershell.includes("$env:PLUGIN_ROOT"));
});

test("renderPluginHooksConfig returns null when no advisory events remain", () => {
  const ir = buildIr({ manifest: writeAuthorityManifest, events: ["turn-stop"] });
  assert.equal(renderPluginHooksConfig({ ir, runtime: "copilot_cli" }), null);
  assert.notEqual(renderPluginHooksConfig({ ir, runtime: "codex_cli" }), null);
});

test("emitted preflight script prints advisory JSON per canonical event", () => {
  const ir = buildIr({ manifest: writeAuthorityManifest });
  const dir = mkdtempSync(join(tmpdir(), "pairslash-hooks-"));
  const scriptPath = join(dir, "pairslash-preflight.mjs");
  writeFileSync(scriptPath, renderPreflightScript({ ir, runtime: "codex_cli" }));

  const stopOut = execFileSync(process.execPath, [scriptPath, "turn-stop"], { encoding: "utf8" });
  const parsed = JSON.parse(stopOut);
  assert.equal(typeof parsed.systemMessage, "string");
  assert.ok(parsed.systemMessage.includes("pairslash-memory-write-global"));

  const sessionOut = execFileSync(process.execPath, [scriptPath, "session-start"], { encoding: "utf8" });
  assert.equal(parsed.hookEventName, undefined);
  assert.equal(JSON.parse(sessionOut).hookSpecificOutput.hookEventName, "SessionStart");

  const unknownOut = execFileSync(process.execPath, [scriptPath, "bogus"], { encoding: "utf8" });
  assert.deepEqual(JSON.parse(unknownOut), {});
});

test("copilot script emits flat additionalContext output", () => {
  const ir = buildIr({ manifest: writeAuthorityManifest });
  const dir = mkdtempSync(join(tmpdir(), "pairslash-hooks-"));
  const scriptPath = join(dir, "pairslash-preflight.mjs");
  writeFileSync(scriptPath, renderPreflightScript({ ir, runtime: "copilot_cli" }));
  const parsed = JSON.parse(
    execFileSync(process.execPath, [scriptPath, "session-start"], { encoding: "utf8" }),
  );
  assert.equal(typeof parsed.additionalContext, "string");
});

// --- manifest declaration + validation path ---

import YAML from "yaml";
import { readFileSync } from "node:fs";
import {
  normalizePackManifestV2,
  validatePackManifestV2,
} from "../src/index.ts";

function loadRuntimeTargetedFixture() {
  return YAML.parse(
    readFileSync(
      join("packages", "core", "spec-core", "tests", "fixtures", "pack.manifest.v2.runtime-targeted.sample.yaml"),
      "utf8",
    ),
  );
}

test("declared hooks.preflight validates and normalizes through", () => {
  const manifest = loadRuntimeTargetedFixture();
  manifest.hooks = { preflight: { emit: true, events: ["turn-stop", "session-end"] } };
  assert.deepEqual(validatePackManifestV2(manifest), []);
  const normalized = normalizePackManifestV2(manifest);
  assert.deepEqual(normalized.hooks.preflight, { emit: true, events: ["turn-stop", "session-end"] });
});

test("unknown hook event names fail closed at manifest validation", () => {
  const manifest = loadRuntimeTargetedFixture();
  manifest.hooks = { preflight: { emit: true, events: ["rm-rf"] } };
  const errors = validatePackManifestV2(manifest);
  assert.ok(errors.length > 0);
  assert.ok(errors.some((error) => error.includes("hooks")));
});

test("non-boolean hooks.preflight.emit fails closed", () => {
  const manifest = loadRuntimeTargetedFixture();
  manifest.hooks = { preflight: { emit: "yes" } };
  assert.ok(validatePackManifestV2(manifest).length > 0);
});
