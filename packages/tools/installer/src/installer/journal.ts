import {
  INSTALL_JOURNAL_DIR,
  INSTALL_JOURNAL_SCHEMA_VERSION,
  exists,
  normalizeSkillRoot,
  sha256,
  stableJson,
  validateInstallJournal,
  writeTextFile,
} from "@pairslash/spec-core";
import {
  readFileSync,
  rmSync,
} from "node:fs";
import {
  dirname,
  resolve,
} from "node:path";
import {
  cleanupEmptyDirectories,
} from "./helpers.ts";

export function resolveJournalPath({ repoRoot, runtime, target, skillRoot, emit = "skill" }) {
  const stamp = new Date().toISOString().replace(/[-:.]/g, "").replace("T", "T");
  const suffix = Math.random().toString(16).slice(2, 8);
  const rootSuffix =
    emit === "plugin"
      ? "-plugin"
      : normalizeSkillRoot(skillRoot) === "runtime-default"
        ? ""
        : `-${skillRoot}`;
  return resolve(
    repoRoot,
    ".pairslash",
    INSTALL_JOURNAL_DIR,
    `${target}-${runtime}${rootSuffix}-${stamp}-${suffix}.json`,
  );
}

export function buildMutationJournal(envelope, journalPath, action) {
  const steps = [];
  for (const operation of envelope.plan.operations) {
    if (operation.kind === "create") {
      steps.push({
        kind: "create",
        path: operation.absolute_path,
        created_by_transaction: true,
      });
      continue;
    }
    if (operation.kind === "remove") {
      const step: any = {
        kind: "remove",
        path: operation.absolute_path,
        created_by_transaction: false,
      };
      if (exists(operation.absolute_path)) {
        step.backup_content = readFileSync(operation.absolute_path, "utf8");
      }
      steps.push(step);
      continue;
    }
    if (operation.kind === "replace") {
      steps.push({
        kind: "replace",
        path: operation.absolute_path,
        created_by_transaction: false,
        backup_content: readFileSync(operation.absolute_path, "utf8"),
      });
    }
  }

  const stateStep: any = {
    kind: "write_state",
    path: envelope.statePath,
    created_by_transaction: !exists(envelope.statePath),
  };
  if (exists(envelope.statePath)) {
    try {
      stateStep.backup_content = readFileSync(envelope.statePath, "utf8");
    } catch {
      // Leave backup_content empty for pre-existing non-file paths.
    }
  }
  steps.push({
    ...stateStep,
  });

  const journal: any = {
    kind: "install-journal",
    schema_version: INSTALL_JOURNAL_SCHEMA_VERSION,
    action,
    runtime: envelope.runtime,
    target: envelope.target,
    transaction_id: sha256(`${journalPath}\n${envelope.runtime}\n${envelope.target}`).slice(0, 16),
    journal_path: journalPath,
    state_path: envelope.statePath,
    install_root: envelope.plan.install_root,
    status: "pending",
    started_at: new Date().toISOString(),
    steps,
  };

  const errors = validateInstallJournal(journal);
  if (errors.length > 0) {
    throw new Error(`invalid ${action} journal :: ${errors.join("; ")}`);
  }
  writeTextFile(journalPath, stableJson(journal));
  return journal;
}

export function writeJournal(journal) {
  writeTextFile(journal.journal_path, stableJson(journal));
}

export function rollbackInstallJournal(journal, envelope) {
  const reversed = journal.steps.slice().reverse();
  for (const step of reversed) {
    if (step.kind === "create") {
      rmSync(step.path, { force: true });
      cleanupEmptyDirectories(dirname(step.path), envelope.plan.install_root);
      continue;
    }
    if (step.kind === "replace") {
      if (typeof step.backup_content === "string") {
        writeTextFile(step.path, step.backup_content);
      }
      continue;
    }
    if (step.kind === "remove") {
      if (typeof step.backup_content === "string") {
        writeTextFile(step.path, step.backup_content);
      }
      continue;
    }
    if (step.kind === "write_state") {
      if (step.backup_content != null) {
        writeTextFile(step.path, step.backup_content);
      } else if (step.created_by_transaction) {
        rmSync(step.path, { force: true });
      }
    }
  }
}
