# Better Translation

Local-first internationalization for Vite apps.

Mark copy where you author it in React or Svelte. The Better Translation Vite plugin discovers Messages, generates flat Locale value JSON, and creates the runtime loader your app uses to render them. Edit the JSON directly or add your own AI translator; no account or hosted runtime is required.

```tsx
import { T, useT } from "better-translation/react"

export function CheckoutButton() {
  const t = useT()

  return (
    <button aria-label={t("Complete checkout")}>
      <T>Pay now</T>
    </button>
  )
}
```

## See it in action

[![Better Translation Vite plugin demo](https://www.better-translation.dev/better-translation-demo-poster.webp)](https://www.better-translation.dev/#demo)

Watch the end-to-end local workflow: mark UI copy, discover Messages with Vite, edit a Locale JSON file, and see the translated app update during development.

## Why Better Translation

- No translation keys to invent or maintain by hand.
- Local Runtime bundles are ordinary flat `lookup id -> translated string` JSON.
- React, Svelte, and framework-neutral server runtime helpers.
- Safe Rich-text Messages preserve authored elements and source-owned components without rendering arbitrary HTML.
- Optional AI translation through your own async `translate()` function.
- Optional local editor during Vite development.
- Production builds catch missing, stale, incomplete, or orphaned local artifacts.
- Open source and usable without an account.

## Install

Better Translation requires Node 24 or later and Vite 8 or later.

```bash
npm install better-translation
```

## Configure the Vite plugin

Add `betterTranslation()` before the framework plugin in `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { betterTranslation } from "better-translation/vite"

export default defineConfig({
  plugins: [
    betterTranslation({
      locales: ["en", "es", "fr"],
      defaultLocale: "en",
    }),
    react(),
  ],
})
```

The default local runtime writes Locale values under `src/lib/bt` and exposes the virtual `better-translation/messages` module.

For Svelte, put the plugin before `svelte()` and import runtime components from `better-translation/svelte`.

## Load Runtime bundles

Load the active Locale before rendering and pass its Runtime bundle to the framework provider:

```tsx
import { loadMessages } from "better-translation/messages"
import { TranslateProvider } from "better-translation/react"

const messages = await loadMessages(locale)

export function App() {
  return (
    <TranslateProvider locale={locale} messages={messages}>
      <YourApp />
    </TranslateProvider>
  )
}
```

Your app owns Locale resolution. It can come from a cookie, route parameter, request header, or any other application-level source.

## Fill missing Locale values

Local mode can call any async translation function during development:

```ts
import { createAiTranslate } from "better-translation/ai"
import { betterTranslation } from "better-translation/vite"

betterTranslation({
  locales: ["en", "es", "fr"],
  defaultLocale: "en",
  runtime: {
    type: "local",
    translate: createAiTranslate({
      prompt: "Use concise product UI copy.",
    }),
  },
})
```

You can also provide your own `translate(messages, locale)` implementation. Better Translation does not require a particular model or translation provider.

Run the standalone generator whenever you want to refresh local Runtime bundles without starting the dev server:

```bash
npx better-translation generate
```

## Local editor

Enable the dev-only editor to search Messages and edit local Locale values in the browser:

```ts
betterTranslation({
  locales: ["en", "es", "fr"],
  defaultLocale: "en",
  runtime: {
    type: "local",
    editor: true,
  },
})
```

It is served by Vite at `/__better-translation` during development and is excluded from production builds.

## Documentation and examples

- [Quick start](https://docs.better-translation.dev/)
- [How the Vite plugin works](https://docs.better-translation.dev/how-it-works)
- [Local mode](https://docs.better-translation.dev/local-mode)
- [React and TanStack Start example](https://github.com/NoQuarterTeam/better-translation/tree/main/examples/tanstack-start)
- [SvelteKit example](https://github.com/NoQuarterTeam/better-translation/tree/main/examples/svelte-kit)
- [Portable Agent Skill](https://docs.better-translation.dev/agent-skill)

## License

MIT
