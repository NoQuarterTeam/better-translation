---
name: better-translation
description: Apply Better Translation markers and runtime setup in Vite Consumer apps. Use when installing or adopting Better Translation, marking UI copy with T, Var, useT, getT, or createT, reviewing new translatable code, or refreshing generated Locale values with bt generate.
---

# Better Translation

Better Translation is a Vite plugin and runtime helper package. It scans Translation markers in a Consumer app, creates Messages with stable lookup ids, writes or syncs Locale values, and exposes flat Runtime bundles through `better-translation/messages`.

## Before Editing

1. Inspect the Consumer app framework, Vite config, package manager, and existing Better Translation setup before adding new patterns.
2. Keep the Vite plugin before React, SvelteKit, TanStack Start, or other framework plugins.
3. Preserve local or remote runtime mode. Local mode owns generated Locale value files in the repo; remote mode syncs the Manifest to the hosted platform and reads hosted Runtime bundles.
4. Do not add editor metadata, source locations, Manifest details, or status objects to Runtime bundles. Runtime bundles are flat `lookup id -> translated string` maps.

## Installing In An Existing Vite App

1. Install `better-translation` with the repo's package manager.
2. Add `betterTranslation()` to `vite.config.ts` with `locales` and `defaultLocale`.
3. Load `loadMessages(locale)` from `better-translation/messages` at the app's route or layout boundary.
4. Wrap rendered UI in the framework provider: `TranslateProvider` from `better-translation/react` or `better-translation/svelte`.
5. Convert existing UI route by route or component by component. Keep behavior and layout unchanged while replacing authored copy with Translation markers.
6. Run `bt generate` after each meaningful batch, then run the app's normal format, lint, typecheck, and test commands.

## Marking React Copy

Use `T` for component children that are already JSX copy:

```tsx
import { T } from "better-translation/react"

export function CheckoutButton() {
  return (
    <button>
      <T>Pay now</T>
    </button>
  )
}
```

Use `Var` inside `T` for runtime values inside a sentence. The prop name becomes the placeholder name:

```tsx
import { T, Var } from "better-translation/react"

export function InviteMessage({ user }: { user: { email: string } }) {
  return (
    <T>
      Invite <Var email={user.email} /> to the Project
    </T>
  )
}
```

Use `useT()` for plain strings in attributes, labels, titles, form errors, toasts, and callbacks:

```tsx
import { useT } from "better-translation/react"

export function SearchInput() {
  const t = useT()

  return <input aria-label={t("Search Projects")} placeholder={t("Search...")} />
}
```

For plain strings with values, use `{name}` placeholders:

```tsx
t("Invite {email}", { email: user.email }, { context: "Invitation dialog title" })
```

## Marking Svelte Copy

Use `T` and `Var` from `better-translation/svelte` for component copy. Use `getT()` for attributes, labels, titles, form errors, and callbacks.

```svelte
<script lang="ts">
  import { T, Var, getT } from "better-translation/svelte"

  const t = getT()
</script>

<T>
  Invite <Var email={user.email} /> to the Project
</T>

<input aria-label={t("Search Projects")} />
```

## Server And Metadata Copy

Use `createT(messages)` from `better-translation/runtime` when copy is produced outside a rendered component tree, such as route metadata, SSR-only code, or server helpers.

```ts
import { createT } from "better-translation/runtime"

const t = createT(messages)

t("{name} settings", { name: project.name }, { context: "Page title" })
```

## Marker Rules

- Keep each `T` body as the smallest complete Message a translator should see.
- Keep layout-only markup outside `T`.
- Keep meaningful runtime values inside the Message with `Var`, not by concatenating translated strings.
- Do not put arbitrary runtime expressions directly inside `T`; use `Var`, `useT`, `getT`, or separate static Messages for finite variants.
- Add `context` for short, ambiguous, or tone-sensitive Messages.
- Use explicit `id` only when external code needs a stable lookup id independent of source copy.
- Preserve generated `id`, `message`, and `values` props on existing markers. For new markers, prefer source-first code and let `bt generate` add generated metadata.

## Finishing Work

1. Run `bt generate` or `better-translation generate` after adding, editing, or removing Translation markers.
2. Commit local-mode generated Locale value changes with the source change.
3. If a production build check says Locale files are stale, regenerate rather than editing generated lookup ids by hand.
4. Re-scan changed files before finishing and make sure no new user-facing copy was left unmarked unless it is intentionally not translatable.
