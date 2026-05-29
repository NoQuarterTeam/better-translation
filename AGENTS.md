# AGENTS.md

## Project Shape

Better Translation is a developer tool for adding AI-assisted translations to Vite apps.

Developers install the package, add the Vite plugin, mark UI copy in their code, and let the plugin extract messages into locale files. The package also includes runtime helpers for loading and rendering those translated messages in React and server code.

The long-term goal is a hosted service where Projects sync extracted Messages to Translation Branches, edit branch-local Locale values in a UI, and serve Runtime bundles. For now, the repo still supports a local bundle-first workflow.

## Repo Shape

- `packages/better-translation`: the published package. This contains the Vite plugin, extractor, AI translation helper, cache logic, React helpers, and server helpers.
- `apps/web`: the hosted app/service scaffold and current local example surface.
- `CONTEXT.md`: canonical product vocabulary. Keep it glossary-only.
- `docs/platform.md`: current implementation reality and intended hosted-service behavior.
- `tooling`: shared repo tooling such as TypeScript config.

## How To Work

- Read `CONTEXT.md` before naming product concepts. Preserve its terms exactly.
- Read `docs/platform.md` before changing plugin sync, runtime loading, branch behavior, or hosted-service behavior.
- Inspect the current code before assuming the hosted-service direction is implemented.
- Keep `CONTEXT.md` free of implementation details, roadmap notes, and design decisions.
- Put product/platform behavior in `docs/platform.md` unless it is better captured as an ADR.

## Coding Guidance

- Use Bun for repo commands. The repo declares `bun@1.3.13` and Node `>=24`.
- Prefer existing package boundaries over adding new cross-cutting abstractions.
- Keep `packages/better-translation` focused on the library/plugin surface.
- Keep hosted-service behavior in the app/service layer unless it truly belongs in the published package.
- Preserve the separation between manifest metadata and runtime bundles.
- Runtime bundles should remain flat `id -> translated string` JSON objects.
- Runtime bundles must not include editor metadata, source locations, or Manifest details.
- When changing translation behavior, check both extraction-time behavior and runtime loading behavior.
- When changing local artifact behavior, verify both dev regeneration and production build checks.
- When adding hosted behavior, keep local bundle-first behavior working until the replacement path is implemented end to end.

## Useful Commands

```bash
bun run check
bun run build:packages
bun --filter better-translation build
```

## Before Making Changes

Read `CONTEXT.md` for product terminology and `docs/platform.md` for product direction. If docs and code disagree, treat the code as current implementation reality and update docs only when the product decision is settled.
