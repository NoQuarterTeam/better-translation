# AGENTS.md

## Project Shape

Better Translation is a developer tool for adding AI-assisted translations to Vite apps.

Developers install the package, add the Vite plugin, mark UI copy in their code, and let the plugin discover Messages and
produce Locale values. The package also includes runtime helpers for loading and rendering those Messages in React, Svelte,
and server code.

The long-term goal is a hosted service where Projects sync extracted Messages to Branches, edit branch-local Locale values in a UI, and serve Runtime bundles. For now, the repo still supports a local bundle-first workflow.

## Repo Shape

- `packages/better-translation`: the published package. This contains the Vite plugin, source analysis, AI translation
  helper, cache logic, and React, Svelte, and server runtime helpers.
- `apps/web`: the hosted app/service scaffold and current local example surface.
- `CONTEXT.md`: canonical product vocabulary. Keep it glossary-only.
- `docs/platform.md`: current implementation reality and intended hosted-service behavior.
- `tooling`: shared repo tooling such as TypeScript config.

## How To Work

- Read `CONTEXT.md` before naming product concepts. Preserve its terms exactly.
- Read `docs/platform.md` before changing plugin sync, runtime loading, branch behavior, or hosted-service behavior.
- Inspect the current code before assuming the hosted-service direction is implemented.
- Preserve changes you did not make. The user often edits files at the same time, so do not revert or overwrite unrelated work unless you are sure it is accidental and blocking the task.
- Keep `CONTEXT.md` free of implementation details, roadmap notes, and design decisions.
- Put product/platform behavior in `docs/platform.md` unless it is better captured as an ADR.

## Coding Guidance

- Use Bun for repo commands.
- Prefer existing package boundaries over adding new cross-cutting abstractions.
- Keep `packages/better-translation` focused on the library/plugin surface.
- Keep hosted-service behavior in the app/service layer unless it truly belongs in the published package.
- Preserve the separation between manifest metadata and runtime bundles.
- Runtime bundles should remain flat `lookup id -> translated string` JSON objects.
- Runtime bundles must not include editor metadata, source ownership metadata, or Manifest details.
- Give every published package export and Consumer-app configuration type purpose-led JSDoc that explains its contract,
  important defaults, and safety behavior where relevant. Keep internal comments for non-obvious invariants and design
  reasons rather than narrating implementation.
- Use the canonical terms from `CONTEXT.md` in public JSDoc, source comments, errors, and adopter documentation.
- When changing translation behavior, check both source-analysis behavior and runtime-loading behavior.
- Every bug fix in `packages/better-translation` must include a regression test that fails against the pre-fix behavior
  and passes with the fix. Put it in the closest logical test file; cover both TypeScript/React and Svelte when they
  share the affected contract, and cover both source analysis and runtime rendering when the bug crosses that boundary.
- When changing local artifact behavior, verify both dev regeneration and production build checks.
- When adding hosted behavior, keep local bundle-first behavior working until the replacement path is implemented end to end.

## Useful Commands

```bash
bun run check
bun --filter better-translation build
```

## Before Making Changes

Read `CONTEXT.md` for product terminology and `docs/platform.md` for product direction. If docs and code disagree, treat the code as current implementation reality and update docs only when the product decision is settled.

## Agent Code verification

- Make sure to install packages with Bun, especially if making changes to the workspace packages
- We use vite-plus as the workspace tooling
- For routine code changes, verify with the root package scripts only: `bun run format`, `bun run lint`, and `bun run check`
- Do not run `bun --cwd apps/web build` for ordinary app UI, route, layout, route-tree, type, or refactor changes. `bun run check` is enough for those.
- Only run `bun --cwd apps/web build` when the user explicitly asks for a build, when changing build/deploy configuration, when changing `packages/better-translation` output consumed by the app, or when diagnosing a concrete production/build failure.

## Code Style

- Refer to relevant rules in the cursor rules folder.
- Prefer functional components in React
- IMPORTANT: Don't create uncessary functions or variables, only if they are shared.
- Always infer types from functions rather than typing the return
- Always use the database schema to infer the type of the data.
- Use snake_case for database columns
- When using database schemas prefer using the root schema and adding omit/pick to choose or omit fields, rather than creating custom schema variables that extend.
- Lucide icons rarely need size or margin props if used in a button or icon button as that button provides this.
- When using Base UI components that render buttons by default, such as buttons or dropdown items, but overriding them with `render={...}` to render a link or another non-button element, add `nativeButton={false}`.

## Architecture

- TanStack server funcitons live in -data.ts files next to the page that uses them.
- Keep behaviour as close to the owning source as possible. Component-specific hooks, mutations, permissions, invalidation, and toasts should live inside the component or module that owns that behaviour instead of being lifted into parent pages by default.
- In TanStack route files, prefer `Route.useParams()`, `Route.useRouteContext()`, and related route hooks inside route-local child components instead of prop-drilling params, query clients, app locale, or other route context through the tree.

## Development

- Don't generate drizzle migrations, this will happen later
- Don't account for backwards compatibility when making changes, unless requested
- We're typescript, it has types, trust that, dont be overly defensive when typing things
- For local browser testing, the typical email/password login is `jack+agent@noquarter.co` with password `password`.
- When changing `packages/better-translation`, run `bun changeset` and commit the generated changeset with the code change.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

This repo uses the default canonical triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

This repo is currently single-context; read `CONTEXT.md` first, then relevant ADRs if they exist. See `docs/agents/domain.md`.
