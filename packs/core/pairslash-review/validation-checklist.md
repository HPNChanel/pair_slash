# pairslash-review -- Validation Checklist

## Structural

- [ ] `SKILL.md` exists with valid frontmatter
- [ ] `contract.md` exists
- [ ] `example-invocation.md` exists
- [ ] `example-output.md` exists
- [ ] Output section order is deterministic

## Contract quality

- [ ] Input contract requires review context
- [ ] Output contract enforces finding fields
- [ ] Failure contract handles missing diff and unreadable memory
- [ ] Memory contract declares read-only behavior
- [ ] Side-effect contract declares no writes

## Behavior

- [ ] If no findings, output explicitly says so
- [ ] Findings include concrete evidence
- [ ] No instruction mutates `.pairslash/project-memory/`

