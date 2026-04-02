import { resolve } from "node:path";

import { stableJson, verifyReleaseTrustBundle } from "@pairslash/spec-core";

function parseArgs(argv) {
  const options = {
    repoRoot: process.cwd(),
    trustDir: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--repo-root") {
      options.repoRoot = resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--trust-dir") {
      options.trustDir = resolve(options.repoRoot, argv[index + 1]);
      index += 1;
    }
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const verification = verifyReleaseTrustBundle({
  repoRoot: options.repoRoot,
  trustDir: options.trustDir ?? resolve(options.repoRoot, "dist", "release-trust"),
});

process.stdout.write(stableJson(verification));
