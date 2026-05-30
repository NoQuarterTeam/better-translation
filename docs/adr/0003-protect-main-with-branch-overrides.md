# Protect main with Branch overrides

Feature Translation Branch values must not overwrite `main` automatically. A Branch override stores a branch-specific Locale value together with the parent value hash it was based on, so future reconciliation can detect whether `main`, the feature branch, or both changed after branching.

This protects manual edits on `main` from older AI-generated or imported values on a feature branch. Applying a feature branch override to `main` should be an explicit dashboard action or a future conflict-aware reconciliation flow, not a side effect of Git merge or build sync.
