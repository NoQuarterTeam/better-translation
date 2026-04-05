import { existsSync, readFileSync } from "node:fs"

import type {
  BetterTranslateRuntimeConfig,
  BetterTranslateStorageOptions,
  LocaleFile,
  RuntimeMessages,
  TranslateOptions,
} from "./types.js"

import { getCallMessageId } from "./message-id.js"
import {
  DEFAULT_LOCAL_OUTPUT_DIR,
  getLocalConfigCandidatePaths,
  getRootRuntimeConfigCandidatePaths,
  readRuntimeConfigFromPaths,
} from "./runtime-config.js"

/** A server-side placeholder value used by `msg()` template interpolation. */
export interface VarResult {
  /** Internal marker used to identify placeholder values. */
  __i18n: true
  /** Placeholder name used inside the translated template. */
  name: string
  /** Runtime value that should replace the placeholder. */
  value: unknown
}

/** Marks a value for replacement into a translated server-side template message. */
export function v(name: string, value: unknown): VarResult {
  return { __i18n: true, name, value }
}

const HOSTED_API_BASE_URL = "https://better-translate.com"
const PREFIX = "\x1b[36m[better-translation]\x1b[0m"
let warnedHostedStub = false

/** Options for loading locale messages on the server. */
export interface GetMessagesOptions {
  /** Optional storage override. When omitted, the helper reads generated runtime metadata. */
  storage?: BetterTranslateStorageOptions
}

/** Loads the flattened message map for a locale from the configured storage backend. */
export async function getMessages(
  locale: string,
  options?: GetMessagesOptions,
): Promise<Record<string, string>> {
  try {
    const runtimeConfig = readRuntimeConfig()
    const storage = resolveStorage(runtimeConfig, options?.storage)

    if (storage.type === "hosted") {
      const hostedMessages = await getHostedMessages(locale, storage.url ?? HOSTED_API_BASE_URL)
      if (hostedMessages) return hostedMessages
    }

    if (storage.type !== "local") return {}

    const dir = storage.dir ?? DEFAULT_LOCAL_OUTPUT_DIR
    for (const filePath of getLocaleCandidatePaths(dir, locale)) {
      if (!existsSync(filePath)) continue
      return normalizeMessages(JSON.parse(readFileSync(filePath, "utf-8")) as RuntimeMessages | LocaleFile)
    }

    return {}
  } catch (error) {
    console.error(`${PREFIX} Error loading messages for locale ${locale}:`, error)
    return {}
  }
}

async function getHostedMessages(locale: string, hostedUrl: string) {
  const apiKey = process.env.BETTER_TRANSLATE_API_KEY
  if (!apiKey) return null
  if (!warnedHostedStub) {
    warnedHostedStub = true
    console.log(`${PREFIX} \x1b[33mstub\x1b[0m hosted runtime fetch via \x1b[2m${hostedUrl}\x1b[0m not implemented yet`)
  }
  void locale
  return null
}

function getLocaleCandidatePaths(dir: string, locale: string) {
  return getLocalConfigCandidatePaths(dir, import.meta.url, `${locale}.json`)
}

function readRuntimeConfig() {
  return readRuntimeConfigFromPaths(getRootRuntimeConfigCandidatePaths(import.meta.url))
}

function resolveStorage(runtimeConfig: BetterTranslateRuntimeConfig | null, override?: BetterTranslateStorageOptions) {
  if (!override) return runtimeConfig?.storage ?? ({ type: "local", dir: DEFAULT_LOCAL_OUTPUT_DIR } as const)
  if (override.type !== "local") return override
  return { ...override, dir: override.dir ?? getLocalStorageDir(runtimeConfig) }
}

function getLocalStorageDir(runtimeConfig: BetterTranslateRuntimeConfig | null) {
  return runtimeConfig?.storage.type === "local" ? runtimeConfig.storage.dir ?? DEFAULT_LOCAL_OUTPUT_DIR : DEFAULT_LOCAL_OUTPUT_DIR
}

function normalizeMessages(input: RuntimeMessages | LocaleFile): RuntimeMessages {
  if ("messages" in input) {
    return Object.fromEntries(Object.entries(input.messages).map(([id, entry]) => [id, entry.translation])) as RuntimeMessages
  }

  return input
}

/** The server-side translation helpers returned by `createTranslator()`. */
export interface ServerTranslator {
  /** Translates a plain string in non-JSX contexts such as errors or email helpers. */
  t: (id: string, options?: TranslateOptions) => string
  /** Translates a template message with runtime placeholders. */
  msg: (id: string) => (strings: TemplateStringsArray, ...expressions: VarResult[]) => string
}

/** Creates lightweight server-side translation helpers from a loaded message map. */
export function createTranslator(messages: Record<string, string>): ServerTranslator {
  function t(id: string, options?: TranslateOptions) {
    return messages[getCallMessageId(id, options)] ?? id
  }

  function msg(id: string) {
    return (strings: TemplateStringsArray, ...expressions: VarResult[]) => {
      const template = messages[id]

      if (!template) {
        return strings.reduce((acc, str, i) => {
          const expr = expressions[i]
          return acc + str + (expr ? String(expr.value) : "")
        }, "")
      }

      const values = Object.fromEntries(
        expressions.filter((expr): expr is VarResult => Boolean(expr?.__i18n)).map((expr) => [expr.name, String(expr.value)]),
      )
      return template.replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? `{${name}}`)
    }
  }

  return { t, msg }
}
