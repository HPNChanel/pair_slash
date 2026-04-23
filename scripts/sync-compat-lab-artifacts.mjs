import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import YAML from "yaml";

import {
  buildCompatFixtureSnapshot,
  buildCompatGolden,
  listCompatGoldens,
  renderCompatibilityMatrixMarkdown,
  renderRuntimeSurfaceMatrixYaml,
} from "@pairslash/compat-lab";
import {
  renderPackCatalogIndexYaml,
  stableJson,
  writeTextFile,
} from "@pairslash/spec-core";

const SNAPSHOT_FIXTURES = [
  "repo-monorepo-workspaces",
  "repo-conflict-existing-runtime",
];

function parseArgs(argv) {
  const options = {
    check: argv.includes("--check"),
    refreshLastUpdated: argv.includes("--refresh-last-updated"),
  };
  if (options.check && options.refreshLastUpdated) {
    throw new Error("--refresh-last-updated cannot be used with --check");
  }
  return options;
}

function currentVersion(repoRoot) {
  const pkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
  return pkg.version;
}

function loadCommittedPackCatalogLastUpdated(repoRoot) {
  const registryPath = resolve(repoRoot, "packages", "core", "spec-core", "registry", "packs.yaml");
  const parsed = YAML.parse(readFileSync(registryPath, "utf8"));
  const stamp = parsed?.last_updated;
  if (typeof stamp !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(stamp)) {
    throw new Error(`invalid last_updated value in ${registryPath}`);
  }
  return stamp;
}

function resolvePackCatalogLastUpdated(repoRoot, options) {
  if (options.refreshLastUpdated) {
    return new Date().toISOString().slice(0, 10);
  }
  return loadCommittedPackCatalogLastUpdated(repoRoot);
}

function generatedArtifacts(repoRoot, options) {
  const version = currentVersion(repoRoot);
  const packCatalogLastUpdated = resolvePackCatalogLastUpdated(repoRoot, options);
  const artifacts = [];

  for (const fixtureId of SNAPSHOT_FIXTURES) {
    artifacts.push({
      path: resolve(repoRoot, "packages", "tools", "compat-lab", "goldens", `fixture-snapshot.${fixtureId}.json`),
      content: stableJson(
        buildCompatFixtureSnapshot({
          repoRoot,
          fixtureId,
        }),
      ),
    });
  }

  for (const golden of listCompatGoldens()) {
    artifacts.push({
      path: resolve(repoRoot, "packages", "tools", "compat-lab", "goldens", `${golden.id}.json`),
      content: stableJson(
        buildCompatGolden({
          repoRoot,
          goldenId: golden.id,
        }),
      ),
    });
  }

  artifacts.push({
    path: resolve(repoRoot, "docs", "compatibility", "compatibility-matrix.md"),
    content: renderCompatibilityMatrixMarkdown({ repoRoot, version }),
  });
  artifacts.push({
    path: resolve(repoRoot, "docs", "compatibility", "runtime-surface-matrix.yaml"),
    content: renderRuntimeSurfaceMatrixYaml({ repoRoot, version }),
  });
  artifacts.push({
    path: resolve(repoRoot, "packages", "core", "spec-core", "registry", "packs.yaml"),
    content: renderPackCatalogIndexYaml(repoRoot, {
      version,
      lastUpdated: packCatalogLastUpdated,
    }),
  });

  return artifacts;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const artifacts = generatedArtifacts(repoRoot, options);

  if (options.check) {
    let mismatched = false;
    for (const artifact of artifacts) {
      const current = readFileSync(artifact.path, "utf8");
      if (current !== artifact.content) {
        console.error(`out-of-date compat artifact: ${artifact.path}`);
        mismatched = true;
      }
    }
    process.exit(mismatched ? 1 : 0);
  }

  for (const artifact of artifacts) {
    writeTextFile(artifact.path, artifact.content);
    console.log(`wrote ${artifact.path}`);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
