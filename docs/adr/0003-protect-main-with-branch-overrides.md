# Protect default Branch with Branch overrides

Feature Branch values must not overwrite the Project default Branch automatically. A Branch override stores a branch-specific Locale value together with the base value hash it was based on, so future reconciliation can detect whether the default Branch, the feature Branch, or both changed after branching.

This protects manual edits on the Project default Branch from older AI-generated or imported values on a feature Branch. Applying a feature Branch override to the Project default Branch should be an explicit dashboard action or a future conflict-aware reconciliation flow, not a side effect of Git merge or build sync.
