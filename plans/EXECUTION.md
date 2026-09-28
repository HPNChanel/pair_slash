# PairSlash Plan Execution Protocol

**Status:** Binding process spec for all work under `plans/`
**Applies to:** Every task file under `plans/tasks/`, every track file under `plans/tracks/`, and every executor (human or agent).

---

## 1. Units of work

- **Track** (`plans/tracks/TN-*.md`): a coherent phase with a goal, entry/exit gates, and an ordered task list. Tracks are sub-plans, not code.
- **Task** (`plans/tasks/TN/TN-NN-*.md`): one self-contained unit sized for **a single agent/maintainer session** — expected to land as at most a small number of commits (ideally one).
- **Inventory item** (`plans/FEATURE-INVENTORY.md`): a discovered ecosystem capability, triaged to `adopt`, `defer`, or `reject`. Adoption routes into a task.

## 2. Task lifecycle

```
todo → in_progress → done
                 ↘ blocked (with escalation note) ↗ back to todo
```

Rules:

1. **Claim:** Before starting, set the task frontmatter `status: in_progress` and fill `claimed_by`/`claimed_at`. Never start a task whose `depends_on` list contains non-`done` tasks.
2. **Implement:** Follow the task's ordered Work steps. Touch only files under "Files to touch". Obey `plans/CONSTRAINTS.md` plus the task's own Constraints section.
3. **Gate:** Run every checkbox under "Acceptance gates". All must pass in the same working tree.
4. **Record:** Produce the artifacts under "Evidence to record" and set `status: done` with `completed_at` + `evidence` fields.
5. **Commit:** One task = preferably one commit, `type(scope): summary` per `AGENTS.md` commit convention. If the task needs multiple commits, each commit must independently keep gates green.

## 3. Ordering rules

- **T0 is a hard prerequisite for everything.** No other task may be `in_progress` while T0 tasks remain `todo`.
- Within a track, respect `depends_on`. Across tracks, respect the sequencing map in `MASTER.md` §6.
- Gated tracks (T7, T8) may not begin before their gate conditions in the track file are met — even if their tasks look ready.
- Parallel work across tracks is allowed only when the touched file sets are disjoint.

## 4. What "done" means for a task

A task is `done` only when ALL of the following hold:

- [ ] Every Work step is complete.
- [ ] Every Acceptance gate checkbox passes in the working tree.
- [ ] Every Constraint (global + local) is satisfied — a violation discovered later reverts the task to `todo` plus a regression task.
- [ ] Evidence artifacts exist at the stated paths.
- [ ] Frontmatter updated (`status`, `completed_at`, `evidence`).
- [ ] Commit(s) landed with conventional messages.

## 5. What "blocked" means

Set `status: blocked` and fill `blocked_reason` when:

- A dependency is missing (e.g., needs a human-only action like live runtime capture or secret provisioning).
- Executing the task would force a CONSTRAINTS.md violation (per X2 — stop, don't improvise).
- External evidence contradicts the task premise (e.g., a runtime feature doesn't exist as documented).

A blocked task MUST include: what was tried, the exact blocker, and the decision needed. Never silently drop a task.

## 6. Truth-layer sync duty

Any task that changes runtime pins, lane status, workflow maturity, pack manifests, or release posture MUST in the same change:

1. Update the source-of-truth file (`runtime-surface-matrix.yaml`, pack manifests, verdict docs).
2. Regenerate downstream renderings (`compatibility-matrix.md` via `npm run sync:compat-lab`, `registry/packs.yaml` if derived, `90-memory-index.yaml` if memory records change).
3. Re-run `npm run sync:compat-lab -- --check` and the truth-governance tests.

## 7. Adding new tasks

- New tasks discovered mid-execution are added under the correct track with the next free `NN` number; do not renumber existing tasks.
- The new task must declare `depends_on` and the same frontmatter shape.
- Add a one-line pointer to the task in its track file's task list.

## 8. Commit convention

```
fix(trace): restore typecheck green after strict-prep WIP
feat(t2): add agent-skills-spec validator to lint-bridge
docs(t1): refresh runtime-surface-matrix for codex 0.157 / copilot 1.0.88
```

Scope tags match the track id (`t0`…`t10`) or the package name — pick one convention per commit and stay consistent within a task.

## 9. Evidence & audit expectations

- Durable evidence lives in repo-visible places: updated YAML/MD truth files, `docs/evidence/**`, test goldens, or `.pairslash/audit-log/` entries where the change is memory-related.
- Maintainer-local artifacts (raw benchmark logs, signing artifacts) stay under maintainer-local paths; public files record only the policy-permitted granularity.
- `status: done` without evidence is not done.

## 10. Executor checklist (copy into session notes)

```
[ ] Read CONSTRAINTS.md fully.
[ ] Read the track file for context and gates.
[ ] Read the task file fully, including "do not touch" list.
[ ] Verify all depends_on tasks are done.
[ ] Set status: in_progress.
[ ] Implement within declared file scope.
[ ] Run every acceptance gate; all green.
[ ] Produce evidence artifacts.
[ ] Set status: done with completed_at + evidence.
[ ] Commit per §8.
```
