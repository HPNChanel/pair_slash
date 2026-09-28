import { readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  INSTALL_STATE_SCHEMA_VERSION,
  ensureDir,
  exists,
  normalizeSkillRoot,
  stableJson,
  validateInstallState,
  writeTextFile,
} from "@pairslash/spec-core";

import { normalizeInstallStateRecord } from "./semantics.ts";

export function resolveStatePath({ repoRoot, runtime, target, skillRoot = "runtime-default" }) {
  const normalizedSkillRoot = normalizeSkillRoot(skillRoot);
  const suffix = normalizedSkillRoot === "runtime-default" ? "" : `-${normalizedSkillRoot}`;
  return resolve(repoRoot, ".pairslash", "install-state", `${target}-${runtime}${suffix}.json`);
}

export function buildEmptyState({ repoRoot, runtime, target, adapter, skillRoot = "runtime-default" }) {
  const normalizedSkillRoot = normalizeSkillRoot(skillRoot);
  return {
    kind: "install-state",
    schema_version: INSTALL_STATE_SCHEMA_VERSION,
    runtime,
    target,
    skill_root: normalizedSkillRoot,
    config_home: adapter.resolveConfigHome({ repoRoot, target, skillRoot: normalizedSkillRoot }),
    install_root: adapter.resolveInstallRoot({ repoRoot, target, skillRoot: normalizedSkillRoot }),
    updated_at: null,
    last_transaction_id: null,
    packs: [],
  };
}

export function loadInstallState({ repoRoot, runtime, target, adapter, skillRoot = "runtime-default" }) {
  const statePath = resolveStatePath({ repoRoot, runtime, target, skillRoot });
  if (!exists(statePath)) {
    return {
      statePath,
      state: buildEmptyState({ repoRoot, runtime, target, adapter, skillRoot }),
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
