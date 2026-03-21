# PairSlash Phase 0 -- Runtime Verification Guide

Step-by-step instructions for verifying the Phase 0 Compatibility Spike
on a real Codex CLI or GitHub Copilot CLI session.

Complete this guide to fill in the `untested` gates in
`phase-0/compatibility/acceptance-gates.yaml` and the `unverified` items in
`phase-0/compatibility/runtime-surface-matrix.yaml`.

**Prerequisite:** Run all steps from the repository root.

---

## Environment setup

### Check your OS and note paths

| OS | User home | Shell |
|----|-----------|-------|
| macOS | `/Users/<username>` | `zsh` or `bash` |
| Linux | `/home/<username>` | `bash` or `sh` |
| Windows | `C:\Users\<username>` | PowerShell or cmd |

All path examples below use POSIX notation. For Windows PowerShell:
- Replace `/` with `\`
- Replace `~/` with `$env:USERPROFILE\`
- Replace `mkdir -p` with `New-Item -ItemType Directory -Force -Path`
- Replace `cp -r` with `Copy-Item -Recurse`
- Replace `ls` with `Get-ChildItem`

### Confirm the .pairslash/ structure exists

```bash
ls .pairslash/project-memory/
```

Expected output includes: `00-project-charter.yaml`, `10-stack-profile.yaml`,
`90-memory-index.yaml`.

If missing, check that you are in the repository root.

---

## Section 1: Codex CLI

### 1.0 -- Confirm Codex CLI is installed

```bash
codex --version
# or
codex version
```

Record the version. Note the exact launch command your installation uses.

### 1.1 -- Install pairslash-plan (V1, G1)

```bash
mkdir -p .agents/skills
cp -r phase-0/skills/pairslash-plan .agents/skills/
ls .agents/skills/pairslash-plan/SKILL.md
```

**Windows PowerShell:**
```powershell
New-Item -ItemType Directory -Force -Path .agents\skills
Copy-Item -Recurse phase-0\skills\pairslash-plan .agents\skills\
Get-Item .agents\skills\pairslash-plan\SKILL.md
```

### 1.2 -- Install pairslash-memory-write-global (G2)

```bash
cp -r phase-0/skills/pairslash-memory-write-global .agents/skills/
ls .agents/skills/pairslash-memory-write-global/SKILL.md
```

### 1.3 -- Test /skills picker (V1)

Launch Codex CLI from the repository root, then:

```
> /skills
```

**Observe:** Does a skill picker or list appear?
- If yes: record `/skills` as working in Codex CLI (V1 = verified)
- If no: record `/skills` as absent in Codex CLI (V1 = not available; use direct invocation)

### 1.4 -- Test direct invocation of pairslash-plan (V4, G1)

In the Codex CLI session:

```
> $pairslash-plan Add rate limiting to the API gateway.
```

**Observe:**
- Does the skill activate? (G1 pass if yes)
- Does output contain all 9 sections? (G4 verification)
- Does the output cite `.pairslash/project-memory/` files? (G3 verification)

### 1.5 -- Test pairslash-plan reads project memory (V2, G3)

With the skill invoked, check the output for any of:
- "from memory: 00-project-charter.yaml"
- "from memory: 10-stack-profile.yaml"
- Content from the actual charter or stack profile

**Observe:**
- If cited: V2 = verified for Codex, G3 = pass
- If not cited: V2 = failed for Codex; note as risk R3

### 1.6 -- Verify pairslash-plan does not write (G10)

After any invocation of pairslash-plan, check:

```bash
git status
ls .pairslash/project-memory/
```

**Pass:** No new files in `.pairslash/project-memory/`. No changes in `git status`.

### 1.7 -- Test pairslash-memory-write-global preview patch (V3, G5)

In the Codex CLI session:

```
> $pairslash-memory-write-global

  kind: constraint
  title: No external deps without review
  statement: Any new external dependency must be reviewed by two maintainers.
  evidence: Team agreement sprint retrospective 2026-03-18.
  scope: whole-project
  confidence: high
  action: append
```

**Observe:**
- Does a preview patch appear before any file is written? (G5)
- Is the preview in the documented format (`--- preview patch ---` / `--- end preview ---`)?
- Do any files appear in `.pairslash/project-memory/` before you say "yes"?

If preview appears and no premature write: V3 = verified, G5 = pass.

### 1.8 -- Test acceptance gate (G6)

When the preview patch appears, say:

```
> no
```

**Observe:**
- Does the workflow stop without writing any file?
- Check: `ls .pairslash/project-memory/` -- no new constraint file should exist
- Check: `ls .pairslash/audit-log/` -- a rejection entry may appear (G13 SHOULD gate)

Pass: no write to `project-memory/`. G6 = pass.

### 1.9 -- Test successful write (G7, G13)

Repeat 1.7 and this time say "yes".

**Observe:**
- Does a new YAML file appear in `.pairslash/project-memory/50-constraints.yaml`
  or `50-constraints.yaml`?
- Read the file and verify all 11 fields are present:
  kind, title, statement, evidence, scope, confidence, action, tags, source_refs,
  updated_by, timestamp
- Does `.pairslash/audit-log/` contain a new file? (G13 SHOULD)

G7 pass: all 11 fields present with non-empty values.

---

## Section 2: GitHub Copilot CLI

### 2.0 -- Confirm Copilot CLI is installed

```bash
gh copilot --version
# or the documented launch command for your installation
```

### 2.1 -- Install skills

```bash
mkdir -p .github/skills
cp -r phase-0/skills/pairslash-plan .github/skills/
cp -r phase-0/skills/pairslash-memory-write-global .github/skills/
ls .github/skills/pairslash-plan/SKILL.md
ls .github/skills/pairslash-memory-write-global/SKILL.md
```

**Windows:**
```powershell
New-Item -ItemType Directory -Force -Path .github\skills
Copy-Item -Recurse phase-0\skills\pairslash-plan .github\skills\
Copy-Item -Recurse phase-0\skills\pairslash-memory-write-global .github\skills\
```

### 2.2 -- List skills (G1, G2)

In the Copilot CLI interactive session:

```
> /skills list
```

**Observe:**
- Does `pairslash-plan` appear? (G1 for Copilot)
- Does `pairslash-memory-write-global` appear? (G2 for Copilot)

### 2.3 -- Test /skills reload (V7)

If you installed skills during an active session, test:

```
> /skills reload
> /skills list
```

**Observe:** Do newly installed skills appear after reload without restarting?
- Yes: V7 = verified
- No: V7 = not working; must restart session

### 2.4 -- Test pairslash-plan (V5, G3, G4)

In the Copilot CLI interactive session:

```
> Use the /pairslash-plan skill to plan: Add rate limiting to the API gateway.
```

**Observe:**
- Does the skill activate? (G1/G2 already confirmed via list)
- Does output contain all 9 sections? (G4)
- Does output cite `.pairslash/project-memory/` files? (G3, V2 for Copilot)

### 2.5 -- Test write workflow (G5, G6, G7)

Follow the same sequence as Codex CLI steps 1.7-1.9 but use:

```
> Use the /pairslash-memory-write-global skill to record: [input]
```

Results map to the same gates (G5, G6, G7).

---

## Section 3: Record your results

After testing, update these two files:

### 3.1 -- Update runtime-surface-matrix.yaml

For each item you tested, change `status: unverified` to one of:
- `status: verified` (tested and confirmed)
- `status: not-available` (tested and the capability does not exist)
- `status: failed` (tested and it does not work as expected)

Add `tested_date` and `tested_by` fields with your name and the date.

### 3.2 -- Update acceptance-gates.yaml

For each gate tested, change `status: untested` to `pass` or `fail`.
Add an `evidence` field describing what you observed.

### 3.3 -- Record any failures

If a MUST gate (G1-G10) fails:

1. Note the exact behavior observed.
2. Note whether the fallback applies (e.g., if G1 fails on Codex CLI,
   does direct invocation via `$pairslash-plan` still work?).
3. Open a new task before declaring Phase 0 complete.
