# PairSlash Phase 0 -- Compatibility Matrix

Human-readable summary of the runtime surface comparison.
Machine-readable version: `phase-0/compatibility/runtime-surface-matrix.yaml`

**Legend:**
- FACT -- confirmed from official documentation
- DOC-UNVERIFIED -- in documentation but not yet tested on a real CLI
- UNVERIFIED -- needs live CLI testing; no documentation either confirms or denies
- KNOWN-BUG -- documented known issue

---

## Skill format

| Property | Codex CLI | Copilot CLI | Compatible? |
|----------|-----------|-------------|-------------|
| SKILL.md required | Yes | Yes | YES |
| Frontmatter: `name` | Yes (required) | Yes (required) | YES |
| Frontmatter: `description` | Yes (required) | Yes (required) | YES |
| Frontmatter: `license` | Not documented | Optional | COMPAT -- optional field |
| Markdown body | Yes | Yes | YES |
| `scripts/` subdirectory | Yes (FACT) | Yes (implied) | YES |
| `references/` subdirectory | Yes (FACT) | Not documented | PARTIAL |
| `agents/openai.yaml` metadata | Yes (FACT) | Not supported | CODEX-ONLY |

**Conclusion:** One canonical SKILL.md per skill works on both runtimes.

---

## Skill storage paths

### Codex CLI

| Scope | Path | Notes |
|-------|------|-------|
| Repo (current dir) | `.agents/skills/` | Scanned from CWD up to repo root |
| Repo (parent dir) | `../.agents/skills/` | Scanned when CWD is inside a git repo |
| Repo (root) | `$REPO_ROOT/.agents/skills/` | Root-level skills available to all subdirs |
| User (cross-repo) | `~/.agents/skills/` | Applies to all repos |
| Admin (machine-wide) | `/etc/codex/skills` | macOS/Linux only |

**Windows paths:**

| Scope | Path |
|-------|------|
| Repo | `.agents\skills\` |
| User | `%USERPROFILE%\.agents\skills\` or `$env:USERPROFILE\.agents\skills\` |
| Admin | No documented Windows equivalent |

### GitHub Copilot CLI

| Scope | Path | Notes |
|-------|------|-------|
| Repo (primary) | `.github/skills/` | Standard location |
| Repo (alt) | `.claude/skills/` | Claude-compatible alternative |
| User (cross-repo) | `~/.copilot/skills/` | Primary user-level location |
| User (alt) | `~/.claude/skills/` | Alternative user-level location |

**Windows paths:**

| Scope | Path |
|-------|------|
| Repo | `.github\skills\` |
| User | `%USERPROFILE%\.copilot\skills\` or `$env:USERPROFILE\.copilot\skills\` |

---

## Invocation paths

| Method | Codex CLI | Status | Copilot CLI | Status |
|--------|-----------|--------|-------------|--------|
| Browse and select | `/skills` (then select) | DOC-UNVERIFIED (V1) | `/skills` then pick | FACT |
| List available | Unknown | UNVERIFIED | `/skills list` | FACT |
| Get skill info | Unknown | UNVERIFIED | `/skills info` | FACT |
| Add location | Unknown | UNVERIFIED | `/skills add` | FACT |
| Reload mid-session | Automatic (per docs) | DOC-UNVERIFIED | `/skills reload` | DOC-UNVERIFIED (V7) |
| Direct by name | `$skill-name` | FACT (DOC) | `/skill-name` in prompt | FACT |
| Implicit (auto-match) | Yes (by description) | FACT | Yes (by description) | FACT |
| Non-interactive mode | Unknown | UNVERIFIED | Does not work (`-p` flag) | KNOWN-BUG |

---

## PairSlash-specific paths

### pairslash-plan

| Property | Codex CLI | Copilot CLI |
|----------|-----------|-------------|
| Source | `phase-0/skills/pairslash-plan/SKILL.md` | same |
| Repo install target | `.agents/skills/pairslash-plan/` | `.github/skills/pairslash-plan/` |
| User install target | `~/.agents/skills/pairslash-plan/` | `~/.copilot/skills/pairslash-plan/` |
| Activation (canonical) | `/skills` | `/skills` |
| Activation (direct) | `$pairslash-plan` | `/pairslash-plan` |

### pairslash-memory-write-global

| Property | Codex CLI | Copilot CLI |
|----------|-----------|-------------|
| Source | `phase-0/skills/pairslash-memory-write-global/SKILL.md` | same |
| Repo install target | `.agents/skills/pairslash-memory-write-global/` | `.github/skills/pairslash-memory-write-global/` |
| User install target | `~/.agents/skills/pairslash-memory-write-global/` | `~/.copilot/skills/pairslash-memory-write-global/` |
| Activation (canonical) | `/skills` | `/skills` |
| Activation (direct) | `$pairslash-memory-write-global` | `/pairslash-memory-write-global` |

---

## Known divergences

| Surface | Codex CLI | Copilot CLI | Impact |
|---------|-----------|-------------|--------|
| Repo skill storage path | `.agents/skills/` | `.github/skills/` | Manual install needed for each runtime; Phase 1 compiler resolves |
| Direct invocation syntax | `$name` | `/name` in prompt | Must be documented per runtime; cannot be standardized |
| `/skills` subcommands | Limited (DOC-UNVERIFIED) | Rich (list, info, add, reload, remove) | Better management UX on Copilot CLI |
| Metadata file | `agents/openai.yaml` supported | Not documented | Codex-only enhancement; does not affect compatibility |
| Non-interactive mode | Unknown | Skills do not load (known bug) | Phase 0 targets interactive mode only; not a blocker |

---

## What we are intentionally NOT doing in Phase 0

1. **No runtime-specific SKILL.md compilation.** One SKILL.md per skill, installed
   to different paths. The Phase 1 compiler handles divergence if it materializes.

2. **No custom slash registry.** `/skills` and `$name` / `/name` are sufficient.
   No proprietary slash command table is needed.

3. **No verification of implicit invocation.** Implicit invocation (auto-match by
   description) exists on both runtimes but is non-deterministic. Phase 0 tests
   explicit invocation only.

4. **No cross-runtime test automation.** All testing in Phase 0 is manual.
   Phase 1 adds automated compatibility checks.

5. **No claim that `scripts/` works correctly.** Script execution in skill
   directories is documented but unverified. Phase 0 skills are instruction-only.

6. **No claim that non-interactive mode works.** The Copilot CLI `-p` bug means
   Phase 0 is interactive-only.
