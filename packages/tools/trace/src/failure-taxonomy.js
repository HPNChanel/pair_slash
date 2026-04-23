export const SUPPORT_FAILURE_TAXONOMY_VERSION = "1.0.0";

const FALLBACK_ENTRY = Object.freeze({
  recommended_surface_label: "surface:workflow",
  recommended_type_label: "type:support",
  recommended_severity_label: "severity:s2",
  recommended_status_label: "status:needs-info",
  recommended_issue_template: ".github/ISSUE_TEMPLATE/pairslash-support-bundle.md",
  maintainer_route: "docs/support/triage-playbook.md",
  rationale:
    "Failure domain is missing or unknown, so maintainers should start with workflow intake and label refinement.",
});

export const FAILURE_TAXONOMY_LABELS = Object.freeze({
  none: Object.freeze({
    recommended_surface_label: "surface:workflow",
    recommended_type_label: "type:support",
    recommended_severity_label: "severity:s3",
    recommended_status_label: "status:needs-info",
    recommended_issue_template: ".github/ISSUE_TEMPLATE/workflow-bug.md",
    maintainer_route: "docs/support/triage-playbook.md",
    rationale:
      "No terminal failure domain was captured in the trace, so maintainers should request only minimal workflow evidence first.",
  }),
  spec: Object.freeze({
    recommended_surface_label: "surface:workflow",
    recommended_type_label: "type:bug",
    recommended_severity_label: "severity:s2",
    recommended_status_label: "status:triage",
    recommended_issue_template: ".github/ISSUE_TEMPLATE/workflow-bug.md",
    maintainer_route: "docs/phase-9/issue-taxonomy.md",
    rationale:
      "Spec, schema, or contract validation failures usually indicate implementation drift and should be triaged as workflow bugs.",
  }),
  compiler: Object.freeze({
    recommended_surface_label: "surface:workflow",
    recommended_type_label: "type:bug",
    recommended_severity_label: "severity:s2",
    recommended_status_label: "status:triage",
    recommended_issue_template: ".github/ISSUE_TEMPLATE/workflow-bug.md",
    maintainer_route: "docs/troubleshooting/compat-lab-bug-repro.md",
    rationale:
      "Compiler failures are deterministic workflow defects and should route through workflow bug intake plus deterministic repro.",
  }),
  policy: Object.freeze({
    recommended_surface_label: "surface:workflow",
    recommended_type_label: "type:support",
    recommended_severity_label: "severity:s2",
    recommended_status_label: "status:triage",
    recommended_issue_template: ".github/ISSUE_TEMPLATE/workflow-bug.md",
    maintainer_route: "docs/support/triage-playbook.md",
    rationale:
      "Policy denials can be expected lane behavior or policy drift; start as support triage and escalate to bug only if behavior violates documented scope.",
  }),
  runtime_adapter: Object.freeze({
    recommended_surface_label: "surface:runtime-mismatch",
    recommended_type_label: "type:bug",
    recommended_severity_label: "severity:s1",
    recommended_status_label: "status:triage",
    recommended_issue_template: ".github/ISSUE_TEMPLATE/runtime-mismatch.md",
    maintainer_route: "docs/compatibility/runtime-verification.md",
    rationale:
      "Adapter-surface failures usually indicate runtime-lane behavior drift versus compatibility/runtime docs.",
  }),
  runtime_host: Object.freeze({
    recommended_surface_label: "surface:runtime-mismatch",
    recommended_type_label: "type:support",
    recommended_severity_label: "severity:s1",
    recommended_status_label: "status:needs-info",
    recommended_issue_template: ".github/ISSUE_TEMPLATE/runtime-mismatch.md",
    maintainer_route: "docs/workflows/phase-4-doctor-troubleshooting.md",
    rationale:
      "Runtime host resolution issues are commonly environment or lane prerequisites and should start as support triage.",
  }),
  memory: Object.freeze({
    recommended_surface_label: "surface:memory",
    recommended_type_label: "type:bug",
    recommended_severity_label: "severity:s1",
    recommended_status_label: "status:triage",
    recommended_issue_template: ".github/ISSUE_TEMPLATE/memory-bug.md",
    maintainer_route: "docs/phase-9/maintainer-playbook.md",
    rationale:
      "Memory-path failures can affect trust-boundary guarantees, so they should route directly to the memory issue surface.",
  }),
  filesystem: Object.freeze({
    recommended_surface_label: "surface:install-lifecycle",
    recommended_type_label: "type:support",
    recommended_severity_label: "severity:s1",
    recommended_status_label: "status:needs-info",
    recommended_issue_template: ".github/ISSUE_TEMPLATE/install-bug.md",
    maintainer_route: "docs/support/repro-assets.md",
    rationale:
      "Filesystem path and permission errors are usually install lifecycle or environment issues and should begin with install intake.",
  }),
  config: Object.freeze({
    recommended_surface_label: "surface:install-lifecycle",
    recommended_type_label: "type:support",
    recommended_severity_label: "severity:s2",
    recommended_status_label: "status:needs-info",
    recommended_issue_template: ".github/ISSUE_TEMPLATE/install-bug.md",
    maintainer_route: "docs/workflows/phase-4-doctor-troubleshooting.md",
    rationale:
      "Config-home and install-root mismatches should be handled through install lifecycle triage before escalating.",
  }),
  unknown: Object.freeze({
    recommended_surface_label: "surface:workflow",
    recommended_type_label: "type:support",
    recommended_severity_label: "severity:s2",
    recommended_status_label: "status:needs-info",
    recommended_issue_template: ".github/ISSUE_TEMPLATE/pairslash-support-bundle.md",
    maintainer_route: "docs/support/triage-playbook.md",
    rationale:
      "Unknown failures should start with artifact-heavy intake so maintainers can classify the correct surface without over-asking.",
  }),
});

export function resolveFailureTaxonomy(decisiveFailureDomain = "unknown") {
  const normalized = typeof decisiveFailureDomain === "string" ? decisiveFailureDomain : "unknown";
  const entry = FAILURE_TAXONOMY_LABELS[normalized] ?? FALLBACK_ENTRY;
  return {
    taxonomy_version: SUPPORT_FAILURE_TAXONOMY_VERSION,
    decisive_failure_domain: normalized,
    ...entry,
  };
}

export function listFailureTaxonomyEntries() {
  return Object.entries(FAILURE_TAXONOMY_LABELS)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([decisiveFailureDomain, entry]) => ({
      taxonomy_version: SUPPORT_FAILURE_TAXONOMY_VERSION,
      decisive_failure_domain: decisiveFailureDomain,
      ...entry,
    }));
}
