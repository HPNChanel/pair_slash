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

export const COMPAT_FIXTURES = [
  {
    id: "repo-basic-readonly",
    purpose: "Baseline read-only repo for deterministic compile/install/doctor coverage.",
    source_packs: ["pairslash-plan", "pairslash-review"],
    overlay_files: {
      "package.json": appPackage("compat-basic-readonly"),
      "src/index.js": "export const mode = \"basic-readonly\";\n",
      "README.md": "# Compat Fixture: Basic Readonly\n",
    },
  },
  {
    id: "repo-write-authority-memory",
    purpose: "Write-authority repo with authoritative memory layout and audit log paths.",
    source_packs: ["pairslash-memory-write-global"],
    overlay_files: {
      "package.json": appPackage("compat-write-authority"),
      ".pairslash/project-memory/90-memory-index.yaml": "kind: memory-index\nentries: []\n",
      ".pairslash/audit-log/.gitkeep": "",
      "README.md": "# Compat Fixture: Write Authority\n",
    },
  },
  {
    id: "repo-backend-mcp",
    purpose: "Backend repo whose manifest explicitly declares MCP and tool dependencies.",
    source_packs: ["pairslash-backend"],
    overlay_files: {
      "package.json": appPackage("compat-backend-mcp"),
      "services/api/index.js": "export const service = \"api\";\n",
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
    purpose: "Nested workspace repo for repo-root resolution and stable install path mapping.",
    source_packs: ["pairslash-plan", "pairslash-frontend"],
    overlay_files: {
      "package.json": appPackage("compat-monorepo", {
        workspaces: ["apps/*", "packages/*"],
      }),
      "apps/api/package.json": appPackage("@compat/api"),
      "apps/web/package.json": appPackage("@compat/web"),
      "packages/shared/package.json": appPackage("@compat/shared"),
      "README.md": "# Compat Fixture: Monorepo Workspaces\n",
    },
  },
  {
    id: "repo-conflict-existing-runtime",
    purpose: "Repo with pre-existing runtime footprint and orphaned managed state.",
    source_packs: ["pairslash-plan"],
    overlay_files: {
      "package.json": appPackage("compat-conflict-runtime"),
      "README.md": "# Compat Fixture: Conflict Existing Runtime\n",
    },
    setup_modes: {
      seed_codex_orphan_state: true,
      seed_copilot_unmanaged_conflict: true,
    },
  },
];

export function listCompatFixtures() {
  return COMPAT_FIXTURES.map((fixture) => ({
    id: fixture.id,
    purpose: fixture.purpose,
    source_packs: fixture.source_packs.slice(),
  }));
}

export function getCompatFixture(fixtureId) {
  const fixture = COMPAT_FIXTURES.find((entry) => entry.id === fixtureId) ?? null;
  if (!fixture) {
    throw new Error(`unknown compat fixture: ${fixtureId}`);
  }
  return fixture;
}
