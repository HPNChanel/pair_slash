import { stableJson } from "@pairslash/spec-core";

function appPackage(name, extras = {}) {
  return stableJson({
    name,
    private: true,
    version: "0.0.0",
    type: "module",
    ...extras,
  });
}

function ensureCapability(manifest, capability) {
  if (manifest.capabilities.includes(capability)) {
    return manifest;
  }
  manifest.capabilities = [...manifest.capabilities, capability];
  return manifest;
}

function supportedLanes(...lanes) {
  return lanes.map((lane) => ({
    runtime: lane.runtime,
    target: lane.target,
    os_lane: lane.os_lane,
    evidence_class: lane.evidence_class,
  }));
}

function cloneFixture(fixture) {
  return {
    id: fixture.id,
    repo_archetype: fixture.repo_archetype,
    purpose: fixture.purpose,
    primary_pack_id: fixture.primary_pack_id,
    source_packs: fixture.source_packs.slice(),
    repo_template: fixture.repo_template ?? null,
    supported_workflows: fixture.supported_workflows.slice(),
    expected_capabilities: fixture.expected_capabilities.slice(),
    modeled_risks: fixture.modeled_risks.slice(),
    supported_lanes: fixture.supported_lanes.map((lane) => ({ ...lane })),
  };
}

export const COMPAT_FIXTURES = [
  {
    id: "repo-basic-readonly",
    repo_archetype: "baseline-readonly",
    purpose: "Baseline read-only repo for deterministic compile/install/doctor coverage.",
    primary_pack_id: "pairslash-plan",
    source_packs: ["pairslash-plan", "pairslash-review"],
    supported_workflows: ["pairslash-plan", "pairslash-review"],
    expected_capabilities: ["memory_read", "preview_emit", "repo_read", "review_analysis"],
    modeled_risks: ["docs-drift", "preview-regression", "readonly-install-surface"],
    supported_lanes: supportedLanes(
      { runtime: "codex_cli", target: "repo", os_lane: "darwin", evidence_class: "stable-tested" },
      { runtime: "copilot_cli", target: "user", os_lane: "linux", evidence_class: "degraded" },
      { runtime: "codex_cli", target: "repo", os_lane: "windows", evidence_class: "prep" },
    ),
    overlay_files: {
      "package.json": appPackage("compat-basic-readonly"),
      "src/index.js": "export const mode = \"basic-readonly\";\n",
      "README.md": "# Compat Fixture: Basic Readonly\n",
    },
  },
  {
    id: "repo-write-authority-memory",
    repo_archetype: "write-authority-memory",
    purpose: "Write-authority repo with authoritative memory layout and audit log paths.",
    primary_pack_id: "pairslash-memory-write-global",
    source_packs: ["pairslash-memory-write-global"],
    supported_workflows: ["pairslash-memory-write-global"],
    expected_capabilities: ["memory_read", "memory_write_global", "preview_emit"],
    modeled_risks: ["hidden-write", "preview-regression", "no-silent-fallback"],
    supported_lanes: supportedLanes(
      { runtime: "codex_cli", target: "repo", os_lane: "darwin", evidence_class: "stable-tested" },
      { runtime: "copilot_cli", target: "user", os_lane: "linux", evidence_class: "degraded" },
    ),
    overlay_files: {
      "package.json": appPackage("compat-write-authority"),
      ".pairslash/project-memory/90-memory-index.yaml": "kind: memory-index\nentries: []\n",
      ".pairslash/audit-log/.gitkeep": "",
      "README.md": "# Compat Fixture: Write Authority\n",
    },
  },
  {
    id: "repo-backend-mcp",
    repo_archetype: "node-service",
    purpose: "Backend repo whose manifest explicitly declares MCP and tool dependencies.",
    primary_pack_id: "pairslash-backend",
    source_packs: ["pairslash-backend"],
    repo_template: "node-service",
    supported_workflows: ["pairslash-backend"],
    expected_capabilities: ["mcp_client", "preview_emit", "repo_read", "repo_write", "test_exec"],
    modeled_risks: ["mcp-config-drift", "tooling-gap", "degraded-runtime-surface"],
    supported_lanes: supportedLanes(
      { runtime: "codex_cli", target: "repo", os_lane: "darwin", evidence_class: "stable-tested" },
      { runtime: "copilot_cli", target: "user", os_lane: "linux", evidence_class: "degraded" },
    ),
    overlay_files: {
      "package.json": appPackage("compat-backend-mcp"),
      "README.md": "# Compat Fixture: Backend MCP\n",
    },
    mutate_manifest(packId, manifest) {
      if (packId !== "pairslash-backend") {
        return manifest;
      }
      ensureCapability(manifest, "mcp_client");
      manifest.required_tools = [
        {
          id: "node",
          kind: "binary",
          required_for: ["doctor", "install"],
          check_command: "node --version",
        },
      ];
      manifest.required_mcp_servers = [
        {
          id: "repo-memory",
        },
      ];
      return manifest;
    },
  },
  {
    id: "repo-monorepo-workspaces",
    repo_archetype: "monorepo",
    purpose: "Nested workspace repo for repo-root resolution and stable install path mapping.",
    primary_pack_id: "pairslash-plan",
    source_packs: ["pairslash-plan", "pairslash-frontend"],
    repo_template: "monorepo",
    supported_workflows: ["pairslash-plan", "pairslash-frontend"],
    expected_capabilities: ["preview_emit", "repo_read", "repo_write", "test_exec"],
    modeled_risks: ["workspace-root-resolution", "install-path-drift", "multi-pack-selection"],
    supported_lanes: supportedLanes(
      { runtime: "codex_cli", target: "repo", os_lane: "darwin", evidence_class: "stable-tested" },
      { runtime: "copilot_cli", target: "user", os_lane: "linux", evidence_class: "degraded" },
      { runtime: "copilot_cli", target: "repo", os_lane: "windows", evidence_class: "prep" },
    ),
    overlay_files: {
      "README.md": "# Compat Fixture: Monorepo Workspaces\n",
    },
  },
  {
    id: "repo-conflict-existing-runtime",
    repo_archetype: "runtime-conflict",
    purpose: "Repo with pre-existing runtime footprint and orphaned managed state.",
    primary_pack_id: "pairslash-plan",
    source_packs: ["pairslash-plan"],
    supported_workflows: ["pairslash-plan"],
    expected_capabilities: ["preview_emit", "repo_read"],
    modeled_risks: ["unmanaged-runtime-footprint", "orphaned-state", "blocked-install"],
    supported_lanes: supportedLanes(
      { runtime: "copilot_cli", target: "repo", os_lane: "windows", evidence_class: "prep" },
      { runtime: "copilot_cli", target: "repo", os_lane: "linux", evidence_class: "degraded" },
    ),
    overlay_files: {
      "package.json": appPackage("compat-conflict-runtime"),
      "README.md": "# Compat Fixture: Conflict Existing Runtime\n",
    },
    setup_modes: {
      seed_codex_orphan_state: true,
      seed_copilot_unmanaged_conflict: true,
    },
  },
  {
    id: "repo-node-service",
    repo_archetype: "node-service",
    purpose: "Node service repo that stresses backend and devops workflows on runtime-native outputs.",
    primary_pack_id: "pairslash-backend",
    source_packs: ["pairslash-backend", "pairslash-devops"],
    repo_template: "node-service",
    supported_workflows: ["pairslash-backend", "pairslash-devops"],
    expected_capabilities: ["preview_emit", "repo_read", "repo_write", "shell_exec", "test_exec"],
    modeled_risks: ["service-config-drift", "workflow-selection", "generated-asset-noise"],
    supported_lanes: supportedLanes(
      { runtime: "codex_cli", target: "repo", os_lane: "darwin", evidence_class: "stable-tested" },
      { runtime: "copilot_cli", target: "user", os_lane: "linux", evidence_class: "degraded" },
      { runtime: "codex_cli", target: "repo", os_lane: "windows", evidence_class: "prep" },
    ),
    overlay_files: {
      "README.md": "# Compat Fixture: Node Service\n",
    },
  },
  {
    id: "repo-python-service",
    repo_archetype: "python-service",
    purpose: "Python service corpus fixture kept in the lab to guard non-Node repos that still consume PairSlash workflows.",
    primary_pack_id: "pairslash-backend",
    source_packs: ["pairslash-backend", "pairslash-devops"],
    repo_template: "python-service",
    supported_workflows: ["pairslash-backend", "pairslash-devops"],
    expected_capabilities: ["preview_emit", "repo_read", "repo_write", "shell_exec", "test_exec"],
    modeled_risks: ["polyglot-repo-coverage", "config-fragment-placement", "service-onboarding-regression"],
    supported_lanes: supportedLanes(
      { runtime: "codex_cli", target: "repo", os_lane: "darwin", evidence_class: "stable-tested" },
      { runtime: "copilot_cli", target: "user", os_lane: "linux", evidence_class: "degraded" },
    ),
    overlay_files: {
      "README.md": "# Compat Fixture: Python Service\n",
    },
  },
  {
    id: "repo-docs-heavy",
    repo_archetype: "docs-heavy",
    purpose: "Docs-heavy repository that stresses plan and review workflows without implying hidden write capability.",
    primary_pack_id: "pairslash-plan",
    source_packs: ["pairslash-plan", "pairslash-review"],
    repo_template: "docs-heavy",
    supported_workflows: ["pairslash-plan", "pairslash-review"],
    expected_capabilities: ["memory_read", "preview_emit", "repo_read", "review_analysis"],
    modeled_risks: ["docs-surface-regression", "preview-boundary", "release-doc-drift"],
    supported_lanes: supportedLanes(
      { runtime: "codex_cli", target: "repo", os_lane: "darwin", evidence_class: "stable-tested" },
      { runtime: "copilot_cli", target: "user", os_lane: "linux", evidence_class: "degraded" },
      { runtime: "copilot_cli", target: "user", os_lane: "windows", evidence_class: "prep" },
    ),
    overlay_files: {
      "README.md": "# Compat Fixture: Docs Heavy\n",
    },
  },
  {
    id: "repo-infra-repo",
    repo_archetype: "infra-repo",
    purpose: "Infrastructure repo that exercises devops and release workflows across config-heavy generated assets.",
    primary_pack_id: "pairslash-devops",
    source_packs: ["pairslash-devops", "pairslash-release"],
    repo_template: "infra-repo",
    supported_workflows: ["pairslash-devops", "pairslash-release"],
    expected_capabilities: ["preview_emit", "repo_read", "repo_write", "shell_exec", "test_exec"],
    modeled_risks: ["config-fragment-placement", "release-gating-drift", "high-blast-radius-changes"],
    supported_lanes: supportedLanes(
      { runtime: "codex_cli", target: "repo", os_lane: "darwin", evidence_class: "stable-tested" },
      { runtime: "copilot_cli", target: "user", os_lane: "linux", evidence_class: "degraded" },
      { runtime: "codex_cli", target: "repo", os_lane: "windows", evidence_class: "prep" },
    ),
    overlay_files: {
      "README.md": "# Compat Fixture: Infra Repo\n",
    },
  },
  {
    id: "repo-unsafe-repo",
    repo_archetype: "unsafe-repo",
    purpose: "Unsafe repo corpus that models destructive scripts and secret-adjacent surfaces for policy and no-silent-fallback checks.",
    primary_pack_id: "pairslash-devops",
    source_packs: ["pairslash-devops", "pairslash-memory-write-global"],
    repo_template: "unsafe-repo",
    supported_workflows: ["pairslash-devops", "pairslash-memory-write-global"],
    expected_capabilities: ["memory_write_global", "preview_emit", "repo_read", "repo_write", "shell_exec"],
    modeled_risks: ["destructive-commands", "hidden-write", "silent-fallback", "approval-boundary"],
    supported_lanes: supportedLanes(
      { runtime: "codex_cli", target: "repo", os_lane: "darwin", evidence_class: "stable-tested" },
      { runtime: "copilot_cli", target: "user", os_lane: "linux", evidence_class: "degraded" },
      { runtime: "copilot_cli", target: "repo", os_lane: "windows", evidence_class: "prep" },
    ),
    overlay_files: {
      "README.md": "# Compat Fixture: Unsafe Repo\n",
    },
  },
];

export function listCompatFixtures() {
  return COMPAT_FIXTURES.map((fixture) => cloneFixture(fixture));
}

export function getCompatFixture(fixtureId) {
  const fixture = COMPAT_FIXTURES.find((entry) => entry.id === fixtureId) ?? null;
  if (!fixture) {
    throw new Error(`unknown compat fixture: ${fixtureId}`);
  }
  return fixture;
}
