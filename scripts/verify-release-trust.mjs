import { resolve } from "node:path";

import {
  stableJson,
  verifyReleaseTrustBundle,
  verifyReleaseTrustBundleStructure,
} from "@pairslash/spec-core";

function parseArgs(argv) {
  const options = {
    repoRoot: process.cwd(),
    trustDir: null,
    mode: "signed",
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
      continue;
    }
    if (token === "--mode") {
      options.mode = argv[index + 1] === "structural" ? "structural" : "signed";
      index += 1;
    }
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const trustDir = options.trustDir ?? resolve(options.repoRoot, "dist", "release-trust");
let verification = null;
try {
  verification =
    options.mode === "structural"
      ? verifyReleaseTrustBundleStructure({
          repoRoot: options.repoRoot,
          trustDir,
        })
      : verifyReleaseTrustBundle({
          repoRoot: options.repoRoot,
          trustDir,
        });
} catch (error) {
  console.error(
    `release-trust verification failed (mode=${options.mode}, trust_dir=${trustDir}): ${error.message}`,
  );
  process.exit(1);
}

process.stdout.write(stableJson(verification));
