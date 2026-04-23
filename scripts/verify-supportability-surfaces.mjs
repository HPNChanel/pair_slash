import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import YAML from "yaml";

import { TRACE_FAILURE_DOMAINS, stableJson } from "@pairslash/spec-core";
import { FAILURE_TAXONOMY_LABELS } from "../packages/tools/trace/src/failure-taxonomy.js";

const REQUIRED_PATHS = [
  "docs/reporting.md",
  "docs/support/phase-7-support-ops.md",
  "docs/support/bundle-intake-policy.md",
  "docs/support/triage-playbook.md",
  "docs/support/repro-assets.md",
  "docs/phase-9/issue-taxonomy.md",
  "docs/phase-9/maintainer-playbook.md",
  "docs/phase-9/support-surfaces-summary.md",
  "docs/maintainers/README.md",
  "docs/maintainers/pack-lifecycle-checklist.md",
  ".github/ISSUE_TEMPLATE/install-bug.md",
  ".github/ISSUE_TEMPLATE/runtime-mismatch.md",
  ".github/ISSUE_TEMPLATE/workflow-bug.md",
  ".github/ISSUE_TEMPLATE/memory-bug.md",
  ".github/ISSUE_TEMPLATE/pairslash-support-bundle.md",
  ".github/ISSUE_TEMPLATE/pack-request.yml",
  ".github/ISSUE_TEMPLATE/docs-problem.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  "scripts/verify-supportability-surfaces.mjs",
];

const TEMPLATE_LABEL_EXPECTATIONS = {
  ".github/ISSUE_TEMPLATE/install-bug.md": ["support", "surface:install-lifecycle", "status:needs-info"],
  ".github/ISSUE_TEMPLATE/runtime-mismatch.md": ["support", "surface:runtime-mismatch", "status:needs-info"],
  ".github/ISSUE_TEMPLATE/workflow-bug.md": ["support", "surface:workflow", "status:needs-info"],
  ".github/ISSUE_TEMPLATE/memory-bug.md": ["support", "surface:memory", "status:needs-info"],
  ".github/ISSUE_TEMPLATE/pairslash-support-bundle.md": ["support", "status:needs-info"],
  ".github/ISSUE_TEMPLATE/pack-request.yml": ["support", "surface:pack-discovery", "type:pack-request", "status:triage"],
  ".github/ISSUE_TEMPLATE/docs-problem.yml": ["support", "surface:docs-nav-wording", "type:docs-drift", "status:triage"],
};

const REQUIRED_DOC_PHRASES = {
  "docs/reporting.md": [
    "Choose the right issue template",
    "phase-9/issue-taxonomy.md",
    "support/phase-7-support-ops.md",
  ],
  "docs/support/phase-7-support-ops.md": [
    "support bundles are generated only on explicit user command",
    "redaction runs before any bundle is marked shareable",
    "redaction_state",
  ],
  "docs/support/bundle-intake-policy.md": [
    "safe_to_share: true",
    "redaction_state: shareable",
    "privacy-note.txt",
    "surface:install-lifecycle",
  ],
  "docs/support/triage-playbook.md": [
    "surface:*",
    "type:*",
    "severity:s0",
    "type:evidence-gap",
  ],
  "docs/support/repro-assets.md": [
    "pairslash doctor",
    "pairslash debug --bundle",
    "pairslash trace export --support-bundle --include-doctor",
  ],
  "docs/phase-9/issue-taxonomy.md": [
    "surface:install-lifecycle",
    "surface:runtime-mismatch",
    "surface:workflow",
    "surface:memory",
    "surface:pack-discovery",
    "surface:docs-nav-wording",
  ],
  "docs/phase-9/maintainer-playbook.md": [
    "type:support",
    "type:bug",
    "type:docs-drift",
    "type:evidence-gap",
    "docs/support/triage-playbook.md",
  ],
};

function fileAt(repoRoot, relativePath) {
  return resolve(repoRoot, relativePath);
}

function readFile(repoRoot, relativePath) {
  return readFileSync(fileAt(repoRoot, relativePath), "utf8");
}

function parseFrontMatter(mdText, relativePath) {
  const match = mdText.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    throw new Error(`missing front matter in ${relativePath}`);
  }
  const parsed = YAML.parse(match[1]);
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`invalid front matter in ${relativePath}`);
  }
  return parsed;
}

function parseTemplateLabels(repoRoot, relativePath) {
  const contents = readFile(repoRoot, relativePath);
  if (relativePath.endsWith(".md")) {
    const frontMatter = parseFrontMatter(contents, relativePath);
    const labels = frontMatter.labels;
    return Array.isArray(labels) ? labels : [];
  }
  const parsed = YAML.parse(contents);
  const labels = parsed?.labels;
  return Array.isArray(labels) ? labels : [];
}

function verifyRequiredPaths(repoRoot, failures) {
  for (const relativePath of REQUIRED_PATHS) {
    if (!existsSync(fileAt(repoRoot, relativePath))) {
      failures.push(`missing required supportability path: ${relativePath}`);
    }
  }
}

function verifyTemplateLabels(repoRoot, failures) {
  for (const [relativePath, requiredLabels] of Object.entries(TEMPLATE_LABEL_EXPECTATIONS)) {
    let labels;
    try {
      labels = parseTemplateLabels(repoRoot, relativePath);
    } catch (error) {
      failures.push(error.message);
      continue;
    }
    for (const label of requiredLabels) {
      if (!labels.includes(label)) {
        failures.push(`${relativePath} is missing required label '${label}'`);
      }
    }
  }
}

function verifyDocPhrases(repoRoot, failures) {
  for (const [relativePath, requiredPhrases] of Object.entries(REQUIRED_DOC_PHRASES)) {
    const contents = readFile(repoRoot, relativePath);
    for (const phrase of requiredPhrases) {
      if (!contents.includes(phrase)) {
        failures.push(`${relativePath} is missing required phrase '${phrase}'`);
      }
    }
  }
}

function verifyFailureTaxonomyCoverage(failures) {
  const mappedDomains = Object.keys(FAILURE_TAXONOMY_LABELS);
  const missing = TRACE_FAILURE_DOMAINS.filter((domain) => !mappedDomains.includes(domain));
  const extra = mappedDomains.filter((domain) => !TRACE_FAILURE_DOMAINS.includes(domain));
  if (missing.length > 0) {
    failures.push(`failure taxonomy is missing domains: ${missing.join(", ")}`);
  }
  if (extra.length > 0) {
    failures.push(`failure taxonomy includes unknown domains: ${extra.join(", ")}`);
  }

  for (const [domain, entry] of Object.entries(FAILURE_TAXONOMY_LABELS)) {
    if (!entry.recommended_surface_label?.startsWith("surface:")) {
      failures.push(`failure taxonomy ${domain} must use a surface:* label`);
    }
    if (!entry.recommended_type_label?.startsWith("type:")) {
      failures.push(`failure taxonomy ${domain} must use a type:* label`);
    }
    if (!entry.recommended_severity_label?.startsWith("severity:")) {
      failures.push(`failure taxonomy ${domain} must use a severity:* label`);
    }
    if (!entry.recommended_status_label?.startsWith("status:")) {
      failures.push(`failure taxonomy ${domain} must use a status:* label`);
    }
  }
}

function main() {
  const repoRoot = process.cwd();
  const failures = [];

  verifyRequiredPaths(repoRoot, failures);
  verifyTemplateLabels(repoRoot, failures);
  verifyDocPhrases(repoRoot, failures);
  verifyFailureTaxonomyCoverage(failures);

  if (failures.length > 0) {
    console.error("supportability surface verification failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  process.stdout.write(
    stableJson({
      kind: "supportability-surface-verification",
      required_paths: REQUIRED_PATHS.length,
      template_count: Object.keys(TEMPLATE_LABEL_EXPECTATIONS).length,
      failure_domain_count: TRACE_FAILURE_DOMAINS.length,
      status: "pass",
    }),
  );
}

main();
