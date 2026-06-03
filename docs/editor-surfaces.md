# Editor Surfaces

This document captures product and architecture ideas for editing Locale values outside the hosted dashboard. It is intentionally exploratory. `docs/platform.md` remains the source for current platform behavior and near-term hosted-service direction.

For the broader open Manifest, Locale values, and provider protocol idea, see `docs/open-translation-protocol.md`.

## Goals

Better Translation can support more than one place where Locale values are edited:

- a standalone local editor served by the Vite plugin during `vite dev`
- an editor mounted inside a Consumer app during local development
- the hosted dashboard for remote-mode Projects and Branches
- a possible remote editor mounted inside a Consumer app but backed by the Platform API
- a possible hosted iframe embed

## Current Local Editor

Local mode can already expose a dev-only editor:

```ts
runtime: {
  type: "local",
  editor: true,
}
```

Today the Vite plugin serves a separate editor route, usually:

```text
/__better-translation
```

That route serves the editor app, CSS, assets, and local editor API. The plugin reads the private Manifest and local Locale value files, then writes edited values back to the local flat Locale value files.

The current package split is a good foundation:

- `packages/better-translation` owns Vite middleware, local editor API routes, Manifest access, and local file writes.
- `packages/locale-editor` owns the reusable Message and Locale value editor React surface.
- `packages/ui` owns shared UI primitives and theme CSS.

## Mounted Local Editor

A stronger local-mode experience would let a Consumer app render the Better Translation editor component itself while the Vite plugin still owns the dev-only local editor API and file writes.

Example:

```tsx
import { BetterTranslationLocalEditor } from "better-translation/local-editor"
import "better-translation/local-editor.css"

export function Root() {
  return (
    <>
      <App />
      {import.meta.env.DEV ? <BetterTranslationLocalEditor apiBase="/__better-translation" variant="drawer" /> : null}
    </>
  )
}
```

The browser would still call the Vite dev middleware:

```text
GET /__better-translation/api/messages
GET /__better-translation/api/messages/:lookupId
PATCH /__better-translation/api/messages/:lookupId/locales/:locale
```

The Vite plugin remains the only writer of local Locale value files. The rendering owner changes.

Standalone route:

```text
Vite middleware -> editor HTML -> editor React app -> local editor API
```

Mounted component:

```text
Consumer app React tree -> Better Translation editor component -> local editor API
```

### Possible API

The simplest component API:

```tsx
<BetterTranslationLocalEditor />
```

With explicit options:

```tsx
<BetterTranslationLocalEditor apiBase="/__better-translation" variant="popover" defaultOpen={false} />
```

Useful variants:

- `page`: a full editor surface for a route the Consumer app owns
- `drawer`: a side panel suitable for app shells
- `popover`: a compact floating editor
- `dialog`: an explicit modal opened by the app
- `headless`: data/actions only, for custom UI

The package could also expose smaller primitives:

```tsx
<BetterTranslationLocalEditorProvider apiBase="/__better-translation">
  <BetterTranslationDevToolbar />
  <BetterTranslationLocalEditorDrawer />
</BetterTranslationLocalEditorProvider>
```

This would let a Consumer app place the trigger and editor surface separately.

### Benefits

Mounted local editing makes the editor feel like a development tool inside the app being translated.

- The editor can live in the app root, app shell, route layout, or a hidden dev-only route.
- The Consumer app owns where and when the editor appears.
- The editor uses the Consumer app's React instance instead of loading a separate mini React app from the middleware route.
- Developers can keep app context while editing copy.
- The editor can be a drawer, popup, dialog, toolbar, or full page.
- The standalone middleware route can remain as a zero-config fallback.
- The same editor surface can be reused by local mode, the hosted dashboard, and later remote embedded surfaces.

### Vite Plugin Options

The existing `editor: true` option can keep meaning "serve the standalone editor route."

Mounted mode may need an option that enables only the API:

```ts
runtime: {
  type: "local",
  editor: {
    api: true,
    route: false,
  },
}
```

Or the plugin can always expose the API when the local editor is enabled, while the component chooses whether to use it.

Possible future config:

```ts
runtime: {
  type: "local",
  editor: {
    enabled: true,
    route: true,
    open: false,
    path: "/__better-translation",
  },
}
```

The important part is that local production builds never expose this editor. It is a `vite dev` tool.

### React and Bundling

Mounted mode should use the Consumer app's React instance.

That avoids loading a second full editor app bundle through plugin HTML. It also fits apps that already have React Query, routing, error boundaries, or app-shell structure.

The package should not require the Consumer app to depend directly on private workspace packages. Public exports should come from `better-translation`:

```tsx
import { BetterTranslationLocalEditor } from "better-translation/local-editor"
import "better-translation/local-editor.css"
```

Internally, that export can reuse the existing `@better-translation/locale-editor` surface.

### Styling and Bundling

Mounted mode changes CSS delivery.

The standalone route can keep serving compiled editor CSS from the Vite middleware. Mounted mode needs a package CSS export that works through the Consumer app bundler:

```tsx
import "better-translation/local-editor.css"
```

That CSS should be prebuilt. It should not require the Consumer app to configure Tailwind content scanning for Better Translation internals.

The package should avoid assuming the Consumer app uses the same UI stack. Editor CSS should be namespaced enough to avoid broad app style collisions, while still allowing the editor to use the shared Better Translation UI primitives.

### Current Page Awareness

Mounted mode creates room for dev-only page awareness.

Possible features:

- show Messages currently rendered on the page first
- show the current route's Messages first
- highlight rendered Messages in the app
- click rendered copy to open its Message in the editor
- filter Messages by current route or source module
- show source file paths from the Manifest
- deep-link a Message to the source file or IDE when source metadata allows it

This likely requires dev-only metadata from the runtime React helpers, such as rendered lookup ids:

```html
<span data-bt-id="checkout.pay_now">Pay now</span>
```

That metadata should be development-only by default. It should support inspection and highlighting only. It should not become a runtime DOM translation mechanism.

The browser cannot reliably know the current source file by itself. Any "current file" behavior needs to come from Manifest source metadata, Vite dev metadata, route/module ownership, or explicit runtime markers.

Better paths:

- use Manifest source metadata to show source file paths
- use Vite dev metadata or source maps when available
- use route/module ownership if the app framework exposes it
- use rendered lookup ids to identify Messages visible on the current page

The first version should probably prioritize rendered Messages and Manifest source paths. IDE/source deep links can come later.

### Headless Mode

A headless hook could let Consumer apps build their own UI while using Better Translation data and writes:

```tsx
const editor = useBetterTranslationLocalEditor({
  apiBase: "/__better-translation",
})
```

The hook could expose:

```ts
type LocalEditorState = {
  messages: MessageSummary[]
  selectedMessage: MessageDetail | null
  search: string
  view: "all" | "missing"
  setSearch(value: string): void
  setView(value: "all" | "missing"): void
  selectMessage(lookupId: string): void
  saveLocaleValue(input: { lookupId: string; locale: string; value: string }): Promise<void>
}
```

This is optional. The first useful product is a complete component.

## Remote Editor Mounted in a Consumer App

Separately from local mode, a remote-mode Consumer app could mount an editor that talks to the Platform API through framework-specific server functions.

For TanStack Start, a future shape could be:

```tsx
import { BetterTranslationRemoteEditor, createTanStackRemoteEditorRoute } from "better-translation/tanstack-start/editor"

export const Route = createFileRoute("/__better-translation")({
  beforeLoad: async () => {
    await requireDeveloperAccess()
  },
  component: () => <BetterTranslationRemoteEditor projectId={process.env.BETTER_TRANSLATION_PROJECT_ID} branch="auto" />,
  server: createTanStackRemoteEditorRoute({
    apiKey: process.env.BETTER_TRANSLATION_EDITOR_KEY,
  }),
})
```

The browser should not call privileged Platform APIs directly. The Consumer app would expose same-origin server functions that call Better Translation with a server-side credential.

### Framework Adapter Responsibilities

A TanStack Start adapter would own:

- route/server-function glue
- server-side credential handling
- request validation
- optional actor extraction from the Consumer app auth system
- calls to the Platform editor API

The shared editor UI would own:

- Message search and filtering
- selected Message state
- editing forms
- save/generate actions
- loading and error states

### Remote Editor API Surface

The adapter could expose a small action contract:

```ts
type TranslationEditorProvider = {
  listMessages(input: { q?: string; view?: "all" | "missing" }): Promise<MessageSummary[]>
  getMessage(lookupId: string): Promise<MessageDetail>
  saveLocaleValue(input: { lookupId: string; locale: string; value: string }): Promise<MessageDetail>
  generateLocaleValue?(input: { lookupId: string; locale: string }): Promise<MessageDetail>
}
```

The UI does not need to know whether the provider is local files, the hosted Platform, or another backend.

## Auth Model for Mounted Remote Editing

It is reasonable for a mounted remote editor to use the Consumer app's auth system for access control.

There are two separate questions:

- Can the current user access this editor route?
- Can this server mutate Locale values for this Project and Branch?

The Consumer app should answer the first question:

```ts
beforeLoad: async () => {
  const user = await requireUser()
  if (!user.roles.includes("developer")) throw redirect({ to: "/" })
}
```

Better Translation should answer the second question through a scoped server-side credential:

```ts
createTanStackRemoteEditorRoute({
  apiKey: process.env.BETTER_TRANSLATION_EDITOR_KEY,
})
```

The editor should not require every embedded user to have a Better Translation account. That would create identity mapping, team membership, SSO, revocation, and audit complexity.

Instead, the adapter can optionally provide actor metadata:

```ts
createTanStackRemoteEditorRoute({
  apiKey: process.env.BETTER_TRANSLATION_EDITOR_KEY,
  getActor: async () => {
    const user = await getCurrentUser()

    return {
      id: user.id,
      name: user.name,
      email: user.email,
    }
  },
})
```

The Platform can store that actor as external edit metadata without treating the person as a Better Translation user.

## Editor Credentials

Remote mounted editing should not use browser-exposed credentials.

The existing Project API key is a plugin write credential for Manifest sync. It should not be shipped to browsers or reused casually as a general editor credential.

A future remote editor should probably use a scoped Editor key or Project access token that can:

- read editor metadata for a Project and Branch
- save Branch Locale values
- generate Branch Locale values when allowed

It should not be able to:

- sync Manifests
- change Project settings
- manage API keys
- manage repository connections
- delete or archive Branches unless explicitly scoped for that

For an internal spike, the server-side Project API key could technically call the same APIs, but the product contract should keep sync credentials and editor credentials separate.

## Hosted Iframe Embed

An iframe embed is possible, but it is a different product surface.

Example:

```tsx
const url = await createBetterTranslationEmbedUrl({
  projectId,
  branch,
  actor,
})

return <iframe src={url} />
```

The iframe model means the UI is still hosted by Better Translation and embedded in the Consumer app.

### Benefits

- Better Translation can ship UI updates without package upgrades.
- The Consumer app does not bundle the editor UI.
- The implementation is less framework-specific.
- Hosted auth and dashboard code can be reused more directly.

### Costs

- Auth is harder. Users either need Better Translation sessions or signed embed sessions.
- Cross-origin cookies and browser privacy changes make embedded sessions fragile.
- Styling and layout integration are limited.
- Current app context is harder to access.
- Localhost development involves CORS, CSP, callback URLs, and origin handling.
- Saving still needs scoped token design.

The iframe option is probably best as a convenience later. The richer embedded developer experience is package UI plus framework adapter.

## Future Product Paths

Near-term local mode:

- keep the standalone local editor route
- add an embedded local editor React export
- add a compiled CSS export
- keep the Vite middleware API as the write path
- optionally add a dev toolbar or floating button

Better local dev inspection:

- add dev-only rendered lookup id metadata
- prioritize Messages visible on the current page
- highlight rendered translated copy
- click rendered copy to select the Message in the editor
- expose source file links when durable source metadata is available

Remote embedded editing:

- add a Platform editor API that returns editor metadata, not Runtime bundles
- add scoped Editor keys
- add TanStack Start server-function adapter first
- support Consumer app auth as the route gate
- store optional external actor metadata for audit history

Hosted embed:

- support signed iframe embed URLs if the package-mounted editor is not enough
- keep iframe sessions scoped and short-lived
- treat this as hosted UI embedded in an app, not as the primary local dev experience

## Design Constraints

- Local mode owns local Locale values. Remote mode owns hosted Locale values.
- Runtime bundles remain flat `lookupId -> translated string` objects.
- Editor metadata does not belong in Runtime bundles.
- Browser code must not receive write credentials.
- Mounted local editing should be dev-only by default.
- Mounted remote editing should use the Consumer app's auth for route access and a Better Translation scoped server credential for Platform access.
- The standalone local editor route should remain as a zero-config fallback.
- Dev-only page inspection may read rendered metadata, but Better Translation should not translate by mutating rendered DOM.
