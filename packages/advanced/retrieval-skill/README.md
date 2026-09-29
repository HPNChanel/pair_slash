# retrieval-skill

Package slot for the opt-in `/skills` Retrieval Lane entrypoint.

The canonical skill descriptor lives in `packs/advanced/retrieval/SKILL.md`
and is installed — together with the `pairslash.addon.yaml` descriptor —
only via the explicit lane `pairslash install --packs pairslash-retrieval-addon`.
It never ships through default discovery, `--pack-set`, or `--all`.

Responsibilities of the lane:

- load normal authoritative context first
- run explicit retrieval only when the user opts in (`retrieval_enabled`)
- present retrieved evidence as a labeled supplemental section
  (`label: retrieved`, `authoritative: false`, `truth_tier: supplemental`)

Explicitly out of scope:

- replacing `/skills` with a new front door
- changing memory load order
- silent retrieval on behalf of unrelated core workflows
- writes to authoritative memory or implicit promotion of retrieved facts
