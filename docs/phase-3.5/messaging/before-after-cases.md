# PairSlash Before / After Cases

Use these cases to show what changes when someone moves from raw terminal AI
usage to PairSlash.

## Case 1: Repo Re-entry After a Context Switch

### Before: Raw CLI

The user reopens a repo after a few days away, asks for a summary, then spends
the next several minutes re-reading files and sanity-checking whether the model
invented or missed anything important. The output sounds helpful, but the user
still does not trust it enough to act on it.

### After: PairSlash

The user starts from `/skills` and runs `pairslash-onboard-repo`. Instead of a
generic repo recap, they get the facts that matter first, the important
constraints, and a cleaner next step.

### What Changed

- Trust: facts and assumptions are separated, so the user knows what still
  needs verification.
- Context: repo orientation becomes faster and more correct than starting from
  scratch.
- Repeatability: the user has a standard re-entry path instead of a new prompt
  ritual every time.

## Case 2: Repeating a Workflow Without Repeating the Same Mistakes

### Before: Raw CLI

The user has a review or fix task they do often. They copy an old prompt,
rerun the flow, then spend time correcting the same almost-right mistakes and
double-checking side effects. The workflow is familiar, but it is not safe
enough to trust by default.

### After: PairSlash

The user starts from `/skills` and runs the review/fix loop. PairSlash grounds
the review in repo context, surfaces what is actually wrong, and keeps the fix
step explicit instead of hiding it behind an autonomous jump.

### What Changed

- Trust: the workflow stays inspectable and does not ask the user to trust
  hidden behavior.
- Context: review output is tied back to the repo instead of sounding like a
  generic coding critique.
- Repeatability: the user can reuse the workflow without reusing the same
  cleanup burden.

## Case 3: Turning Project Memory Into Durable Truth Instead of Chat Debris

### Before: Raw CLI

Important project decisions end up scattered across chat history, markdown
scratch files, and personal memory. When the user comes back later, they cannot
tell which version is real, which note was speculative, or what should become
durable project truth.

### After: PairSlash

The user moves a real finding through `pairslash-memory-candidate` and then
`pairslash-memory-write-global`. Only evidence-backed claims make it forward,
the durable change is previewed before write, and the user explicitly accepts
it before it becomes project memory.

### What Changed

- Trust: there are no hidden durable writes and weak claims do not get a free
  pass.
- Context: project truth survives the next session in a disciplined form the
  user can actually consult.
- Repeatability: memory becomes a workflow habit, not a pile of stale notes.
