---
"better-translation": minor
---

Add safe rich text to React and Svelte T markers. Supported inline elements and arbitrary source-owned components keep their
authored props and behavior while translated Messages can reorder their numbered sibling slots without rendering arbitrary
HTML.

Harden Vite-plugin lookup-id and option analysis, persist local translation progress in configurable plugin-sized batches,
serialize dev translation and remote Manifest sync, protect malformed local Runtime bundles from destructive rewrites, and keep
Message validation and context-setting helpers private to the runtime implementation.

Make Svelte Rich-text Message analysis near-linear by indexing source edits and walking its AST once, without retaining
duplicated placeholder expressions in transformed source. Treat reordered equivalent file Messages as an unchanged Manifest
contribution. Add statistically sampled source-analysis benchmarks and scaling guards for giant files, project-shaped
TypeScript and Svelte analysis, incremental Manifest updates, Message templates, and cached source edits.

Apply completed local development translations to React and Svelte providers through Vite HMR so authored fallbacks switch to
their active Locale values without a page reload or component-state loss.

Document the published API through generated declaration JSDoc, keep transform-only component props out of author-facing
types, move `RuntimeMessages` to the generated-messages entrypoint, and remove implementation-only Manifest and Svelte
context types from package entrypoints.
