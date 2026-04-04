# `@better-translate/vite`

Vite plugin and runtime helpers for extracting UI copy, generating locale files, and rendering translations in React and server code.

It scans your source for translation markers, creates stable message ids, keeps locale JSON files in sync, and lets you plug in your own translation pipeline.

## Features

- Extracts messages from function calls, React components, and tagged templates
- Generates stable message ids from the source text and optional context
- Writes locale files for every configured locale
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
4. Writes locale files for every configured locale.
5. Calls your custom `translate(messages, locale)` function for missing non-default translations.
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
locales/.better-translate-manifest.json
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

Controls where locale files come from.

```ts
storage: { type: "local", dir: "locales" }
```

`local` is the practical option today.

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
      <h1><T>Sign in</T></h1>
      <p><T context="Sign-in page helper copy">Enter your email and password to continue.</T></p>
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

Load messages with `getMessages(locale, options)`.

The first argument is a single locale code. You do not pass the whole `locales` array here.

The full list of supported locales belongs in the plugin config:

```ts
betterTranslatePlugin({
  locales: ["en", "nl", "fr"],
  defaultLocale: "en",
  storage: { type: "local", dir: "locales" },
})
```

At runtime, load one locale at a time:

```ts
import { getMessages } from "@better-translate/vite/server"

const messages = await getMessages("nl", {
  storage: { type: "local", dir: "locales" },
})
```

For local storage, `getMessages()` reads from the provided `dir`. If you omit it, it falls back to the conventional `locales` directory.

Typical sources for that locale are:

- route params
- search params
- cookies
- headers
- session data

Example:

```ts
import { createServerFn } from "@tanstack/react-start"
import { getMessages } from "@better-translate/vite/server"

export const getTranslateMessagesFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const locale = "nl"

    return getMessages(locale, {
      storage: { type: "local", dir: "locales" },
    })
  })
```

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

The plugin calls your `translate(messages, locale)` callback only for missing translations in non-default locales.

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

## Server-Side Helpers

### `getMessages()`

Loads the flattened message map for one locale:

```ts
import { getMessages } from "@better-translate/vite/server"

const messages = await getMessages("en", {
  storage: { type: "local", dir: "locales" },
})
```

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

It also keeps a private metadata manifest at `locales/.better-translate-manifest.json`:

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

At runtime, `getMessages()` returns the flat locale map directly. It also keeps backward compatibility with the older nested locale format.

## Important Notes

- `t()` only extracts static string literals.
- `<T>` only extracts static text plus `<Var someName={value} />` placeholders or `<Var>{identifier}</Var>` shorthand.
- `msg("id")\`...\`` only extracts templates that use `v("name", value)` placeholders.
- Missing translations fall back to the source text.
- In local mode, locale files are written to disk and also emitted into the Vite build output.
- Hosted storage is not fully implemented yet, so local storage is the recommended path for now.

## Example Flow

1. Add the plugin to `vite.config.ts`.
2. Configure `locales`, `defaultLocale`, and local storage.
3. Mark text with `t()`, `<T>`, or `msg()`.
4. Load one locale with `getMessages(locale, ...)`.
5. Wrap your UI in `TranslateProvider`.
6. Use `useT()`, `T`, `Var`, `createTranslator()`, and `msg()` where appropriate.
7. Let the plugin write locale files and call your custom translator for missing entries.
