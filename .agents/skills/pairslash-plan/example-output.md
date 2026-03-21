# pairslash-plan -- Example Output

This file shows a realistic example of what `pairslash-plan` produces.
The scenario: planning Phase 0 skill installation for Codex CLI.

The example demonstrates:
- memory-grounded context (citing `.pairslash/` files)
- `[from memory]` vs `[assumption]` labeling
- all 9 required sections present
- honest "None identified" rather than padded content
- explicit open questions with labeled unknowns

---

**Invocation:**

```
$pairslash-plan Install the pairslash-plan skill into Codex CLI and verify it appears in the /skills picker.
```

---

## pairslash-plan output

---

### Goal

Install the `pairslash-plan` skill into Codex CLI and verify it appears in
the `/skills` picker.

---

### Constraints

**From project memory:**

- `[from memory: 00-project-charter.yaml]` PairSlash supports only Codex CLI and
  GitHub Copilot CLI as product runtimes. Cursor is the build cockpit only.
- `[from memory: 00-project-charter.yaml]` Canonical entrypoint is `/skills`.
  Direct invocation may be tested but `/skills` is the fallback-compatible path.
- `[from memory: 00-project-charter.yaml]` No hidden learning, no background
  daemons, no third runtime.
- `[from memory: 10-stack-profile.yaml]` Codex CLI repo-level skill storage:
  `.agents/skills/`. User-level: `~/.agents/skills/`.
- `[from memory: 10-stack-profile.yaml]` Phase 0 has no automated installer.
  Installation is manual.

**From user input:**

None stated.

---

### Relevant project memory

**From `00-project-charter.yaml`:**

```
canonical_entrypoint: /skills
runtimes:
  supported:
    - codex-cli
    - github-copilot-cli
phase_0_goal: >-
  Verify real trigger behavior for /skills and direct skill invocation,
  prove the concept with minimal but serious workflows,
  keep scope narrow.
```

**From `10-stack-profile.yaml`:**

```
runtimes:
  codex_cli:
    skill_storage_repo: .agents/skills/
    skill_storage_user: ~/.agents/skills/
    invocation_direct: "$skill-name"
    invocation_browse: /skills
```

---

### Proposed steps

1. Confirm Codex CLI is installed and accessible in the terminal
   (`codex --version` or equivalent).
2. From the repository root, create the target directory:
   `mkdir -p .agents/skills`
3. Copy the skill directory:
   `cp -r phase-0/skills/pairslash-plan .agents/skills/`
4. Confirm the file exists:
   `ls .agents/skills/pairslash-plan/SKILL.md`
5. Launch Codex CLI from the repository root:
   `codex` (or the documented launch command for your environment).
6. In the Codex CLI session, type `/skills` and press Enter.
7. Observe whether a skill picker appears and whether `pairslash-plan`
   is listed.
8. If `/skills` does not produce a picker, type `$pairslash-plan` to
   test direct invocation as the fallback.
9. Record the result in
   `phase-0/compatibility/runtime-surface-matrix.yaml` under V1 and V4.

---

### Files likely affected

| File / Path | Action | Certainty |
|-------------|--------|-----------|
| `.agents/skills/pairslash-plan/SKILL.md` | Create (copy) | Certain |
| `phase-0/compatibility/runtime-surface-matrix.yaml` | Update V1, V4 status | Certain |

No source files in `phase-0/skills/pairslash-plan/` should be modified.
The copy is from source to installation target.

---

### Tests and checks

**Verification steps:**

- `ls .agents/skills/pairslash-plan/SKILL.md` returns the file (installation check).
- Launching Codex CLI and observing the `/skills` picker (acceptance gate G1).
- Invoking `pairslash-plan` with a simple goal and verifying all 9 output sections
  appear (acceptance gate G4).
- Verifying the skill reads `.pairslash/project-memory/00-project-charter.yaml`
  and cites it in output (acceptance gate G3).

**Tests that might break:**

None. This is an additive installation step with no source code changes.

---

### Risks

- **`/skills` picker may not exist in Codex CLI**
  Likelihood: medium | Impact: medium
  Mitigation: Fall back to `$pairslash-plan` direct invocation, which is
  documented. Update runtime-surface-matrix.yaml V1 with finding.

- **Codex CLI may not read `.pairslash/` files from skill instructions**
  Likelihood: medium | Impact: medium
  Mitigation: If automatic file reading fails, instruct the user to paste the
  relevant project memory content. Mark V2 as "failed" in the matrix and open
  a Phase 1 task for MCP-based memory access.

- **Codex CLI may not be installed or the launch command may differ**
  Likelihood: low | Impact: high
  Mitigation: Follow the Codex CLI install guide at
  https://developers.openai.com/codex/cli before proceeding.

---

### Rollback

This plan only copies files. Rollback is:

```bash
rm -rf .agents/skills/pairslash-plan
```

No state is changed in Codex CLI itself. No project-memory files are modified.

---

### Open questions

- `[I don't know]` Whether `/skills` produces a skill picker in Codex CLI
  interactive mode. The skills documentation page mentions it, but it is absent
  from the CLI slash commands reference table (V1: unverified).

- `[I don't know]` Whether `$pairslash-plan` needs to be typed as a prefix
  before a prompt or can stand alone as a command. The docs show both patterns
  but do not clarify for CLI.

- `[I assumed]` That `codex` is the correct launch command for Codex CLI on
  this machine. The actual command may differ by installation method.

- `[I assumed]` That copying the skill directory to `.agents/skills/` at the
  repo root is sufficient for Codex CLI to detect the skill without restarting.
  The docs indicate Codex detects changes automatically; this should be verified.
