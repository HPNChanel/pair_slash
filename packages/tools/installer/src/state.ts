import { readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  INSTALL_STATE_SCHEMA_VERSION,
  ensureDir,
  exists,
  normalizeEmitMode,
  normalizeSkillRoot,
  stableJson,
  validateInstallState,
  writeTextFile,
} from "@pairslash/spec-core";

import { normalizeInstallStateRecord } from "./semantics.ts";

export function resolveStatePath({ repoRoot, runtime, target, skillRoot = "runtime-default", emit = "skill" }) {
  const normalizedEmit = normalizeEmitMode(emit);
  // Plugin installs keep a separate state lane: <target>-<runtime>-plugin.json.
  // skill_root is meaningless for plugin layout, so its suffix never applies.
  const suffix =
    normalizedEmit === "plugin"
      ? "-plugin"
      : normalizeSkillRoot(skillRoot) === "runtime-default"
        ? ""
        : `-${normalizeSkillRoot(skillRoot)}`;
  return resolve(repoRoot, ".pairslash", "install-state", `${target}-${runtime}${suffix}.json`);
}

export function buildEmptyState({
  repoRoot,
  runtime,
  target,
  adapter,
  skillRoot = "runtime-default",
  emit = "skill",
}) {
  const normalizedEmit = normalizeEmitMode(emit);
  const normalizedSkillRoot = normalizedEmit === "plugin" ? "runtime-default" : normalizeSkillRoot(skillRoot);
  const installRoot =
    normalizedEmit === "plugin"
      ? target === "repo"
        ? adapter.resolvePluginRoot({ repoRoot, target })
        : null
      : adapter.resolveInstallRoot({ repoRoot, target, skillRoot: normalizedSkillRoot });
  return {
    kind: "install-state",
    schema_version: INSTALL_STATE_SCHEMA_VERSION,
    runtime,
    target,
    skill_root: normalizedSkillRoot,
    emit: normalizedEmit,
    config_home: adapter.resolveConfigHome({ repoRoot, target, skillRoot: normalizedSkillRoot }),
    install_root: installRoot,
    updated_at: null,
    last_transaction_id: null,
    packs: [],
  };
}

export function loadInstallState({
  repoRoot,
  runtime,
  target,
  adapter,
  skillRoot = "runtime-default",
  emit = "skill",
}) {
  const statePath = resolveStatePath({ repoRoot, runtime, target, skillRoot, emit });
  if (!exists(statePath)) {
    return {
      statePath,
      state: buildEmptyState({ repoRoot, runtime, target, adapter, skillRoot, emit }),
    };
  }
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const errors = validateInstallState(state);
  if (errors.length > 0) {
    throw new Error(`invalid install state ${statePath} :: ${errors.join("; ")}`);
  }
  return { statePath, state: normalizeInstallStateRecord(state) };
}

export function writeInstallState(statePath, state) {
  ensureDir(dirname(statePath));
  writeTextFile(statePath, stableJson(state));
}

export function removeInstallState(statePath) {
  if (exists(statePath)) {
    rmSync(statePath, { force: true });
  }
}

export function findStatePack(state, packId) {
  return state.packs.find((pack) => pack.id === packId) ?? null;
}
