# AGENTS.md

## Project

Better Translation is a developer tool for adding AI-assisted translations to Vite apps.

Developers install the package, add the Vite plugin, mark UI copy in their code, and let the plugin extract messages into locale files. The package also includes runtime helpers for loading and rendering those translated messages in React and server code.

The long-term goal is a hosted service where projects can sync extracted messages, edit translations in a UI, publish releases, and serve runtime locale bundles. For now, the repo still supports a local bundle-first workflow.

## Repo Shape

- `packages/better-translation`: the published package. This contains the Vite plugin, extractor, AI translation helper, cache logic, React helpers, and server helpers.
- `apps/web`: the hosted app/service scaffold and current local example surface.
- `docs/context.md`: product context, terminology, current local behavior, and the intended hosted-service direction.
- `tooling`: shared repo tooling such as TypeScript config.

## Core Concepts

- Consumer app: an app that uses the Vite plugin and loads translated messages at runtime.
- Vite plugin: scans source files for translation markers, generates stable message ids, and writes locale artifacts.
- Manifest: the extracted catalog of messages from source code. It is source metadata, not the runtime payload.
- Locale values: translated strings keyed by message id for a locale.
- Runtime bundle: the JSON payload loaded by an app at runtime. It should stay a flat `id -> translated string` object.
- Default locale: the source language for copy, currently `en`.
- Hosted service: the future remote source of truth for translation drafts, published releases, channels, and runtime bundles.

## Current Behavior

Today, the practical workflow is local:

1. A Vite app configures `betterTranslation()` with locales, a default locale, storage, and optionally a `translate()` function.
2. The plugin scans configured source roots for markers like `t("...")` and `<T>...</T>`.
3. It generates stable message ids and writes local artifacts.
4. Missing non-default translations can be filled by a custom async translator, including the built-in AI helper.
5. Runtime code loads local bundled JSON files.

Do not assume the hosted service is complete unless the code shows it is. Treat remote storage, sync, editing, publishing, and runtime fetching as the direction of travel unless implemented.

## Product Direction

The hosted v1 should make the remote service canonical:

- plugin sync uploads manifests and optional seed locale values to an existing project
- hosted UI stores and edits draft translations
- publishing creates immutable locale bundle releases
- channels such as `production` and `preview` point to releases
- consumer apps fetch flat public runtime bundles by project, channel, and locale
- generated local snapshots are only fallbacks, not the source of truth

Project creation should be explicit. Plugin sync should fail clearly if a remote project does not exist.

## Development Notes

- Use Bun for repo commands. The repo declares `bun@1.3.13` and Node `>=24`.
- Prefer existing package boundaries over adding new cross-cutting abstractions.
- Keep `packages/better-translation` focused on the library/plugin surface.
- Keep hosted-service behavior in the app/service layer unless it truly belongs in the published package.
- Preserve the separation between manifest metadata and runtime bundles.
- Runtime bundles should not include editor-only metadata, source locations, or manifest details.
- When changing translation behavior, check both extraction-time behavior and runtime loading behavior.

## Useful Commands

```bash
bun run check
bun run build:packages
bun --filter better-translation build
```

## Before Making Changes

Read `docs/context.md` for the latest product terminology and locked decisions. If the README and context disagree, prefer `docs/context.md` for product direction and inspect the code for current implementation reality.
