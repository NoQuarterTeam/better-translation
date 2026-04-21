# `better-translation`

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
- `react >= 19` if you use the React helpers from `better-translation/react`

## Installation

Install the package:

```bash
bun add better-translation
```

```bash
pnpm add better-translation
```

```bash
npm install better-translation
```

```bash
yarn add better-translation
```

If you are using the React helpers, make sure `react` is installed in your app.

## What It Does

At build time and during dev, the plugin:

1. Scans all matching files under your configured roots for translation markers such as `t("...")`, `<T>...</T>`, and `msg("id")\`...\``.
2. Extracts the default message, placeholders, source locations, and optional context.
3. Generates a stable message id for each entry.
4. Writes locale JSON files for every configured locale.
5. In dev, it can call your custom `translate(messages, locale)` function for missing non-default translations.
6. Stores translated results in a cache file so unchanged messages do not need to be translated again.

## Quick Start

```ts
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { betterTranslate } from "better-translation/vite"

export default defineConfig({
  plugins: [
    betterTranslate({
      locales: ["en", "nl", "fr", "es"],
      defaultLocale: "en",
      storage: { type: "bundle", output: "src/lib/bt" },
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

With bundle storage enabled, the plugin writes files such as:

```text
src/lib/bt/locales/en.json
src/lib/bt/locales/nl.json
src/lib/bt/locales/fr.json
src/lib/bt/locales/es.json
src/lib/bt/manifest.json
```

## Basic Configuration

```ts
betterTranslate({
  locales: ["en", "nl"],
  defaultLocale: "en",
  rootDir: "src",
  cacheFile: ".cache/better-translation.json",
  logging: true,
  storage: {
    type: "bundle",
    output: "src/lib/bt",
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
".cache/better-translation.json"
```

#### `logging`

Enables plugin logging.

#### `rootDir`

Controls which source directory or directories the plugin looks in for messages.

```ts
rootDir: "src"
```

Default: `"src"`

You can also pass multiple directories:

```ts
rootDir: ["src", "app"]
```

#### `storage`

Controls where locale runtime data comes from.

```ts
storage: {
  type: "bundle",
  output: "src/lib/bt",
}
```

`bundle` uses editable locale JSON files from the configured directory and expects your server build to include that directory for runtime loading.

`remote` exists in the API, but remote sync and remote runtime fetching are currently stubs, so bundle storage is the recommended setup right now.

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
import { useT } from "better-translation/react"

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
import { T } from "better-translation/react"

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
import { createTranslator, v } from "better-translation/server"

const { msg } = createTranslator(messages)

const subject = msg("invite-email-subject")`You were invited to ${v("organization", organization.name)}`
```

The tagged template id is explicit, which is useful for emails and server-rendered content.

## Passing Variables Into Translations

### In React with `<Var>`

```tsx
import { T, Var } from "better-translation/react"

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
import { createTranslator, v } from "better-translation/server"

const { msg } = createTranslator(messages)

const body = msg("welcome-email")`Welcome back, ${v("name", user.name)}`
```

## Loading Messages for a Locale

How you load messages depends on your deployment setup.

The first argument is a single locale code. You do not pass the whole `locales` array here.

The full list of supported locales belongs in the plugin config:

```ts
betterTranslate({
  locales: ["en", "nl", "fr"],
  defaultLocale: "en",
  storage: { type: "bundle", output: "src/lib/bt" },
})
```

### Server Runtime

The plugin generates a typed `load-messages.ts` next to your locale JSON files. Import it directly from your server code:

```ts
import { loadMessages } from "@/lib/bt/load-messages"

const messages = await loadMessages("nl")
```

`loadMessages` statically imports each locale JSON file, so bundlers tree-shake unused locales and runtime lookups stay cheap.

### Client-Side Fetch From `public/` Or A CDN

If your app does not have a server runtime, or you want to load translations directly in the browser, fetch the locale JSON yourself and pass the result to `TranslateProvider`.

You do not need a special browser loader from this package. `TranslateProvider` only needs a flat `Record<string, string>`.

If you publish your locale files under `public/locales`, you can fetch them like this:

```tsx
import { useEffect, useState } from "react"

import { TranslateProvider } from "better-translation/react"

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
import { TranslateProvider } from "better-translation/react"

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
import { useT } from "better-translation/react"

function SubmitButton() {
  const t = useT()
  return <button>{t("Save changes")}</button>
}
```

### `useMessages()`

Returns the raw flattened message map from the current provider.

```tsx
import { useMessages } from "better-translation/react"

function DebugMessages() {
  const messages = useMessages()
  return <pre>{JSON.stringify(messages, null, 2)}</pre>
}
```

### `T`

Renders translated JSX content.

```tsx
import { T } from "better-translation/react"

function EmptyState() {
  return <T>No projects yet</T>
}
```

### `Var`

Marks placeholder content inside `T`.

```tsx
import { T, Var } from "better-translation/react"

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
import { betterTranslate } from "better-translation/vite"

export default {
  plugins: [
    betterTranslate({
      locales: ["en", "nl"],
      defaultLocale: "en",
      storage: { type: "bundle", output: "src/lib/bt" },
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

For `storage: { type: "bundle" }`, production builds are check-only. They never call `translate()` and never regenerate locale artifacts. Instead, they validate the committed locale JSON files and committed generated helper files, then fail the build if anything is missing or out of sync.

## Server-Side Helpers

### `loadMessages()`

The plugin generates `load-messages.ts` next to your locale JSON files. Import it directly:

```ts
import { loadMessages } from "@/lib/bt/load-messages"

const messages = await loadMessages("en")
```

It statically imports each locale JSON file and returns the flattened message map.

### `createTranslator()`

Creates lightweight server helpers:

```ts
import { createTranslator } from "better-translation/server"

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
import { v } from "better-translation/server"

v("name", user.name)
```

## Locale File Shape

With bundle storage, each runtime locale file is a flat message map:

```json
{
  "m_hd339n": "Inloggen"
}
```

It also keeps a private metadata manifest at `locales/manifest.json`:

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

For bundle storage, the plugin also writes runtime metadata at `src/lib/bt/runtime.json` and a generated `load-messages.ts` for consuming locales on the server.

## Important Notes

- `t()` only extracts static string literals.
- `<T>` only extracts static text plus `<Var someName={value} />` placeholders or `<Var>{identifier}</Var>` shorthand.
- `msg("id")\`...\``only extracts templates that use`v("name", value)` placeholders.
- Missing translations can fall back to the source text in dev while locale JSON files are being filled.
- In local mode, locale JSON files are committed in the repo and loaded one locale at a time.
- Client-only apps can fetch locale JSON from `public/` or a CDN and pass the result directly to `TranslateProvider`.
- The generated `load-messages.ts` is typed with an `AppLocale` union and statically imports each locale JSON so bundlers tree-shake unused locales.
- In local mode, production builds are check-only and fail if committed locale artifacts are missing or out of sync.
- Remote storage is not fully implemented yet, so bundle storage is the recommended path for now.

## Example Flow

1. Add the plugin to `vite.config.ts`.
2. Configure `locales`, `defaultLocale`, and bundle storage.
3. Mark text with `t()`, `<T>`, or `msg()`.
4. Load one locale with `loadMessages(locale)` from the generated `load-messages.ts` or fetch the locale JSON in the browser.
5. Wrap your UI in `TranslateProvider`.
6. Use `useT()`, `T`, `Var`, `createTranslator()`, and `msg()` where appropriate.
7. Let the plugin write locale JSON files in dev and call your custom translator for missing entries.

## Step-By-Step: How It Works

This is the full local-storage flow from source code to translated UI.

### 1. You configure the plugin

You add `betterTranslate(...)` to your Vite config and tell it:

- which locales exist
- which locale is the default source language
- which roots and file extensions should be scanned
- where locale files should be written
- whether missing translations should be auto-filled with `translate()`

### 2. The plugin scans all matching files under your configured roots

At startup, the plugin walks every matching file under the configured scan roots, not just files that Vite has already loaded into the module graph.

That gives it a complete view of:

- every extracted message id
- every default message
- every placeholder list
- every source location

This full scan is what lets the plugin build a stable manifest for the whole app instead of only the currently visited route.

### 3. It extracts messages from translation markers

The extractor looks for:

- `t("...")` and similar configured call markers
- `<T>...</T>` JSX blocks
- `msg("id")\`...\`` tagged templates

For each match it records:

- the message id
- the source-language text
- optional context
- placeholder names
- source file and location metadata

For static `<T>` elements, the plugin also injects an `id="..."` attribute into the source so runtime does not need to re-derive the id every time.

### 4. It builds an in-memory manifest

All extracted messages are grouped into a manifest keyed by message id.

Each manifest entry stores the canonical shape of that message:

- `defaultMessage`
- `meta`
- `placeholders`
- `sources`

If two different messages collide onto the same id but do not have the same shape, the plugin throws an error instead of silently picking one.

### 5. It writes generated helper files

In local mode, the plugin writes a few generated files alongside your locales:

- `manifest.json`: private metadata manifest
- `runtime.json`: runtime config for locale loading
- `load-messages.ts`: typed loader that imports each locale JSON file
- `.gitignore`: ignores the private manifest

These files are only rewritten when their contents actually change.

### 6. It writes locale JSON files

For each configured locale, the plugin writes a flat `Record<string, string>` JSON file.

- For the default locale, values always come from the current source text.
- For non-default locales, existing committed translations are preserved.
- If a translation is not present in the locale file, the plugin can fall back to the cache.

In dev, existing locale entries are preserved so partial rescans or incremental changes do not wipe translations from disk.

### 7. It optionally auto-translates missing entries in dev

If you provide `translate(messages, locale)`, the plugin collects only the missing entries for non-default locales and sends them to your callback.

The callback receives:

- stable `id`
- source `text`
- optional `meta.context`
- `placeholders`
- `sources`

The returned translations are stored in the cache and then written back into the locale JSON files.

### 8. It caches translations between runs

The cache file stores translations keyed by message id plus locale.

That means unchanged messages do not need to be translated again across restarts, as long as:

- the message id is unchanged
- the locale is unchanged
- the cache schema is still valid

### 9. It keeps the manifest in sync during dev

When a file is added, changed, or removed under the scan roots, the plugin rescans that file and updates the manifest.

- If the actual message content changed, locale files are updated.
- If only source locations changed, the private manifest is updated.
- If a file is temporarily invalid and cannot be parsed, the plugin skips removing its previous messages instead of treating that as a deletion.

This makes dev behavior much less destructive during normal editing.

### 10. Your app loads one locale at runtime

At runtime, your app loads a single locale's message map.

The common local-mode path is:

1. Call `loadMessages(locale)`.
2. Receive a flat `Record<string, string>`.
3. Pass that object into `TranslateProvider`.
4. Read translations with `useT()`, `T`, or the server helpers.

### 11. Runtime lookups are just id lookups

Once messages are loaded, translation is a plain lookup:

- `useT()` hashes the source text plus optional context into the deterministic message id and looks it up in the loaded map.
- `<T>` uses its explicit injected id when present, or computes the same deterministic id from its static source content.
- `createTranslator()` on the server looks up ids in the same flat message map.

Because ids are deterministic, unchanged source text resolves to the same key across restarts.

### 12. Production local builds are check-only

For `storage: { type: "bundle" }`, production builds do not call `translate()` and do not rewrite locale artifacts.

Instead, the plugin:

1. rebuilds the manifest from source
2. checks that committed generated files such as `runtime.json` and `load-messages.ts` are present and up to date
3. checks that every committed locale file exists
4. checks that every locale file has the expected ids
5. checks that the default locale still matches the current source text
6. fails the build if anything is missing, stale, or orphaned

The private `manifest.json` is still generated for dev/debugging, but it is not required to be committed for production builds.

That keeps production behavior predictable: either the committed locale artifacts are correct, or the build stops.
