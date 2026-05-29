# Better Translation Platform

This document records the intended product and platform behavior for Better Translation. For canonical vocabulary, read `CONTEXT.md` first.

## Current Implementation Reality

The repo currently supports a local bundle-first workflow.

- `packages/better-translation` publishes the Vite plugin and runtime helpers.
- `apps/web` is the hosted app scaffold and current example surface.
- The plugin scans configured source roots for markers such as `t("...")`, `useT()`, and `<T>...</T>`.
- The plugin generates stable message ids and writes local artifacts.
- Missing non-default Locale values can be filled with a custom async `translate()` function, including the built-in AI helper.
- Runtime code loads local JSON through the virtual `better-translation/messages` module.

Remote runtime options exist in the package API, but remote sync and remote translation are still stubs. Do not treat remote storage, hosted editing, publishing, or remote runtime serving as implemented unless the code shows it.

## Product Direction

The hosted v1 should make the hosted service canonical after adoption.

- Project creation is explicit in the hosted service.
- Plugin sync uploads Manifests to an existing Project.
- Translation Branches isolate mainline and feature-branch translation work.
- The hosted UI edits branch-local Locale values.
- Consumer apps fetch flat Runtime bundles by Project, Translation Branch, and Locale.
- Local Snapshot fallbacks are generated from hosted Runtime bundles.

Generated local snapshots are fallbacks, not a second source of truth.

## Package Boundary

`packages/better-translation` owns:

- Vite plugin configuration and source scanning.
- Stable Message id generation.
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
- Translation Branches.
- Public Runtime bundle endpoints.

The hosted service should not be treated as the only realistic Consumer app. Keep a separate Consumer app surface or example path that reflects how an adopter would use the package.

## Runtime Bundles

Runtime bundles are plain JSON maps:

```json
{
  "message.id": "Translated string"
}
```

Runtime bundles must not include editor metadata, source locations, Manifest details, or draft-only state.

Remote runtime URLs are branch-addressed:

```text
/projects/:projectId/branches/:branch/locales/:locale.json
```

The Consumer app should keep calling `loadMessages(locale)`. The Vite plugin bakes the remote endpoint, Project id, and resolved Translation Branch into the generated `better-translation/messages` virtual module.

Sync credentials are used by plugin sync only. Runtime bundle reads should not expose write credentials to the Consumer app runtime.

Missing non-default Locale values should be exceptional, not an expected steady state. When they do happen, the Runtime bundle should include the Default locale message for that key so the Consumer app renders complete UI.

The public Runtime bundle stays flat even when a value falls back to the Default locale. Completeness, fallback status, and missing-translation warnings belong in hosted-service metadata and dashboard views, not in the runtime payload.

## Local Mode

Local mode means the plugin writes Locale values into the Consumer app and the runtime loader reads those generated local files.

This is the working mode today. In local production builds, generated artifacts are check-only: the build should fail if committed local artifacts are missing, stale, incomplete, or contain orphaned ids.

Local runtime config should keep the current shape:

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

`translate?: TranslateFn` belongs to local runtime config. It fills missing non-default Locale values during dev and writes those values into local artifacts/cache. Production local builds do not call `translate`.

## Remote Mode

Remote mode means the plugin syncs source metadata to the hosted service and the Consumer app reads branch-local Locale values at runtime.

The target remote flow is:

1. A Project is created explicitly in the hosted service.
2. The Consumer app configures the Vite plugin with a Project id and write credential.
3. The plugin resolves the current Translation Branch.
4. The plugin uploads Manifest changes to that Translation Branch.
5. Translators edit branch-local Locale values in the hosted UI.
6. Consumer apps load flat Runtime bundles from the public runtime endpoint.

Plugin sync should fail clearly if the configured Project does not exist.

Remote runtime config should use this shape:

```ts
type BetterTranslateRemoteRuntimeOptions = {
  type: "remote"
  projectId: string
  endpoint?: string
  branch?: "auto" | string
  dev?: {
    offline?: boolean
  }
}
```

Remote defaults should be:

```ts
{
  branch: "auto",
  dev: {
    offline: false,
  },
}
```

`dev.offline: false` means local dev uses the hosted platform. The dev runtime reads hosted Runtime bundles for the resolved Translation Branch, and the Platform translator fills missing branch Locale values when needed.

`dev.offline: true` means local dev opts out of platform reads and writes. The dev runtime uses ignored local cache artifacts and Default locale fallback for new Messages, not the Consumer app's committed local runtime output. Remote builds still sync to the hosted platform.

Remote mode does not accept a package-local `translate` callback. Canonical hosted translation in remote mode goes through the Platform translator.

## Translation Branches

Projects are explicit. Translation Branches are automatic.

The plugin should resolve a Translation Branch in this order:

1. explicit runtime or sync config
2. `BETTER_TRANSLATION_BRANCH`
3. provider branch env, such as `VERCEL_GIT_COMMIT_REF`
4. current Git branch
5. the Project default branch, usually `main`

If the resolved Translation Branch does not exist, plugin sync can create it. That is intentionally different from Project creation, which remains explicit.

The dashboard should let users view and edit each Translation Branch. `main` is the default working branch for most users. Feature branches are optional and exist for PR-specific copy work.

Locale value edits are live for the Translation Branch they belong to. Editing `main` affects Consumer apps reading `main`; editing a feature branch affects only Consumer apps reading that feature branch.

## Branch Inheritance

Translation Branches inherit Locale values from their parent branch, usually `main`, unless they have a Branch override.

Runtime resolution for a feature branch should work like this:

1. use the Branch override for the requested Message and Locale when one exists
2. otherwise use the parent branch Locale value when one exists
3. otherwise use the Default locale message

Inherited values do not need to be copied into every branch. A feature branch can read the parent value directly until the branch intentionally changes that value.

## Branch Overrides

A Branch override stores the branch-specific Locale value plus the parent value hash it was based on.

At minimum, branch-specific Locale value storage should preserve:

- the Project
- the Translation Branch
- the Message id
- the Locale
- the translated value
- the value source, such as `imported`, `ai`, or `manual`
- the current value hash
- the parent value hash used as the base when the override was created
- update metadata such as time and editor when available

The Message id identifies the same source Message across branches. The value hash identifies whether the translated Locale value changed.

## Branch Reconciliation

Feature branch values must not overwrite `main` automatically.

When a feature branch is merged in Git, the next sync on `main` uploads the new Manifest to `main`. Locale values from the feature Translation Branch remain branch-local unless a user explicitly applies them to `main`.

Future reconciliation can use the parent value hash on each Branch override to determine whether applying it to `main` is safe:

- if the branch value changed and the parent value on `main` did not change, the override can be applied cleanly
- if `main` changed and the branch did not change from its base, keep `main`
- if both changed to the same value, keep `main`
- if both changed differently, require review
- AI or imported values from a feature branch must not automatically overwrite newer manual edits on `main`

The dashboard can offer an explicit "apply to main" action for a Branch override. That action writes the branch value to `main` only when the user chooses it.

## Remote Sync Timing

Remote sync must support deploys that run without a local dev server.

- `vite dev` does not sync the full Manifest to the hosted service by default.
- `vite build` in remote mode pushes Manifest changes to the resolved Translation Branch.
- Build sync should be deterministic and idempotent: same Manifest, same branch, same result.
- Build sync must fail clearly if the configured Project does not exist or credentials are invalid.

A future explicit `better-translation sync` command can reuse the same API and payload, but it is not required for the first hosted slice.

## Local Dev In Remote Mode

Remote mode still needs a fast local development experience.

By default, local `vite dev` should:

- read hosted Runtime bundles for the resolved Translation Branch
- use the Platform translator to fill blank branch Locale values
- store generated Locale values on the hosted Translation Branch
- avoid syncing the full Manifest until build

This makes `runtime.type: "remote"` mean "use the platform" during local dev as well as deployed builds.

For isolated or offline work, `dev.offline: true` switches local dev to ignored local cache artifacts and Default locale fallback. In offline dev, local source changes do not reach the platform, dashboard edits do not appear locally, and generated fallback values should not be mixed into the Consumer app's local-mode Locale values.

Plugin-owned caches live under `.cache/better-translation/` by default. The translation cache is `.cache/better-translation/cache.json`, and remote offline Runtime bundles are written under `.cache/better-translation/runtime/`.

## Translation Ownership

Local mode and remote mode have different owners for Locale values.

In local mode, the repo owns Locale values. The plugin writes local JSON files, `translate` can fill missing values, and developers can edit and commit those files.

In remote mode, the hosted platform owns Locale values. Package-local translation callbacks are not the canonical source for hosted Locale values. Remote-mode translation uses the Platform translator.

## Platform Translator

Remote-mode AI translation should use the Platform translator, not duplicate per-repo AI settings.

The Platform translator uses Project-level settings such as model, tone, glossary, and style guidance. Hosted auto-translation and local dev platform translation should both use those settings.

When local dev calls the Platform translator, the request should include enough information to identify and translate the value:

- Project id
- resolved Translation Branch
- Message id
- Default locale text
- target Locale
- context, placeholders, and source metadata when available

Platform translator requests are canonical fill-blank writes. The hosted service should:

1. return an existing branch Locale value when one exists
2. otherwise return an inherited parent branch value when one exists
3. otherwise generate a new value using Project settings
4. store the generated value on the resolved Translation Branch with `source: "ai"`
5. return the same stored value to local dev

Later build sync for the same Message id should reuse the stored value and should not retranslate it.

The Platform translator must fill blanks only. It must not overwrite manual hosted edits.

Using remote mode in local dev means Platform translator calls can be remote fill-blank writes. The tool should make those writes visible in logs and should make `dev.offline: true` available for isolated local work.

## Local-To-Hosted Migration

Existing local Locale values are not part of the normal hosted workflow.

When a Consumer app migrates from local mode to remote mode, a one-time import can seed hosted Locale values from existing local files. This import should be explicit, fill blank hosted fields only, and never overwrite hosted edits.

After migration, remote mode should not keep reading or writing editable local Locale files. The hosted platform owns Locale values.

## AI Translation

Hosted-mode sync should not call package-local AI translation during `vite dev` or `vite build`.

Build sync uploads the Manifest. The hosted service can then fill missing Locale values using the Platform translator when Project or Translation Branch settings allow it.

AI-generated values are stored as branch-local Locale values with source metadata such as `ai`. They follow the same Branch override and reconciliation rules as other Locale values, and must not overwrite newer manual edits automatically.

## Orphaned Messages

The hosted service can keep Orphaned messages for history. Runtime bundles exclude Orphaned messages by default.

Local generated artifacts should be pruned to the current Manifest.

## Open Product Questions

- When should Snapshot fallbacks be generated, and should any be committed?
