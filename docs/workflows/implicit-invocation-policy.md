# Implicit invocation policy

Status: normative for `pack.manifest.yaml` authoring and lint.

## What this field is

Both supported runtimes can auto-select a skill when the user's task text
matches the skill description:

- Codex CLI may pick a skill whose description fits the current task.
- GitHub Copilot CLI can route prompts to skills by description.

`implicit_invocation` in `pack.manifest.yaml` declares the pack's activation
intent for that behavior:

```yaml
implicit_invocation: explicit-only # default when the field is absent
```

It is a **declaration of intent**, not a runtime control. PairSlash emits it as
metadata and enforces it in lint; runtimes make the actual routing call. Do not
document or claim that the field switches ambient activation on or off inside
the runtime.

## Enum

| Value               | Meaning                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `explicit-only`     | Default. The workflow should only run when the user selects it (`/skills`). |
| `implicit-allowed`  | Opt-in. The pack is considered safe for runtime auto-selection by description. |

`implicit-preferred` is intentionally not modeled: ambient activation is
either acceptable for a pack or it is not; PairSlash does not ask runtimes to
prefer a skill over others.

## Why the default is `explicit-only`

Fuzzy auto-triggering is hazardous for workflows that can mutate state.
Ambient activation must be opt-in, never ambient-by-default — this is the
charter automation boundary (CLAUDE.md §4.3).

## Lint rules

| Code             | Result  | Condition                                                                   |
| ---------------- | ------- | --------------------------------------------------------------------------- |
| `LINT-INVOKE-001` | error   | `workflow_class: write-authority` combined with `implicit_invocation != explicit-only`. Hard rule, no exceptions. |
| `LINT-INVOKE-002` | warning | `implicit-allowed` on a non-`read-oriented` pack (candidate-producing or mutating workflows need manual review). |
| `LINT-INVOKE-003` | warning | `implicit-allowed` with a missing or weak `SKILL.md` description (< 60 chars). Opt-in packs get *stricter* description hygiene, not looser. |

## Per-pack decisions (core packs)

All core packs currently declare `implicit_invocation: explicit-only`:

- `pairslash-memory-write-global` — write-authority; hard-forbidden from
  implicit opt-in by `LINT-INVOKE-001`.
- `pairslash-backend`, `pairslash-devops`, `pairslash-frontend`,
  `pairslash-release` — dual-mode candidate/mutation workflows; stay
  explicit-only unless a reviewed decision accepts ambient activation.
- `pairslash-plan`, `pairslash-review`, `pairslash-onboard-repo`,
  `pairslash-command-suggest`, `pairslash-memory-audit`,
  `pairslash-memory-candidate` — read-oriented; eligible for opt-in in
  principle, but each kept `explicit-only` until runtime routing behavior is
  verified per lane and the pack owner documents the opt-in reason.

## Emitted metadata

The compilers surface the declared value as metadata only:

- Codex bundle: `codex-metadata.yaml` → `implicit_invocation`.
- Copilot package: `package/package.json` → `implicit_invocation`.
- Emitted `SKILL.md` frontmatter: `metadata.implicit_invocation` (only when
  the source file does not already declare a `metadata` block).

None of these fields configure the runtime; they record intent for review,
doctor, and audit surfaces.
