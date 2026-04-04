import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

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
  return {
    check: argv.includes("--check"),
  };
}

function currentVersion(repoRoot) {
  const pkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
  return pkg.version;
}

function generatedArtifacts(repoRoot) {
  const version = currentVersion(repoRoot);
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
    content: renderPackCatalogIndexYaml(repoRoot, { version }),
  });

  return artifacts;
}

const options = parseArgs(process.argv.slice(2));
const repoRoot = process.cwd();
const artifacts = generatedArtifacts(repoRoot);

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
