import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { cleanBuildCaches, planCacheClean } from "../scripts/clean-build-cache.mjs";

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), "pairslash-cleantest-"));
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("cache clean dry-run reports targets without deleting", () => {
  const { root, cleanup } = makeRepo();
  try {
    mkdirSync(join(root, ".pairslash", "tmp", "scratch"), { recursive: true });
    writeFileSync(join(root, ".pairslash", "tmp", "scratch", "a.txt"), "x");
    mkdirSync(join(root, "packages", "p", "dist"), { recursive: true });
    writeFileSync(join(root, "packages", "p", "dist", "out.js"), "x");
    writeFileSync(join(root, "packages", "p", "x.tsbuildinfo"), "{}");

    const report = cleanBuildCaches(root, { apply: false });
    assert.equal(report.apply, false);
    assert.ok(report.targets.length >= 3);
    assert.ok(report.freed_bytes > 0);
    // Nothing deleted on dry-run.
    assert.ok(existsSync(join(root, ".pairslash", "tmp")));
    assert.ok(existsSync(join(root, "packages", "p", "dist")));
    assert.ok(existsSync(join(root, "packages", "p", "x.tsbuildinfo")));
  } finally {
    cleanup();
  }
});

test("cache clean apply removes PairSlash caches and keeps authoritative dirs", () => {
  const { root, cleanup } = makeRepo();
  try {
    mkdirSync(join(root, ".pairslash", "tmp"), { recursive: true });
    mkdirSync(join(root, ".pairslash", "staging", "sync-truth"), { recursive: true });
    mkdirSync(join(root, ".pairslash", "audit-log"), { recursive: true });
    writeFileSync(join(root, ".pairslash", "audit-log", "keep.yaml"), "k: v\n");
    mkdirSync(join(root, "packages", "p", ".cache"), { recursive: true });
    writeFileSync(join(root, "packages", "p", ".cache", "blob"), "x");

    const report = cleanBuildCaches(root, { apply: true });
    assert.equal(report.errors.length, 0);
    assert.ok(!existsSync(join(root, ".pairslash", "tmp")));
    assert.ok(!existsSync(join(root, "packages", "p", ".cache")));
    // Authoritative/staging memory is never a cache target.
    assert.ok(existsSync(join(root, ".pairslash", "staging", "sync-truth")));
    assert.ok(existsSync(join(root, ".pairslash", "audit-log", "keep.yaml")));
  } finally {
    cleanup();
  }
});

test("cache clean sweeps stale pairslash temp dirs but skips fresh ones", () => {
  const { root, cleanup } = makeRepo();
  const stale = mkdtempSync(join(tmpdir(), "pairslash-stale-"));
  const fresh = mkdtempSync(join(tmpdir(), "pairslash-fresh-"));
  const foreign = mkdtempSync(join(tmpdir(), "unrelated-proj-"));
  try {
    const plan = planCacheClean(root, { now: Date.now() });
    // Fresh dirs are not targets (protected against concurrent-run sweeps).
    assert.ok(!plan.some((target) => target.path === fresh));
    assert.ok(!plan.some((target) => target.path === stale));
    // Foreign prefixes are never targets.
    assert.ok(!plan.some((target) => target.path === foreign));

    // Once the entry is older than the stale threshold it becomes a target.
    const agedPlan = planCacheClean(root, { now: Date.now() + 10 * 60 * 60 * 1000 });
    assert.ok(agedPlan.some((target) => target.path === stale));
    assert.ok(!agedPlan.some((target) => target.path === foreign));
  } finally {
    cleanup();
    rmSync(stale, { recursive: true, force: true });
    rmSync(fresh, { recursive: true, force: true });
    rmSync(foreign, { recursive: true, force: true });
  }
});

test("cache clean on an empty repo is a no-op", () => {
  const { root, cleanup } = makeRepo();
  try {
    const report = cleanBuildCaches(root, { apply: true });
    assert.equal(report.targets.length, 0);
    assert.equal(report.freed_bytes, 0);
    assert.equal(report.errors.length, 0);
  } finally {
    cleanup();
  }
});
