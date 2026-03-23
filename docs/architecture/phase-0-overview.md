# PairSlash Phase 0 -- Compatibility Spike Overview (Archived)

Archived historical context only. Do not use this page as current install or
operations guidance.

Current active docs:

- `README.md`
- `docs/workflows/install-guide.md`
- `docs/workflows/phase-2-operations.md`
- `docs/compatibility/compatibility-matrix.md`
- `docs/compatibility/runtime-verification.md`

**Version:** 0.1.0
**Phase:** 0
**Status:** Archived historical record (superseded by Phase 2 hardening baseline)

---

## What Phase 0 is

Phase 0 is a **proof-of-architecture** spike. Its only job is to show that the
core PairSlash design is viable before any Phase 1 engineering begins.

It proves:

1. `/skills` works as the canonical entrypoint across supported runtimes.
2. A read-oriented workflow (`pairslash-plan`) can be packaged as a SKILL.md and
   produce a structured, memory-grounded plan.
3. A write-authority workflow (`pairslash-memory-write-global`) can be packaged as
   a SKILL.md and execute an explicit, previewable, auditable write pipeline.
4. Global Project Memory can be file-based, schema-valid, and reviewable by Git.

Phase 0 does **not** prove production readiness, and it does not attempt to.

---

## What Phase 0 is not

Phase 0 deliberately excludes:

| Excluded item | Why |
|---------------|-----|
| Automated installer / doctor | Phase 1 |
| Spec compiler (spec-core, compiler-codex, compiler-copilot) | Phase 1 |
| Memory engine scripts and validation hooks | Phase 2 |
| Third runtime (Claude Code, Cursor, any GUI) | Never in core product |
| MCP integration | Out of scope for Phase 0 |
| Vector database / retrieval | Out of scope permanently |
| Background daemon or hidden memory mutation | Anti-goal per CLAUDE.md |
| Pack packaging and registry | Phase 3 |
| Anything that requires vendor-private internals | Prohibited |

---

## Supported runtimes

PairSlash Phase 0 targets exactly two runtimes:

| Runtime | Vendor | Phase 0 skill storage |
|---------|--------|-----------------------|
| Codex CLI | OpenAI | `.agents/skills/` (repo) or `~/.agents/skills/` (user) |
| GitHub Copilot CLI | GitHub | `.github/skills/` (repo) or `~/.copilot/skills/` (user) |

Cursor is the **build cockpit** used to generate and verify Phase 0 artifacts.
It is not a supported PairSlash runtime.

---

## Canonical activation path

```
/skills
```

Select a skill from the picker. This works on both runtimes.

Direct invocation is also documented (and expected to work based on documentation),
but it is marked "verify in Phase 0" because runtime behavior has not been
confirmed with real CLI testing.

| Runtime | Direct invocation syntax | Status |
|---------|--------------------------|--------|
| Codex CLI | `$pairslash-plan` | Documented; verify in Phase 0 |
| Copilot CLI | `/pairslash-plan` in prompt | Documented; verify in interactive mode only |

---

## Deliverables

### Already completed (artifact layer)

| Artifact | Location | Purpose |
|----------|----------|---------|
| Project charter | `.pairslash/project-memory/00-project-charter.yaml` | Authoritative project identity |
| Stack profile | `.pairslash/project-memory/10-stack-profile.yaml` | Runtime targets and tool paths |
| Memory index | `.pairslash/project-memory/90-memory-index.yaml` | Index of active memory records |
| Memory record schema | `packages/spec-core/schemas/memory-record.schema.yaml` | JSON Schema for all 11 semantic fields |
| pairslash-plan spec | `packages/spec-core/specs/pairslash-plan.spec.yaml` | Formal workflow contracts |
| pairslash-memory-write-global spec | `packages/spec-core/specs/pairslash-memory-write-global.spec.yaml` | Formal workflow contracts + 11-step pipeline |
| pairslash-plan SKILL.md | `packs/core/pairslash-plan/SKILL.md` | Working skill definition |
| pairslash-memory-write-global SKILL.md | `packs/core/pairslash-memory-write-global/SKILL.md` | Working skill definition |
| Runtime surface matrix | `docs/compatibility/runtime-surface-matrix.yaml` | Documented facts per runtime, V1-V7 |
| Risk register | `docs/compatibility/risks.yaml` | 7 risks with severity, evidence, fallback |
| Acceptance gates | `docs/compatibility/acceptance-gates.yaml` | 18 gates (G1-G18) |
| Install guide | `docs/workflows/install-guide.md` | Manual installation steps |

### Requires live CLI testing

The following acceptance gates are `untested` and require a real Codex CLI or
Copilot CLI session:

- G1: `pairslash-plan` appears in `/skills` listing
- G2: `pairslash-memory-write-global` appears in `/skills` listing
- G3: `pairslash-plan` reads `.pairslash/project-memory/` files
- G4: `pairslash-plan` output follows the 9-section structure
- G5: Write workflow produces preview patch before writing
- G6: Write workflow requires explicit acceptance
- G7: Written record contains all 11 semantic fields
- G11-G14: SHOULD gates (cross-runtime, duplicate detection, audit log, direct invocation)

See `docs/compatibility/runtime-verification.md` for step-by-step testing instructions.

---

## What Phase 0 proves vs assumes

| Claim | Status | Evidence |
|-------|--------|---------|
| SKILL.md format is compatible across runtimes | **Fact** | Both runtimes use identical YAML frontmatter + Markdown |
| `/skills` works in Copilot CLI | **Fact** | Fully documented with subcommands |
| `/skills` works in Codex CLI | **Documented-unverified** | Mentioned in docs but absent from slash commands table |
| Direct invocation via `$name` works in Codex CLI | **Documented-unverified** | Verified by docs; not yet tested live |
| Skill reads `.pairslash/` files from instructions | **Unverified** | Requires real CLI testing |
| Preview patch appears before write | **Unverified** | Requires real CLI testing |
| `.pairslash/` directory structure exists | **Verified** | Filesystem listing 2026-03-21 |
| All YAML files parse correctly | **Verified** | Python yaml.safe_load 2026-03-21 (9 files, 0 failures) |
| No third-runtime references in skills | **Verified** | Grep returned 0 matches |
| No silent memory writes in skills | **Verified** | Explicit prohibitions in SKILL.md lines confirmed |
