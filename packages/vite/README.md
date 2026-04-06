# `@better-translate/vite`

Vite plugin and runtime helpers for extracting UI copy, generating locale JSON files, and rendering translations in React and server code.

It scans your source for translation markers, creates stable message ids, keeps locale JSON files in sync, and lets you plug in your own translation pipeline.

## Features

- Extracts messages from function calls, React components, and tagged templates
- Generates stable message ids from the source text and optional context
- Writes locale JSON files for every configured locale
- Supports a custom async `translate()` function for auto-filling missing translations
- Caches translated results to avoid re-translating unchanged messages
- Includes React helpers for providers, hooks, and JSX interpolation
- Includes server helpers for loading messages and translating templates

## Requirements

- `node >= 24`
- `vite >= 8`
- `react >= 19` if you use the React helpers from `@better-translate/vite/react`

## Installation

Install the plugin as a dev dependency:

```bash
bun add -d @better-translate/vite
```

```bash
pnpm add -D @better-translate/vite
```

```bash
npm install -D @better-translate/vite
```

```bash
yarn add -D @better-translate/vite
```

If you are using the React helpers, make sure `react` is installed in your app.

## What It Does

At build time and during dev, the plugin:

1. Scans your source files for translation markers such as `t("...")`, `<T>...</T>`, and `msg("id")\`...\``.
2. Extracts the default message, placeholders, source locations, and optional context.
3. Generates a stable message id for each entry.
4. Writes locale JSON files for every configured locale.
5. In dev, it can call your custom `translate(messages, locale)` function for missing non-default translations.
6. Stores translated results in a cache file so unchanged messages do not need to be translated again.

## Quick Start

```ts
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { betterTranslatePlugin } from "@better-translate/vite"

export default defineConfig({
  plugins: [
    betterTranslatePlugin({
      locales: ["en", "nl", "fr", "es"],
      defaultLocale: "en",
      storage: { type: "local", dir: "locales" },
      scan: { roots: ["src"] },
      async translate(messages, locale) {
        const result: Record<string, string> = {}

        for (const message of messages) {
          result[message.id] = await translateWithYourService({
            text: message.text,
            locale,
            context: message.meta.context,
            placeholders: message.placeholders,
          })
        }

        return result
      },
    }),
    react(),
  ],
})
```

With local storage enabled, the plugin writes files such as:

```text
locales/en.json
locales/nl.json
locales/fr.json
locales/es.json
locales/.bt-manifest.json
```

## Basic Configuration

```ts
betterTranslatePlugin({
  locales: ["en", "nl"],
  defaultLocale: "en",
  cacheFile: ".cache/better-translate.json",
  logging: true,
  scan: {
    roots: ["src"],
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },
  storage: {
    type: "local",
    dir: "locales",
  },
})
```

### Options

#### `locales`

All locale codes the plugin should generate files for.

```ts
locales: ["en", "nl", "fr"]
```

#### `defaultLocale`

The source locale. Messages in this locale always use the original source text.

```ts
defaultLocale: "en"
```

#### `cacheFile`

Where translated results are cached between runs.

Default:

```ts
".cache/better-translate.json"
```

#### `logging`

Enables plugin logging.

#### `scan`

Controls where the plugin looks for messages.

```ts
scan: {
  roots: ["src"],
  extensions: [".ts", ".tsx", ".js", ".jsx"],
}
```

#### `storage`

Controls where locale runtime data comes from.

```ts
storage: {
  type: "local",
  dir: "locales",
}
```

`local` uses editable locale JSON files from the configured directory and expects your server build to include that directory for runtime loading.

`hosted` exists in the API, but hosted sync and hosted runtime fetching are currently stubs, so local storage is the recommended setup right now.

#### `markers`

Lets you rename the extraction markers if your app uses different names.

```ts
markers: {
  call: ["t"],
  component: ["T"],
  taggedTemplate: ["msg"],
}
```

Defaults:

- `call`: `["t", "useT"]`
- `component`: `["T"]`
- `taggedTemplate`: `["msg"]`

#### `translate`

Async callback for filling missing translations.

```ts
type TranslateFn = (
  messages: Array<{
    id: string
    text: string
    meta: { context?: string }
    placeholders: string[]
    sources: Array<{
      file: string
      kind: "call" | "component" | "tagged-template"
      marker: string
      line: number
      column: number
      endLine: number
      endColumn: number
      start: number
      end: number
    }>
  }>,
  locale: string,
) => Promise<Record<string, string>>
```

Return a map keyed by `message.id`.

If a message id is missing from the returned object, the plugin falls back to the source text for that entry.

## How To Translate Text

The plugin extracts three kinds of translation markers.

### 1. Function Calls

Use this for labels, validation messages, errors, button text passed as props, and other non-JSX values.

```tsx
import { useT } from "@better-translate/vite/react"

function SignInForm() {
  const t = useT()

  return (
    <>
      <input aria-label={t("Email")} />
      <button>{t("Sign in")}</button>
      <p>{t("Could not sign in", { context: "Authentication error toast" })}</p>
    </>
  )
}
```

### 2. `<T>` Component

Use this when the translated text lives directly in JSX.

```tsx
import { T } from "@better-translate/vite/react"

export function Header() {
  return (
    <>
      <h1>
        <T>Sign in</T>
      </h1>
      <p>
        <T context="Sign-in page helper copy">Enter your email and password to continue.</T>
      </p>
    </>
  )
}
```

For static `<T>` content, the plugin injects a stable hashed `id` at build time so runtime can skip re-hashing the source text.

You can also provide an explicit id yourself:

```tsx
<T id="auth.sign-in.title">Sign in</T>
```

### 3. Tagged Templates on the Server

Use this for server-side template strings with placeholders.

```ts
import { createTranslator, v } from "@better-translate/vite/server"

const { msg } = createTranslator(messages)

const subject = msg("invite-email-subject")`You were invited to ${v("organization", organization.name)}`
```

The tagged template id is explicit, which is useful for emails and server-rendered content.

## Passing Variables Into Translations

### In React with `<Var>`

```tsx
import { T, Var } from "@better-translate/vite/react"

function WelcomeMessage({ userName }: { userName: string }) {
  return (
    <T>
      Welcome back, <Var userName={userName} />
    </T>
  )
}
```

That extracts the default message:

```text
Welcome back, {userName}
```

For plain identifiers, the shorthand `<Var>{userName}</Var>` also works and is normalized at build time.

### On the Server with `v()`

```ts
import { createTranslator, v } from "@better-translate/vite/server"

const { msg } = createTranslator(messages)

const body = msg("welcome-email")`Welcome back, ${v("name", user.name)}`
```

## Loading Messages for a Locale

How you load messages depends on your deployment setup.

The first argument is a single locale code. You do not pass the whole `locales` array here.

The full list of supported locales belongs in the plugin config:

```ts
betterTranslatePlugin({
  locales: ["en", "nl", "fr"],
  defaultLocale: "en",
  storage: { type: "local", dir: "locales" },
})
```

### Server Runtime

If your server needs one locale at a time, load it with `getMessages(locale)`.

The helper reads generated runtime metadata automatically, and when the Vite plugin is active it also uses an internal virtual module so app code does not need any manual `import.meta.glob(...)` wiring:

```ts
import { getMessages } from "@better-translate/vite/server"

const messages = await getMessages("nl")
```

If needed, you can still override the storage settings explicitly:

```ts
const messages = await getMessages("nl", {
  storage: { type: "local", dir: "locales" },
})
```

For local storage, `getMessages()` prefers the plugin's bundled virtual-module payload and falls back to the locale JSON files on disk when needed.

### Nitro Runtime

For Nitro, the recommended setup is to emit locale files into `assets/locales`, which Nitro bundles by default:

```ts
import { nitro } from "nitro/vite"
import { betterTranslatePlugin } from "@better-translate/vite"

export default {
  plugins: [
    betterTranslatePlugin({
      locales: ["en", "nl", "fr"],
      defaultLocale: "en",
      storage: { type: "local", dir: "assets/locales" },
    }),
    nitro(),
  ],
}
```

Then load messages with the Nitro helper:

```ts
import { getNitroMessages } from "@better-translate/vite/nitro"

const messages = await getNitroMessages("nl")
```

If you prefer a custom directory, keep your locale files wherever you want, register that directory with Nitro `serverAssets`, and pass the custom mount name to `getNitroMessages()`:

```ts
nitro({
  serverAssets: [{ baseName: "locales", dir: "./locales", pattern: "*.json" }],
})
```

```ts
const messages = await getNitroMessages("nl", { mount: "locales" })
```

Typical sources for that locale are:

- route params
- search params
- cookies
- headers
- session data

Example:

```ts
import { createServerFn } from "@tanstack/react-start"
import { getNitroMessages } from "@better-translate/vite/nitro"

export const getTranslateMessagesFn = createServerFn({ method: "GET" }).handler(async () => {
  const locale = "nl"

  return getNitroMessages(locale)
})
```

### Client-Side Fetch From `public/` Or A CDN

If your app does not have a server runtime, or you want to load translations directly in the browser, fetch the locale JSON yourself and pass the result to `TranslateProvider`.

You do not need a special browser loader from this package. `TranslateProvider` only needs a flat `Record<string, string>`.

If you publish your locale files under `public/locales`, you can fetch them like this:

```tsx
import { useEffect, useState } from "react"

import { TranslateProvider } from "@better-translate/vite/react"

export function App({ locale }: { locale: string }) {
  const [messages, setMessages] = useState<Record<string, string> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const response = await fetch(`/locales/${locale}.json`)
      const nextMessages = (await response.json()) as Record<string, string>
      if (!cancelled) setMessages(nextMessages)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [locale])

  if (!messages) return null

  return (
    <TranslateProvider messages={messages}>
      <Routes />
    </TranslateProvider>
  )
}
```

If your locale files are hosted on a CDN, use the same pattern with an absolute URL:

```ts
const response = await fetch(`https://cdn.example.com/locales/${locale}.json`)
const messages = (await response.json()) as Record<string, string>
```

This browser-fetch approach also works in full-stack apps when you prefer serving locale files as static assets instead of loading them on the server.

## Using The React Components And Hooks

### `TranslateProvider`

Wrap the part of your app that needs translations.

```tsx
import { TranslateProvider } from "@better-translate/vite/react"

export function App({ messages }: { messages: Record<string, string> }) {
  return (
    <TranslateProvider messages={messages}>
      <Routes />
    </TranslateProvider>
  )
}
```

### `useT()`

Returns a translation function for non-JSX values.

```tsx
import { useT } from "@better-translate/vite/react"

function SubmitButton() {
  const t = useT()
  return <button>{t("Save changes")}</button>
}
```

### `useMessages()`

Returns the raw flattened message map from the current provider.

```tsx
import { useMessages } from "@better-translate/vite/react"

function DebugMessages() {
  const messages = useMessages()
  return <pre>{JSON.stringify(messages, null, 2)}</pre>
}
```

### `T`

Renders translated JSX content.

```tsx
import { T } from "@better-translate/vite/react"

function EmptyState() {
  return <T>No projects yet</T>
}
```

### `Var`

Marks placeholder content inside `T`.

```tsx
import { T, Var } from "@better-translate/vite/react"

function InviteMessage({ count }: { count: number }) {
  return (
    <T>
      You have <Var count={count} /> pending invites
    </T>
  )
}
```

## Custom Translation Function

The plugin calls your `translate(messages, locale)` callback only in dev, and only for missing translations in non-default locales.

Each message includes:

- `id`: stable key for the locale file
- `text`: source-language text
- `meta.context`: optional translator context
- `placeholders`: placeholder names such as `["name"]`
- `sources`: source file and location metadata

Example using your own API:

```ts
import { betterTranslatePlugin } from "@better-translate/vite"

export default {
  plugins: [
    betterTranslatePlugin({
      locales: ["en", "nl"],
      defaultLocale: "en",
      storage: { type: "local", dir: "locales" },
      async translate(messages, locale) {
        const response = await fetch("https://your-translator.example.com/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locale,
            messages: messages.map((message) => ({
              id: message.id,
              text: message.text,
              context: message.meta.context,
              placeholders: message.placeholders,
            })),
          }),
        })

        const data = (await response.json()) as { translations: Record<string, string> }
        return data.translations
      },
    }),
  ],
}
```

Guidelines for a good custom translator:

- Preserve placeholders exactly, such as `{name}`.
- Use `message.meta.context` when tone or meaning is ambiguous.
- Return translations keyed by `message.id`.
- Return plain strings only.
- Keep translations deterministic when possible so the cache stays useful.

For `storage: { type: "local" }`, production builds never call `translate()`. They validate the committed locale JSON files and fail the build if any non-default locale entry is missing.

## Server-Side Helpers

### `getMessages()`

Loads the flattened message map for one locale:

```ts
import { getMessages } from "@better-translate/vite/server"

const messages = await getMessages("en")
```

By default, `getMessages()` reads the runtime metadata emitted by the plugin, then loads the matching locale through the plugin's internal virtual module when available, with a filesystem fallback for non-Vite runtime contexts.

### `getNitroMessages()`

Loads the flattened message map for one locale from Nitro server assets:

```ts
import { getNitroMessages } from "@better-translate/vite/nitro"

const messages = await getNitroMessages("en")
```

Use `storage: { type: "local", dir: "assets/locales" }` in your plugin config for the default Nitro path.

### `createTranslator()`

Creates lightweight server helpers:

```ts
import { createTranslator } from "@better-translate/vite/server"

const { t, msg } = createTranslator(messages)
```

Use `t()` for plain strings:

```ts
const errorMessage = t("Could not sign in")
```

Use `msg()` for template messages with placeholders:

```ts
const sentence = msg("account-invite")`You were invited to ${v("organization", organization.name)}`
```

### `v()`

Marks placeholder values for `msg()`:

```ts
import { v } from "@better-translate/vite/server"

v("name", user.name)
```

## Locale File Shape

With local storage, each runtime locale file is a flat message map:

```json
{
  "m_hd339n": "Inloggen"
}
```

It also keeps a private metadata manifest at `locales/.bt-manifest.json`:

```json
{
  "m_hd339n": {
    "defaultMessage": "Sign in",
    "meta": {
      "context": "The main login page header"
    },
    "placeholders": [],
    "sources": [
      {
        "file": "src/routes/sign-in.tsx",
        "kind": "component",
        "marker": "T",
        "line": 12,
        "column": 5,
        "endLine": 12,
        "endColumn": 30,
        "start": 123,
        "end": 148
      }
    ]
  }
}
```

For local storage, the plugin also writes runtime metadata for server helpers at `locales/.bt-runtime.json`.

At runtime, `getMessages()` returns the flat locale map through the plugin's bundled virtual module when available, with filesystem fallback support, and `getNitroMessages()` reads the same shape from Nitro server assets.

## Important Notes

- `t()` only extracts static string literals.
- `<T>` only extracts static text plus `<Var someName={value} />` placeholders or `<Var>{identifier}</Var>` shorthand.
- `msg("id")\`...\``only extracts templates that use`v("name", value)` placeholders.
- Missing translations can fall back to the source text in dev while locale JSON files are being filled.
- In local mode, locale JSON files are committed in the repo and loaded one locale at a time.
- Client-only apps can fetch locale JSON from `public/` or a CDN and pass the result directly to `TranslateProvider`.
- `getMessages()` reads generated runtime metadata so you usually do not need to repeat the locale directory in server code, and it bundles cleanly into Vite SSR builds without app-side glob imports.
- For Nitro, the simplest setup is `storage: { type: "local", dir: "assets/locales" }` plus `getNitroMessages()`.
- Custom Nitro directories still work through `serverAssets` and `getNitroMessages(..., { mount })`.
- In local mode, production builds fail if any non-default locale JSON entry is missing.
- Hosted storage is not fully implemented yet, so local storage is the recommended path for now.

## Example Flow

1. Add the plugin to `vite.config.ts`.
2. Configure `locales`, `defaultLocale`, and local storage.
3. Mark text with `t()`, `<T>`, or `msg()`.
4. Load one locale with `getMessages(locale)` on the server, `getNitroMessages(locale)` on Nitro, or fetch the locale JSON in the browser.
5. Wrap your UI in `TranslateProvider`.
6. Use `useT()`, `T`, `Var`, `createTranslator()`, and `msg()` where appropriate.
7. Let the plugin write locale JSON files in dev and call your custom translator for missing entries.
