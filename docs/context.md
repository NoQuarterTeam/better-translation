# Better Translate Context

This document defines the domain language we have established so far for `better-translate`, including the current local setup and the planned hosted setup.

## Purpose

This repo is evolving toward three distinct roles that live in the same monorepo for now:

- `packages/vite`: the published Vite plugin.
- hosted app/service: receives manifest syncs, stores translations, provides the editor UI, and serves runtime locale bundles.
- example consumer app: behaves like a downstream app using the plugin and hosted runtime bundles.

The important boundary is that the hosted app/service should not also be treated as the only realistic consumer app. We want a separate consumer surface that simulates how an adopter would actually use the product.

## Core Terms

### Consumer app

An application that uses the Vite plugin and consumes translated locale bundles at runtime.

### Hosted service

The remote backend that stores translation data, exposes the translation UI, and serves published locale bundles.

### Project

A logical app/account within the hosted service. Plugin sync and runtime bundle reads both happen in the context of a project.

### Manifest

The extracted source-of-truth catalog of messages discovered in source code. Each manifest entry includes:

- `id`
- `defaultMessage`
- `meta`
- `placeholders`
- `sources`

The manifest describes what messages exist in the codebase. It is not the runtime payload.

### Default locale

The source locale for the app, currently `en`.

### Locale values

The translated values for a given locale keyed by message id.

### Runtime bundle

The plain JSON payload that a consumer app loads at runtime. We have agreed this should be a flat object:

```json
{
  "message.id": "Translated string"
}
```

Runtime bundles should not contain editor metadata or source information.

### Draft translation

A translation stored in the hosted service that has been edited but not yet published.

### Published release

An immutable snapshot of locale bundles created from hosted data. Consumer apps should load published releases, not drafts.

### Channel

A stable name like `production` or `preview` that points to a specific immutable published release. Consumer apps read by channel; the hosted service resolves the channel to a release.

### Snapshot fallback

A generated local copy of published locale bundles used only for local development and outage fallback. Snapshots are not a second source of truth.

### Orphaned message

A message id that previously existed in the manifest but no longer appears in source. Orphaned messages are kept for history, but excluded from new releases by default.

## Current Local Setup

Today the app is still operating in local mode.

### Plugin behavior

The plugin is configured in `apps/web/vite.config.ts` with local storage:

- locales: `en`, `nl`, `fr`, `es`
- default locale: `en`
- storage: `src/lib/bt`

In local mode, the plugin scans source files and generates artifacts under `apps/web/src/lib/bt`, including:

- `manifest.json` for extracted source messages
- `locales/*.json` for locale values
- `load-messages.ts` for runtime loading
- `runtime.json` for generated runtime metadata

### Runtime loading today

Today the app does not fetch translations from a server at runtime.

- `apps/web/src/lib/bt/load-messages.ts` statically imports local JSON files.
- `apps/web/src/routes/__root.tsx` loads messages in `beforeLoad`.
- `apps/web/src/routes/-locale.ts` resolves the active locale from the `locale` cookie.

This means the current runtime model is bundle-local, not remote.

## Target Hosted Setup

The direction we have agreed on is remote-canonical hosted translation.

### Source of truth

The hosted service becomes the canonical source of locale data after sync and editing. Local locale files are no longer the source of truth.

### Plugin sync model

The plugin should:

- auto-sync manifest changes during dev/build
- authenticate with a project-scoped write token
- fail clearly if the remote project does not already exist
- upload existing local locale values as seed translations on first adoption
- only fill blanks from local seed data and never overwrite hosted edits automatically

### Hosted editing model

The hosted service should:

- store manifest entries and locale drafts
- let authorized users edit translations in a UI
- publish immutable releases
- move channels to new releases when publishing

### Runtime model

Consumer apps should fetch plain JSON runtime bundles from a public read endpoint. The current agreed URL shape is:

`/api/runtime/:project/:channel/:locale.json`

Those bundles should contain only flat message values, not manifest metadata.

### Fallback model

Fallback snapshots should:

- be generated from published releases only
- exist for local dev and outage scenarios
- not be treated as canonical data

Our current default assumption is that these fallback artifacts are not committed to git unless deployment constraints later require that.

## Local vs Hosted

### Local mode

Local mode means the plugin writes locale artifacts into the app itself and runtime loading happens from generated local files.

This is how the repo works today.

### Hosted mode

Hosted mode means:

- the plugin syncs manifests and optional seed locale values to the hosted service
- translators edit data remotely
- releases are published remotely
- consumer apps load published locale bundles from the hosted service
- local files exist only as generated fallback snapshots when needed

## Decisions We Have Already Locked

- Remote data is canonical.
- Runtime bundles are plain JSON maps of `id -> translated string`.
- Published locale bundles are publicly readable.
- Sync, edit, and publish APIs are authenticated.
- Consumer apps read stable channels that point to immutable releases.
- The hosted app/service, plugin, and example consumer app should all live in this monorepo for v1.
- Project creation is explicit; plugin sync should fail clearly rather than auto-provisioning.
- Existing local locale values can seed remote translations, but only into blank hosted fields.
- Removed message ids become orphaned instead of being hard-deleted.

## Still Open

One behavior that was not fully locked yet: how the runtime should handle missing keys in an otherwise published non-default locale bundle.
