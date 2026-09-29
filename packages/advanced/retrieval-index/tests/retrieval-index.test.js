import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DEFAULT_INDEX_DIR,
  RETRIEVAL_INDEX_FILENAME,
  buildRetrievalIndex,
  assessIndexStaleness,
  loadRetrievalIndex,
  resolveIndexDir,
  serializeRetrievalIndex,
  writeRetrievalIndex,
} from "../src/index.ts";

function withTempDir(run) {
  const root = mkdtempSync(join(tmpdir(), "pairslash-retrieval-index-"));
  try {
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function seededMemoryRepo(root) {
  const memDir = join(root, ".pairslash", "project-memory");
  const taskDir = join(root, ".pairslash", "task-memory");
  mkdirSync(memDir, { recursive: true });
  mkdirSync(taskDir, { recursive: true });
  writeFileSync(
    join(memDir, "10-stack-profile.yaml"),
    "kind: stack-profile\ntitle: Stack Profile\nscope: whole-project\ntags:\n  - stack\n",
  );
  writeFileSync(
    join(taskDir, "note.md"),
    "task-level scratch note",
  );
}

test("index output is byte-identical across runs", () => {
  withTempDir((root) => {
    seededMemoryRepo(root);
    const first = serializeRetrievalIndex(buildRetrievalIndex({ repoRoot: root }));
    const second = serializeRetrievalIndex(buildRetrievalIndex({ repoRoot: root }));
    assert.equal(first, second);
    assert.equal(createHash("sha256").update(first).digest("hex"),
      createHash("sha256").update(second).digest("hex"));
  });
});

test("index carries deterministic ordering and record metadata", () => {
  withTempDir((root) => {
    seededMemoryRepo(root);
    const index = buildRetrievalIndex({ repoRoot: root });
    assert.equal(index.kind, "pairslash.retrieval-index/v1");
    const ids = index.sources.map((source) => source.id);
    assert.deepEqual(ids, [...ids].sort());
    const mem = index.sources.find((source) => source.id === "project-memory");
    assert.equal(mem.files[0].record.kind, "stack-profile");
    assert.equal(mem.files[0].record.scope, "whole-project");
    assert.equal(mem.files[0].sha256.length, 64);
  });
});

test("index writes only inside its own index dir via atomic rename", () => {
  withTempDir((root) => {
    seededMemoryRepo(root);
    const before = collectFiles(root);
    const result = writeRetrievalIndex({ repoRoot: root });
    const after = collectFiles(root);
    const created = after.filter((path) => !before.includes(path));
    assert.equal(created.length, 1);
    assert.equal(created[0], result.index_path);
    assert.ok(created[0].startsWith(".pairslash/observability/indexes/retrieval/"));
    assert.equal(created[0].endsWith(".tmp"), false);
    const loaded = loadRetrievalIndex({ repoRoot: root });
    assert.notEqual(loaded, null);
    assert.equal(loaded.totals.file_count, 2);
  });
});

test("staleness assessment reports fresh, stale, missing, and unexpected", () => {
  withTempDir((root) => {
    seededMemoryRepo(root);
    assert.equal(assessIndexStaleness({ repoRoot: root }).state, "missing");
    writeRetrievalIndex({ repoRoot: root });
    const fresh = assessIndexStaleness({ repoRoot: root });
    assert.equal(fresh.state, "fresh");
    writeFileSync(
      join(root, ".pairslash", "project-memory", "10-stack-profile.yaml"),
      "kind: stack-profile\ntitle: Updated\n",
    );
    const stale = assessIndexStaleness({ repoRoot: root });
    assert.equal(stale.state, "stale");
    assert.ok(stale.stale_files.length > 0);
    writeFileSync(join(root, ".pairslash", "task-memory", "extra.md"), "new");
    const unexpected = assessIndexStaleness({ repoRoot: root });
    assert.equal(unexpected.state, "stale");
    assert.ok(unexpected.unexpected_files.length > 0);
  });
});

test("index dir escapes outside repo root are refused fail-closed", () => {
  withTempDir((root) => {
    seededMemoryRepo(root);
    assert.throws(() => resolveIndexDir(root, join(root, "..", "outside")));
    assert.throws(() => writeRetrievalIndex({ repoRoot: root, indexDir: "../escape" }));
    assert.equal(existsSync(join(root, "..", "escape")), false);
  });
});

test("default index dir avoids the trace session indexes namespace", () => {
  const segments = DEFAULT_INDEX_DIR.split(/[\\/]/);
  assert.deepEqual(segments, [".pairslash", "observability", "indexes", "retrieval"]);
  assert.equal(RETRIEVAL_INDEX_FILENAME, "retrieval-index.json");
});

function collectFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        out.push(full.slice(root.length + 1).replaceAll("\\", "/"));
      }
    }
  };
  walk(root);
  return out.sort();
}
