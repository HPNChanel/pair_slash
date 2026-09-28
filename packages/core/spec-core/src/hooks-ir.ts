import { DEFAULT_PREFLIGHT_EVENTS, PAIRSLASH_HOOK_EVENTS } from "./constants.ts";
import { stableJson } from "./utils.ts";

// PairSlash hook events are canonical names; each runtime adapter maps them to
// native event names and an advisory output channel. A canonical event whose
// binding has `channel: null` has no advisory output on that runtime (the
// native event either ignores hook output or only supports blocking decisions
// PairSlash must not use by default), so it is skipped at emission time —
// never silently downgraded into a dead hook.

const HOOK_EVENT_BINDINGS = {
  codex_cli: {
    "post-tool-use": { native: "PostToolUse", channel: "additionalContext" },
    "pre-compact": { native: "PreCompact", channel: "additionalContext" },
    "pre-tool-use": { native: "PreToolUse", channel: "systemMessage" },
    "prompt-submit": { native: "UserPromptSubmit", channel: "additionalContext" },
    "session-end": { native: "SessionEnd", channel: null },
    "session-start": { native: "SessionStart", channel: "additionalContext" },
    "turn-stop": { native: "Stop", channel: "systemMessage" },
  },
  copilot_cli: {
    "post-tool-use": { native: "postToolUse", channel: "additionalContext" },
    "pre-compact": { native: "preCompact", channel: null },
    "pre-tool-use": { native: "preToolUse", channel: null },
    "prompt-submit": { native: "userPromptSubmitted", channel: "additionalContext" },
    "session-end": { native: "sessionEnd", channel: null },
    "session-start": { native: "sessionStart", channel: "additionalContext" },
    "turn-stop": { native: "agentStop", channel: null },
  },
} as const;

export const PLUGIN_HOOKS_CONFIG_RELPATH = "hooks/hooks.json";
export const PLUGIN_PREFLIGHT_SCRIPT_RELPATH = "scripts/pairslash-preflight.mjs";

export function isPairslashHookEvent(value) {
  return (PAIRSLASH_HOOK_EVENTS as readonly string[]).includes(value);
}

export function normalizeHookEvents(events) {
  if (!Array.isArray(events)) {
    return [...DEFAULT_PREFLIGHT_EVENTS];
  }
  const filtered = events.filter((entry) => isPairslashHookEvent(entry));
  return filtered.length > 0 ? filtered : [...DEFAULT_PREFLIGHT_EVENTS];
}

// Resolution rules (plugin-emission-contract): `emit` defaults to true for
// write-authority packs; a manifest may declare hooks.preflight.emit to
// override. `events` defaults to DEFAULT_PREFLIGHT_EVENTS.
export function resolvePreflightHooks(manifest) {
  const declared = manifest?.hooks?.preflight ?? null;
  const workflowClass = manifest?.workflow_class ?? manifest?.pack?.workflow_class ?? null;
  const emit =
    typeof declared?.emit === "boolean" ? declared.emit : workflowClass === "write-authority";
  const events = normalizeHookEvents(declared?.events);
  return { emit, events, declared: declared != null };
}

export function listNativeHookBindings({ runtime, events }) {
  const bindings = HOOK_EVENT_BINDINGS[runtime] ?? {};
  const requested = new Set(normalizeHookEvents(events));
  return PAIRSLASH_HOOK_EVENTS.filter((event) => requested.has(event)).map((event) => {
    const binding = bindings[event] ?? null;
    return {
      canonical: event,
      native: binding?.native ?? null,
      channel: binding?.channel ?? null,
      advisory: binding?.channel != null,
    };
  });
}

export function listAdvisoryHookBindings({ runtime, events }) {
  return listNativeHookBindings({ runtime, events }).filter((binding) => binding.advisory);
}

function buildReminderText(ir) {
  const memoryAccess = ir.policy?.memory_permissions?.global_project_memory ?? "read";
  return [
    `PairSlash preflight for ${ir.pack.id} (${ir.pack.workflow_class}):`,
    `memory access is ${memoryAccess};`,
    "preview-first applies to environment-changing steps;",
    "run the pack's verify/preview step before finishing a write-authority turn.",
  ].join(" ");
}

function buildScriptOutputs({ runtime, bindings, reminder }) {
  const outputs: Record<string, unknown> = {};
  for (const binding of bindings) {
    if (binding.channel === "additionalContext") {
      outputs[binding.canonical] =
        runtime === "codex_cli"
          ? { hookSpecificOutput: { hookEventName: binding.native, additionalContext: reminder } }
          : { additionalContext: reminder };
    } else if (binding.channel === "systemMessage") {
      outputs[binding.canonical] = { systemMessage: reminder };
    }
  }
  return outputs;
}

// The emitted script is deterministic per (pack, runtime): argv[2] carries the
// canonical PairSlash event name and exactly one JSON object is written to
// stdout. It never blocks, denies, reads stdin payloads for decisions, or
// mutates files — hooks only inject PairSlash advisory context.
export function renderPreflightScript({ ir, runtime }) {
  const bindings = listAdvisoryHookBindings({ runtime, events: ir.hooks?.preflight?.events });
  const reminder = buildReminderText(ir);
  const outputs = buildScriptOutputs({ runtime, bindings, reminder });
  return [
    "#!/usr/bin/env node",
    `// Generated by PairSlash — advisory preflight hook for pack "${ir.pack.id}" (${runtime}).`,
    "// Contract: argv[2] is a PairSlash canonical hook event name; exactly one",
    "// JSON object is written to stdout; this script never blocks, denies,",
    "// decides permissions, or mutates files. Advisory context only.",
    `const OUTPUTS = ${JSON.stringify(outputs, null, 2)};`,
    'process.stdout.write(`${JSON.stringify(OUTPUTS[process.argv[2]] ?? {})}\\n`);',
    "",
  ].join("\n");
}

function pluginScriptCommand(runtime, event) {
  if (runtime === "codex_cli") {
    return {
      command: `node "$PLUGIN_ROOT/${PLUGIN_PREFLIGHT_SCRIPT_RELPATH}" ${event}`,
      commandWindows: `node "%PLUGIN_ROOT%\\scripts\\pairslash-preflight.mjs" ${event}`,
    };
  }
  return {
    bash: `node "$PLUGIN_ROOT/${PLUGIN_PREFLIGHT_SCRIPT_RELPATH}" ${event}`,
    powershell: `node "$env:PLUGIN_ROOT\\scripts\\pairslash-preflight.mjs" ${event}`,
  };
}

// Native hook wiring for `--emit plugin` bundles. Codex consumes
// hooks/hooks.json via plugin-directory convention; Copilot consumes the same
// path through the plugin.json "hooks" pointer (legacy manifest format).
// Returns null when the pack has no advisory-capable events on this runtime —
// an empty hook config is emitted nowhere, never as a dead stub.
export function renderPluginHooksConfig({ ir, runtime }) {
  const bindings = listAdvisoryHookBindings({ runtime, events: ir.hooks?.preflight?.events });
  if (bindings.length === 0) {
    return null;
  }
  const hooks = {};
  for (const binding of bindings) {
    const command = pluginScriptCommand(runtime, binding.canonical);
    hooks[binding.native] =
      runtime === "codex_cli"
        ? [
            {
              matcher: "",
              hooks: [{ type: "command", timeout: 10, ...command }],
            },
          ]
        : [{ type: "command", timeout: 10, ...command }];
  }
  const config =
    runtime === "codex_cli"
      ? {
          description:
            `PairSlash advisory hooks for ${ir.pack.id}. Advisory only: ` +
            "never blocks, denies, or mutates. Review hook wiring before trusting this plugin.",
          hooks,
        }
      : { version: 1, hooks };
  return stableJson(config);
}

// Skill-mode advisory surface: a YAML declaration listing canonical events,
// native bindings, skipped events, and wiring instructions. Runtimes do not
// auto-load it — `--emit plugin` produces the wired artifacts.
export function buildPreflightAdvisory({ ir, runtime }) {
  const preflight = ir.hooks?.preflight ?? { emit: false, events: [], declared: false };
  const bindings = listNativeHookBindings({ runtime, events: preflight.events });
  return {
    enabled: preflight.emit === true,
    declared_in_manifest: preflight.declared === true,
    canonical_events: preflight.events,
    native_events: bindings.filter((binding) => binding.advisory),
    skipped_events: bindings
      .filter((binding) => !binding.advisory)
      .map((binding) => ({
        canonical: binding.canonical,
        native: binding.native,
        reason: "no advisory output channel on this runtime",
      })),
    wiring: "plugin",
    note:
      "Advisory only: PairSlash hooks inject context and reminders; they never " +
      "block, deny, or mutate state. Skill-mode installs emit this declaration " +
      "for review; `pairslash install --emit plugin` emits the wired hooks config.",
  };
}
