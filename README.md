# `better-translation`

Vite plugin and runtime helpers for extracting UI copy, generating locale JSON files, and rendering translations in React and server code.

It scans your source for translation markers, creates stable message ids, keeps locale JSON files in sync, and lets you plug in your own translation pipeline.

## Features

- Extracts messages from function calls and React components
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

1. Scans all matching files under your configured roots for translation markers such as `t("...", values?, options?)` and `<T>...</T>`.
2. Extracts the default message, placeholders, source locations, and optional context.
3. Generates a stable message id for each entry.
4. Writes locale JSON files for every configured locale.
5. In dev, it can call your custom `translate(messages, locale)` function for missing non-default translations.
6. Stores translated results in a cache file so unchanged messages do not need to be translated again.

## Quick Start

```ts
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { createAiTranslate } from "better-translation/ai"
import { betterTranslation } from "better-translation/vite"

export default defineConfig({
  plugins: [
    betterTranslation({
      locales: ["en", "nl", "fr", "es"],
      defaultLocale: "en",
      runtime: {
        type: "local",
        target: "module",
        translate: createAiTranslate(),
      },
    }),
    react(),
  ],
})
```

With local module runtime enabled, the plugin writes files such as:

```text
src/lib/bt/locales/en.json
src/lib/bt/locales/nl.json
src/lib/bt/locales/fr.json
src/lib/bt/locales/es.json
src/lib/bt/manifest.json
```

## Basic Configuration

```ts
betterTranslation({
  locales: ["en", "nl"],
  defaultLocale: "en",
  rootDir: "src",
  cacheFile: ".cache/better-translation/cache.json",
  logging: true,
  runtime: {
    type: "local",
    target: "module",
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
".cache/better-translation/cache.json"
```

Remote offline development also writes temporary fallback Runtime bundles under `.cache/better-translation/runtime/`. The committed local runtime output remains separate.

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

#### `runtime`

Controls where locale runtime data lives and how the virtual loader reads it.

```ts
runtime: {
  type: "local",
  target: "module",
}
```

`local` writes editable locale JSON files into the app. Use `target: "module"` to write under `src/lib/bt` and load with Vite module imports. Use `target: "public"` to write under Vite's `publicDir` and load with fetch.

`remote` exists in the API, but remote sync and remote runtime fetching are currently stubs, so local runtime is the recommended setup right now.

The intended hosted workflow is branch-based. In remote mode, the hosted platform owns Locale values, the plugin syncs the Manifest during remote builds, and deployed apps read flat Runtime bundles for a Project, Branch, and Locale.

The planned remote config keeps the default simple:

```ts
runtime: {
  type: "remote",
  projectId: "acme",
  dev: {
    offline: false,
  },
}
```

With `offline: false`, local dev reads hosted branch Runtime bundles and uses the Platform translator to fill blank hosted values. Use `dev: { offline: true }` when local dev should avoid platform reads and writes.

#### `translate`

Async callback for filling missing local-mode translations. This belongs under local runtime config:

```ts
runtime: {
  type: "local",
  target: "module",
  translate: createAiTranslate(),
}
```

Remote mode does not use package-local `translate`; hosted translation runs through the Platform translator so Project-level model, tone, glossary, and billing settings are shared.

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

You can use the built-in AI translator to call any AI SDK model value. With no options, it defaults to a Vercel AI Gateway model string:

```ts
import { createAiTranslate } from "better-translation/ai"

betterTranslation({
  locales: ["en", "nl"],
  defaultLocale: "en",
  runtime: {
    type: "local",
    target: "module",
    translate: createAiTranslate({
      prompt: "Use friendly, concise product UI copy.",
    }),
  },
})
```

`createAiTranslate()` translates each missing message with its own model request and assigns the returned text directly to that message id. The optional `prompt` is the primary translation brief for product, tone, glossary, or domain guidance. Better Translation still adds a small output contract so the model returns only the translated text.

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
      <p>{t("Welcome back, {name}", { name: user.name })}</p>
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

### 3. Server Messages

Use this for server-side messages with placeholders.

```ts
import { createTranslator } from "better-translation/server"

const t = createTranslator(messages)

const subject = t("You were invited to {organization}", { organization: organization.name })
```

The message text is the source of truth, just like `t()` and the React helpers.

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

### On the Server with `t()`

```ts
import { createTranslator } from "better-translation/server"

const t = createTranslator(messages)

const body = t("Welcome back, {name}", { name: user.name })
```

## Loading Messages for a Locale

How you load messages depends on your deployment setup.

The first argument is a single locale code. You do not pass the whole `locales` array here.

The full list of supported locales belongs in the plugin config:

```ts
betterTranslation({
  locales: ["en", "nl", "fr"],
  defaultLocale: "en",
  runtime: { type: "local", target: "module" },
})
```

### Virtual Runtime Loader

The Vite plugin provides a virtual module with the configured locales and the right loader for your runtime target:

```ts
import { loadMessages, locales } from "better-translation/messages"

const messages = await loadMessages(locale)
```

For `runtime: { type: "local", target: "module" }`, the virtual loader uses Vite module imports. For `target: "public"`, it fetches JSON from Vite public assets.

### Client-Side Fetch From Public Files

If your app does not have a server runtime, or you want to load translations directly in the browser, use public runtime:

```ts
betterTranslation({
  locales: ["en", "nl", "fr"],
  runtime: { type: "local", target: "public" },
})
```

The same virtual import fetches `/bt/locales/{locale}.json` by default:

```tsx
import { useEffect, useState } from "react"

import { loadMessages } from "better-translation/messages"
import { TranslateProvider } from "better-translation/react"

export function App({ locale }: { locale: string }) {
  const [messages, setMessages] = useState<Record<string, string> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const nextMessages = await loadMessages(locale)
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

You can also interpolate placeholders directly:

```tsx
const t = useT()

t("Welcome back, {name}", { name: user.name })
t("Archive", { context: "verb" })
t("Moved {count} files", { count: total }, { context: "Bulk action toast" })
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
import { betterTranslation } from "better-translation/vite"

export default {
  plugins: [
    betterTranslation({
      locales: ["en", "nl"],
      defaultLocale: "en",
      runtime: {
        type: "local",
        target: "module",
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

### Built-in AI Translator

Use `createAiTranslate()` from `better-translation/ai` if you want Better Translation to fill missing locale entries through an LLM:

```ts
import { createAiTranslate } from "better-translation/ai"
import { betterTranslation } from "better-translation/vite"

export default {
  plugins: [
    betterTranslation({
      locales: ["en", "nl"],
      defaultLocale: "en",
      runtime: {
        type: "local",
        target: "module",
        translate: createAiTranslate({
          model: "openai/gpt-5.5",
          prompt: "Use short, friendly SaaS product copy.",
        }),
      },
    }),
  ],
}
```

By default it uses Vercel AI Gateway with `model: "openai/gpt-5.5"`. Configure whatever auth that model/provider needs in your environment. The `model` option is passed straight through to the AI SDK, so you can also provide a provider model object yourself:

```ts
import { openai } from "@ai-sdk/openai"
import { createAiTranslate } from "better-translation/ai"

createAiTranslate({
  model: openai("gpt-4.1-mini"),
})
```

Options:

- `model`: Any AI SDK `model` value. Defaults to the Vercel AI Gateway model string `"openai/gpt-5.5"`.
- `prompt`: Primary translation brief for product, tone, glossary, or domain instructions.
- `temperature`: Optional model temperature.

Each AI request returns plain translated text for one source message. Better Translation maps that response to the current message id itself, so the model does not need to echo ids or return a JSON object. If the model returns an empty translation, Better Translation falls back to the source text.

For `runtime: { type: "local" }`, production builds are check-only. They never call `translate()` and never regenerate locale artifacts. Instead, they validate the committed locale JSON files and generated metadata, then fail the build if anything is missing or out of sync.

## Hosted Platform Direction

The local runtime is the working package flow today. The hosted platform direction is different:

- A Project is created explicitly in the hosted service.
- Remote builds sync the current Manifest to a Branch, usually resolved from the deploy branch.
- Branches are automatic and can represent `main`, `develop`, or PR branches.
- The hosted platform owns Locale values in remote mode.
- The dashboard edits branch-local Locale values.
- The public Runtime bundle is a flat `Record<string, string>` for one Project, Branch, and Locale.
- Missing non-default values fall back to the Default locale text in the Runtime bundle.
- Local dev reads hosted Runtime bundles by default in remote mode.
- Local dev can opt out of platform reads and writes with `dev.offline: true`.
- Platform translator requests fill blank branch values using Project-level AI settings and must never overwrite manual edits.

Remote runtime URLs are expected to be branch-addressed:

```text
/projects/:projectId/branches/:branch/locales/:locale.json
```

In remote mode, package-local `translate(messages, locale)` is not the canonical source for hosted Locale values. It remains the local-mode translation hook; hosted AI translation should run through the platform so Project-level model, tone, glossary, and billing settings are shared.

## Server-Side Helpers

### `createTranslator()`

Creates a lightweight server translator:

```ts
import { createTranslator } from "better-translation/server"

const t = createTranslator(messages)
```

Use `t()` for plain strings:

```ts
const errorMessage = t("Could not sign in")
```

It also handles server-side messages with optional placeholders:

```ts
const sentence = t("You were invited to {organization}", { organization: organization.name })
```

## Locale File Shape

With local runtime, each runtime locale file is a flat message map:

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

For local runtime, the plugin also writes runtime metadata at `src/lib/bt/runtime.json`.

## Important Notes

- `t()` only extracts static string literals as its first argument and derives placeholders from `{name}` segments in that message.
- `<T>` only extracts static text plus `<Var someName={value} />` placeholders or `<Var>{identifier}</Var>` shorthand.
- Missing translations can fall back to the source text in dev while locale JSON files are being filled.
- In local mode, locale JSON files are committed in the repo, loaded one locale at a time, and regenerated to match the current manifest exactly.
- Client-only apps can fetch locale JSON from `public/` or a CDN and pass the result directly to `TranslateProvider`.
- In local mode, production builds are check-only and fail if committed locale artifacts are missing or out of sync.
- Remote runtime is not fully implemented yet, so local runtime is the recommended path for now.

## Example Flow

1. Add the plugin to `vite.config.ts`.
2. Configure `locales`, `defaultLocale`, and local runtime.
3. Mark text with `t()` or `<T>`.
4. Load one locale by importing or fetching the generated locale JSON.
5. Wrap your UI in `TranslateProvider`.
6. Use `useT()`, `T`, `Var`, and `createTranslator()` where appropriate.
7. Let the plugin write locale JSON files in dev and call your custom translator for missing entries.

## Step-By-Step: How It Works

This is the full local-storage flow from source code to translated UI.

### 1. You configure the plugin

You add `betterTranslation(...)` to your Vite config and tell it:

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

- `t("...", values?, options?)` and similar configured call markers
- `<T>...</T>` JSX blocks

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

### 5. It writes generated metadata files

In local mode, the plugin writes a few generated metadata files alongside your locales:

- `manifest.json`: private metadata manifest
- `runtime.json`: runtime config for locale loading
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

1. Import or fetch the generated locale JSON for the active locale.
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

For `runtime: { type: "local" }`, production builds do not call `translate()` and do not rewrite locale artifacts.

Instead, the plugin:

1. rebuilds the manifest from source
2. checks that committed generated metadata such as `runtime.json` is present and up to date
3. checks that every committed locale file exists
4. checks that every locale file has the expected ids
5. checks that the default locale still matches the current source text
6. fails the build if anything is missing, stale, or orphaned

The private `manifest.json` is still generated for dev/debugging, but it is not required to be committed for production builds.

That keeps production behavior predictable: either the committed locale artifacts are correct, or the build stops. During dev regeneration, orphaned ids are pruned from local locale files automatically so stale keys do not accumulate between builds.
