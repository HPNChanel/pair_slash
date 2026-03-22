# pairslash-memory-write-global -- Phase Boundary

What Phase 0 simulates via LLM instruction-following vs what Phase 2
hardens with deterministic code.

This document exists to prevent Phase 0 from pretending it has production-grade
guarantees, and to give Phase 2 a clear scope of work.

---

## Phase 0: instruction-simulated

Every pipeline step is executed by the LLM following SKILL.md instructions.
The LLM reads the steps, uses its tools (file read, file write), and reports
results in conversation. There is no deterministic enforcement.

| Capability | How it works in Phase 0 | Known weakness |
|------------|------------------------|----------------|
| Input validation | LLM checks fields per Step 1-2 instructions | LLM may accept incomplete input if instructions are ambiguous |
| Duplicate detection | LLM reads YAML files in `project-memory/`, compares `kind`+`title` | LLM may miss duplicates in large file sets or multi-doc YAML |
| Conflict detection | LLM compares statements in same scope | Semantic contradiction is subjective; LLM judgment varies |
| Scope validation | LLM checks whether `scope_detail` is present when needed | May not catch all scope-shadowing cases |
| Preview patch generation | LLM formats YAML and shows it in conversation | YAML may have subtle formatting issues (indentation, quoting) |
| Acceptance gate | LLM asks "yes/no" and waits for response | LLM may interpret ambiguous responses as acceptance |
| File write | LLM uses file-write tool to create/append YAML | LLM may produce malformed YAML; no post-write validation |
| Index update | LLM appends entry to `90-memory-index.yaml` | LLM may format the entry inconsistently |
| Audit log | LLM creates file in `audit-log/` | LLM may skip on partial failure; no guaranteed append |
| Slug generation | LLM applies "lowercase, hyphens, truncate to 60" rule | May produce slightly different slugs for edge cases |
| File routing | LLM follows the routing table (decision->60, pattern->70, etc.) | May misroute if kind value is misspelled or ambiguous |

**Phase 0 acceptance bar:**
The LLM must produce a preview patch and wait for confirmation **at least 8 out
of 10 invocations**. This is a behavioral bar, not a deterministic guarantee.

---

## Phase 2: code-hardened

Phase 2 replaces instruction-dependent behavior with deterministic scripts and
hooks. The LLM still orchestrates the workflow, but critical safety checks are
enforced by code that does not depend on LLM compliance.

| Capability | Phase 2 implementation | What it replaces |
|------------|----------------------|------------------|
| Input validation | JSON Schema validation script in `scripts/validate-input.py` | LLM field-checking (Step 1-2) |
| Duplicate detection | Script scans all YAML in `project-memory/`, indexes `kind`+`title` | LLM manual file reading (Step 3-4) |
| YAML lint | Post-write YAML lint (`yamllint` or equivalent) | Trust in LLM YAML formatting |
| Schema conformance | Post-write JSON Schema check on the written file | Trust in LLM record completeness |
| Audit log | Deterministic script appends audit entry | LLM-generated audit file (Step 11) |
| Index rebuild | Script regenerates `90-memory-index.yaml` from files | LLM manual index append (Step 10) |
| Pre-write hook | Hook checks for a preview-acceptance token before allowing write | LLM behavioral compliance (Step 7-8) |
| Post-write hook | Hook validates written record against schema | No post-write check in Phase 0 |
| Slug generation | Deterministic function in script | LLM text manipulation |

---

## What does NOT change between phases

These invariants hold in every phase:

- The 11-step pipeline order is fixed.
- Preview before write is mandatory.
- Explicit user acceptance is mandatory.
- Duplicate and conflict detection must happen before preview.
- Audit log must be written (even on rejection).
- No other workflow may write to `project-memory/` as a side effect.
- The memory record schema defines the canonical field set.
- The file routing rules (kind -> target path) are fixed.

---

## Migration path: Phase 0 to Phase 2

1. **Add `scripts/validate-input.py`** -- reads proposed record, validates against
   `memory-record.schema.yaml`, exits non-zero on failure. SKILL.md Step 2 calls
   this script instead of relying on LLM field-checking.

2. **Add `scripts/detect-duplicates.py`** -- scans `project-memory/` YAML files,
   checks `kind`+`title` collision, outputs matches. SKILL.md Step 4 calls this
   instead of relying on LLM manual comparison.

3. **Add `scripts/write-audit.py`** -- deterministic audit log writer. SKILL.md
   Step 11 calls this instead of LLM file creation.

4. **Add `scripts/rebuild-index.py`** -- regenerates `90-memory-index.yaml` from
   all YAML files in `project-memory/`. Can be run as a doctor/repair tool.

5. **Add pre-write hook** -- the hook verifies that a preview was shown and
   accepted before any write to `project-memory/` proceeds. This is the hardened
   replacement for the "LLM must show preview before writing" instruction.

6. **Add post-write hook** -- after a file is written to `project-memory/`, the
   hook runs `yamllint` + JSON Schema validation. If the record is malformed,
   the hook reverts the write and reports the error.

Each script is small, single-purpose, and testable independently of the LLM.
The SKILL.md is updated to call scripts at the appropriate steps, but the
pipeline structure and safety rules do not change.
