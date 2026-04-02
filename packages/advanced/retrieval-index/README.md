# retrieval-index

Design-only scaffold for optional Retrieval Lane indexing.

Intended responsibility:

- build or refresh explicit local indexes for declared retrieval sources
- store cache outside core install roots and outside project memory
- expose provenance and staleness metadata for every index

Explicitly out of scope:

- mandatory indexing for core workflows
- hidden cache writes into core PairSlash state
- authority over project truth
