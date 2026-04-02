# retrieval-skill

Design-only scaffold for an opt-in `/skills` Retrieval Lane entrypoint.

Intended responsibility:

- load normal authoritative context first
- run explicit retrieval only when the user opts in
- present retrieved evidence as a labeled supplemental section

Explicitly out of scope:

- replacing `/skills` with a new front door
- changing memory load order
- silent retrieval on behalf of unrelated core workflows
