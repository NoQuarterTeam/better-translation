# Better Translation Platform

This document records the intended product and platform behavior for Better Translation. For canonical vocabulary, read `CONTEXT.md` first.

## Current Implementation Reality

The repo currently supports a local bundle-first workflow.

- `packages/better-translation` publishes the Vite plugin and runtime helpers.
- `apps/web` is the hosted app scaffold and current example surface.
- The plugin scans configured source roots for markers such as `t("...")`, `useT()`, and `<T>...</T>`.
- The plugin generates stable lookup ids and writes local artifacts.
- Missing non-default Locale values can be filled with a custom async `translate()` function, including the built-in AI helper.
- Runtime code loads local JSON through the virtual `better-translation/messages` module.

Remote runtime options exist in the package API. Remote sync posts the Manifest to the hosted service when a Project API key is configured, and the hosted service fills missing Locale values with the Platform translator during Manifest sync. Do not treat publishing as implemented unless the code shows it.

## Product Direction

The hosted v1 should make the hosted service canonical after adoption.

- Project creation is explicit in the hosted service.
- Plugin sync uploads Manifests to an existing Project.
- Branches isolate mainline and feature-branch translation work.
- The hosted UI edits branch-local Locale values.
- Consumer apps fetch flat Runtime bundles by Project, Branch, and Locale.
- Local Snapshot fallbacks are generated from hosted Runtime bundles.

Generated local snapshots are fallbacks, not a second source of truth.

## Package Boundary

`packages/better-translation` owns:

- Vite plugin configuration and source scanning.
- Stable lookup id generation.
- Manifest creation from source code.
- Local runtime artifacts.
- Virtual runtime loaders.
- React and server runtime helpers.
- Translation callback contracts and cache behavior.

Hosted-service behavior belongs in `apps/web` or a service layer unless it is part of the published package contract.

## Hosted Service Boundary

The hosted service owns:

- Projects.
- Synced Manifests.
- Branch-local Locale values.
- Branches.
- Branch locale configuration from each synced Manifest.
- Public Runtime bundle endpoints.

The hosted service should not be treated as the only realistic Consumer app. Keep a separate Consumer app surface or example path that reflects how an adopter would use the package.

## Runtime Bundles

Runtime bundles are plain JSON maps:

```json
{
  "m_lookup": "Translated string"
}
```

Runtime bundles must not include editor metadata, source locations, Manifest details, or draft-only state.

Remote runtime URLs are branch-addressed:

```text
/projects/:projectId/branches/:branch/locales/:locale.json
```

The Consumer app should keep calling `loadMessages(locale)`. The Vite plugin bakes the remote endpoint, Project id, and resolved Branch into the generated `better-translation/messages` virtual module.

Sync credentials are used by plugin sync only. Runtime bundle reads should not expose write credentials to the Consumer app runtime.

Missing non-default Locale values should be exceptional, not an expected steady state. Manifest sync should populate Branch Locale values before runtime reads them. When a value is still missing unexpectedly, the Runtime bundle should include the Branch Message's Default locale message for that key so the Consumer app renders complete UI.

The public Runtime bundle stays flat even when a value falls back to the Default locale. Completeness, fallback status, and missing-translation warnings belong in hosted-service metadata and dashboard views, not in the runtime payload.

## Local Mode

Local mode means the plugin writes Locale values into the Consumer app and the runtime loader reads those generated local files.

This is the working mode today. In local production builds, generated artifacts are check-only: the build should fail if committed local artifacts are missing, stale, incomplete, or contain orphaned ids.

Local runtime options should keep the current shape:

```ts
type BetterTranslateLocalRuntimeOptions = {
  type: "local"
  target?: "module" | "public"
  output?: string
  basePath?: string
  translate?: TranslateFn
}
```

`target: "module"` writes generated Locale files under the app source tree and loads them through Vite module imports. `target: "public"` writes generated Locale files under Vite's `publicDir` and the virtual loader fetches them at runtime.

For public local runtime, the default output is Vite `publicDir` plus `bt`, and the default public base path is `/bt`. `basePath` exists for deployments where the public URL does not directly match the output path.

`translate?: TranslateFn` belongs to local runtime options. It fills missing non-default Locale values during dev and writes those values into local artifacts/cache. Production local builds do not call `translate`.

Local mode can optionally expose a dev-only local editor from the Vite plugin:

```ts
runtime: {
  type: "local",
  editor: true,
}
```

The local editor is served by the plugin during `vite dev` only. It reads the private Manifest and local Locale values, lets developers search Messages and edit non-default Locale values, and writes those values back to the flat local Locale value files. It does not create Projects, Branches, hosted sync, auth, or remote runtime behavior.

The local editor is split across package boundaries. `packages/better-translation` owns the Vite dev middleware and local Locale value file writes. `packages/locale-editor` owns the reusable Message and Locale value editor React surface. `packages/ui` owns the shared shadcn/Base UI primitives and theme CSS used by the hosted app and editor.

Future editor surface ideas, including a mounted local editor, remote embedded editor adapters, and iframe embeds, are captured in `docs/editor-surfaces.md`. The broader open Manifest, Locale values, and provider protocol idea is captured separately in `docs/open-translation-protocol.md`.

## Remote Mode

Remote mode means the plugin syncs source metadata to the hosted service and the Consumer app reads branch-local Locale values at runtime.

The target remote flow is:

1. A Project is created explicitly in the hosted service.
2. The Consumer app configures the Vite plugin with a Project id and write credential.
3. The plugin resolves the current Branch.
4. The plugin uploads Manifest changes to that Branch.
5. Translators edit branch-local Locale values in the hosted UI.
6. Consumer apps load flat Runtime bundles from the public runtime endpoint.

Plugin sync should fail clearly if the configured Project does not exist.

Manifest source snapshots should identify durable source ownership only: file path, marker kind, and marker name. Exact line, column, and character offsets are compile-time details and should not be synced, because unrelated source edits can move them without changing any Message.

Manifest sync responses should report whether anything changed. Successful no-op syncs should be quiet in plugin logs, and changed syncs should use a generic "Synced Messages" log instead of exposing storage-level create, update, and deactivate counts.

Remote runtime options should use this shape:

```ts
type BetterTranslateRemoteRuntimeOptions = {
  type: "remote"
  projectId: string
  endpoint?: string
  apiKey?: string // falls back to process.env.BETTER_TRANSLATION_API_KEY for Manifest sync
  branch?: "auto" | string
  dev?: {
    offline?: boolean
  }
}
```

The Project API key is a plugin-only write credential. It may live on the remote options for Vite config ergonomics, but generated runtime artifacts must strip it and runtime bundles must never include it.

Remote defaults should be:

```ts
{
  branch: "auto",
  dev: {
    offline: false,
  },
}
```

`dev.offline: false` means local dev uses the hosted platform. The dev runtime reads hosted Runtime bundles for the resolved Branch, and the Platform translator fills missing branch Locale values when needed.

`dev.offline: true` means local dev opts out of platform reads and writes. The dev runtime uses ignored local cache artifacts and Default locale fallback for new Messages, not the Consumer app's committed local runtime output. Remote builds still sync to the hosted platform.

Remote mode does not accept a package-local `translate` callback. Canonical hosted translation in remote mode goes through the Platform translator.

## Branches

Projects are explicit. Branches are automatic.

The plugin should resolve a Branch in this order:

1. explicit runtime or sync config
2. `BETTER_TRANSLATION_BRANCH`
3. provider branch env, such as `VERCEL_GIT_COMMIT_REF`
4. current Git branch
5. the Project's Production Branch when it exists, otherwise the package fallback branch

If the resolved Branch does not exist, plugin sync can create it. That is intentionally different from Project creation, which remains explicit. If a Project has no Production Branch yet, the first synced Branch becomes the Production Branch.

The dashboard should let users view and edit each Branch. Feature branches are optional and exist for PR-specific copy work.

The Production Branch is protected and should not be deleted or archived by automatic Branch lifecycle cleanup.

New Projects should guide users through choosing the first Production Branch before Manifest sync when possible. The user can create it manually, connect GitHub and use the repository default branch, or let the first plugin sync set the Production Branch.

A Project can optionally connect to one GitHub repository through a GitHub App. Repository connection is not required for remote mode, Manifest sync, or Runtime bundle loading. It can power optional Branch cleanup.

Repository connection is separate from user sign-in. A user may authenticate with GitHub without connecting a repository to a Project, and a Project repository connection only applies to that Project.

Branch cleanup is a Project setting. It is enabled by default and only takes effect when the Project has a Repository connection. When enabled, the hosted service archives non-production Branches whose matching upstream branch no longer exists. The Production Branch is always protected from automatic cleanup.

Branch cleanup should be webhook-driven. GitHub branch deletion events are the signal for archiving a matching non-production Branch. Pull request close or merge events should not archive Branches by themselves.

When the hosted service can tell that a non-default upstream branch no longer exists, the matching Branch should become an Archived Branch rather than being hard-deleted immediately. Archived Branches keep their Messages and Locale values available for Runtime bundle reads, because preview deployments can outlive the upstream branch that created them.

If Manifest sync later targets an Archived Branch, the Branch should become active again and sync normally. A new sync is enough evidence that the Branch is relevant again.

Each Branch stores the Default locale and supported Locale list from its latest synced Manifest. Projects do not own a single global locale configuration, because a feature Branch can temporarily add, remove, or change locale settings before that change reaches the Production Branch.

Locale value edits are live for the Branch they belong to. Editing the Production Branch affects Consumer apps reading that Branch; editing a feature branch affects only Consumer apps reading that feature branch.

## Production Branch Seeding

Non-production Branches use the Production Branch as a seed during Manifest sync.

Manifest sync for a feature branch should work like this for each non-default Locale:

1. keep an existing Branch Locale value when one exists
2. copy the Production Branch Locale value when the same lookup id exists there and its Default locale text hash still matches
3. otherwise generate and store a new Branch Locale value with the Platform translator

Runtime bundles read only the requested Branch's active Messages and Branch Locale values. They do not populate missing values or read through to the Production Branch at runtime.

## Branch Overrides

A Branch override stores the branch-specific Locale value plus the base value hash it was based on.

At minimum, branch-specific Locale value storage should preserve:

- the Project
- the Branch
- the lookup id
- the Locale
- the translated value
- the value source, such as `imported`, `ai`, or `manual`
- the current value hash
- the base value hash used when the override was created
- update metadata such as time and editor when available

The lookup id identifies the same source Message across branches. Branch-scoped Message rows can have different Default locale text, context, placeholders, and source metadata for the same lookup id. The value hash identifies whether the translated Locale value changed.

## Branch Reconciliation

Feature branch values must not overwrite the Production Branch automatically.

When a feature branch is merged in Git, the next sync on the Production Branch uploads the new Manifest there. Locale values from the feature Branch remain branch-local unless a user explicitly applies them to the Production Branch.

Future reconciliation can use the base value hash on each Branch override to determine whether applying it to the Production Branch is safe:

- if the branch value changed and the Production Branch value did not change, the override can be applied cleanly
- if the Production Branch changed and the branch did not change from its base, keep the Production Branch value
- if both changed to the same value, keep the Production Branch value
- if both changed differently, require review
- AI or imported values from a feature branch must not automatically overwrite newer manual edits on the Production Branch

The dashboard can offer an explicit "apply to Production Branch" action for a Branch override. That action writes the branch value to the Production Branch only when the user chooses it.

## Remote Sync Timing

Remote sync must support deploys that run without a local dev server.

- `vite dev` in remote mode syncs the current Manifest on startup and after source changes unless `dev.offline: true` is set.
- `vite build` in remote mode pushes Manifest changes to the resolved Branch.
- Build sync should be deterministic and idempotent: same Manifest, same branch, same result.
- Build sync must fail clearly if the configured Project does not exist or credentials are invalid.

A future explicit `better-translation sync` command can reuse the same API and payload, but it is not required for the first hosted slice.

## Local Dev In Remote Mode

Remote mode still needs a fast local development experience.

By default, local `vite dev` should:

- read hosted Runtime bundles for the resolved Branch
- use the Platform translator to fill blank branch Locale values
- store generated Locale values on the hosted Branch
- sync the current Manifest so the platform knows the latest lookup ids

This makes `runtime.type: "remote"` mean "use the platform" during local dev as well as deployed builds.

For isolated or offline work, `dev.offline: true` switches local dev to ignored local cache artifacts and Default locale fallback. In offline dev, local source changes do not reach the platform, dashboard edits do not appear locally, and generated fallback values should not be mixed into the Consumer app's local-mode Locale values.

Plugin-owned caches live under `.cache/better-translation/` by default. The translation cache is `.cache/better-translation/cache.json`, and remote offline Runtime bundles are written under `.cache/better-translation/runtime/`.

The hosted app can dogfood remote mode by pointing its plugin endpoint at a running platform instance. In local self-dogfood, that endpoint can be the same Vite dev server URL, but initial Manifest sync must wait until the dev server is listening. A separate deployed or preview platform endpoint avoids the startup dependency and is the better path for stable dogfooding.

## Translation Ownership

Local mode and remote mode have different owners for Locale values.

In local mode, the repo owns Locale values. The plugin writes local JSON files, `translate` can fill missing values, and developers can edit and commit those files.

In remote mode, the hosted platform owns Locale values. Package-local translation callbacks are not the canonical source for hosted Locale values. Remote-mode translation uses the Platform translator.

## Platform Translator

Remote-mode AI translation should use the Platform translator, not duplicate per-repo AI settings.

The Platform translator uses a Better Translation-owned model. Projects can configure the translation brief for tone, glossary, and style guidance. Manifest sync and local dev platform translation should both use that Project guidance.

When local dev calls the Platform translator, the request should include enough information to identify and translate the value:

- Project id
- resolved Branch
- Lookup id
- Default locale text
- target Locale
- context, placeholders, and source metadata when available

Platform translator requests are canonical fill-blank writes. Manifest sync should:

1. keep an existing Branch Locale value when one exists
2. copy a matching Production Branch value into the resolved Branch when one exists
3. otherwise generate a new value using Project settings
4. store the generated value on the resolved Branch with `source: "ai"`
5. return flat runtime bundles from stored Branch values only

Later build sync for the same lookup id should reuse the stored value and should not retranslate it.

The Platform translator must fill blanks only. It must not overwrite manual hosted edits.

Using remote mode in local dev means Platform translator calls can be remote fill-blank writes. The tool should make those writes visible in logs and should make `dev.offline: true` available for isolated local work.

## Local-To-Hosted Migration

Existing local Locale values are not part of the normal hosted workflow.

When a Consumer app migrates from local mode to remote mode, a one-time import can seed hosted Locale values from existing local files. This import should be explicit, fill blank hosted fields only, and never overwrite hosted edits.

After migration, remote mode should not keep reading or writing editable local Locale files. The hosted platform owns Locale values.

## AI Translation

Hosted-mode sync should not call package-local AI translation during `vite dev` or `vite build`. In remote mode, the Vite plugin only extracts and syncs the Manifest, then runtime code fetches hosted Runtime bundles.

Remote sync uploads the Manifest. The hosted service then fills missing Branch Locale values using matching Production Branch values or the Platform translator.

Manifest sync stores the Manifest and fills missing Branch Locale values as part of the sync request so runtime reads can stay read-only.

AI-generated values are stored as branch-local Locale values with source metadata such as `ai`. They follow the same Branch override and reconciliation rules as other Locale values, and must not overwrite newer manual edits automatically.

## Orphaned Messages

The hosted service can keep Orphaned messages for history. Runtime bundles exclude Orphaned messages by default.

Local generated artifacts should be pruned to the current Manifest.

## Open Product Questions

- When should Snapshot fallbacks be generated, and should any be committed?
