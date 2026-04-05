import type { BetterTranslateRuntimeConfig, LocaleFile, RuntimeMessages } from "./types.js"

import { getMessages } from "./server.js"
import {
  DEFAULT_LOCAL_OUTPUT_DIR,
  LOCAL_RUNTIME_CONFIG_FILENAME,
} from "./runtime-config.js"

const PREFIX = "\x1b[36m[better-translation]\x1b[0m"

interface NitroStorageLike {
  get?: (key: string) => Promise<unknown>
  getItem?: (key: string) => Promise<unknown>
  getItemRaw?: (key: string) => Promise<unknown>
}

/** Options for loading locale messages from Nitro server assets. */
export interface GetNitroMessagesOptions {
  /** Custom Nitro server-asset mount name. Defaults to Nitro's built-in `assets:server` mount. */
  mount?: string
  /** Directory inside the mount that contains locale JSON files. Defaults to `assets/locales` on `assets:server`. */
  dir?: string
}

/** Loads one locale from Nitro server assets. */
export async function getNitroMessages(
  locale: string,
  options?: GetNitroMessagesOptions,
): Promise<Record<string, string>> {
  try {
    const nitroStorage = await loadNitroStorage()
    if (!nitroStorage?.useStorage) return getFilesystemMessages(locale, options)

    const mount = options?.mount ? `assets:${options.mount}` : "assets:server"
    const storage = nitroStorage.useStorage(mount)
    const runtimeConfig = await readRuntimeConfig(storage, options)
    const localeKey = resolveLocaleKey(locale, runtimeConfig, options)
    const value = await readStorageValue(storage, localeKey)
    if (!value) return getFilesystemMessages(locale, options, runtimeConfig)
    return normalizeMessages(value)
  } catch (error) {
    console.error(`${PREFIX} Error loading Nitro messages for locale ${locale}:`, error)
    return getFilesystemMessages(locale, options)
  }
}

async function readRuntimeConfig(storage: NitroStorageLike, options?: GetNitroMessagesOptions) {
  const runtimeConfigKey = resolveRuntimeConfigKey(options)
  const value = await readStorageValue(storage, runtimeConfigKey)
  if (!value) return null

  try {
    if (typeof value === "string") return JSON.parse(value) as BetterTranslateRuntimeConfig
    if (value instanceof Uint8Array) return JSON.parse(new TextDecoder().decode(value)) as BetterTranslateRuntimeConfig
    if (typeof value === "object") return value as BetterTranslateRuntimeConfig
  } catch {
    return null
  }

  return null
}

function resolveRuntimeConfigKey(options?: GetNitroMessagesOptions) {
  if (options?.mount) return LOCAL_RUNTIME_CONFIG_FILENAME
  return `${getNitroDir(options?.dir)}/${LOCAL_RUNTIME_CONFIG_FILENAME}`
}

function resolveLocaleKey(locale: string, runtimeConfig: BetterTranslateRuntimeConfig | null, options?: GetNitroMessagesOptions) {
  const storageDir = runtimeConfig?.storage.type === "local" ? runtimeConfig.storage.dir : undefined
  const dir = options?.dir ?? storageDir ?? "assets/locales"
  if (options?.mount) return `${locale}.json`
  return `${getNitroDir(dir)}/${locale}.json`
}

function getNitroDir(dir = "assets/locales") {
  return dir.replace(/^\.?\//, "").replace(/^assets\//, "") || DEFAULT_LOCAL_OUTPUT_DIR
}

function getFilesystemDir(options?: GetNitroMessagesOptions, runtimeConfig?: BetterTranslateRuntimeConfig | null) {
  if (options?.dir) return options.dir
  if (runtimeConfig?.storage.type === "local") return runtimeConfig.storage.dir
  if (options?.mount) return options.mount
  return "assets/locales"
}

async function getFilesystemMessages(
  locale: string,
  options?: GetNitroMessagesOptions,
  runtimeConfig?: BetterTranslateRuntimeConfig | null,
) {
  return getMessages(locale, {
    storage: { type: "local", dir: getFilesystemDir(options, runtimeConfig) },
  })
}

async function readStorageValue(storage: NitroStorageLike, key: string) {
  return (await storage.getItem?.(key)) ?? (await storage.get?.(key)) ?? (await storage.getItemRaw?.(key))
}

async function loadNitroStorage(): Promise<{
  useStorage?: (base: string) => NitroStorageLike
} | null> {
  try {
    // Nitro is optional for this package, so we only resolve its storage module at runtime.
    // @ts-expect-error `nitro/storage` is only present in Nitro apps.
    return (await import(/* @vite-ignore */ "nitro/storage")) as { useStorage?: (base: string) => NitroStorageLike }
  } catch {
    return null
  }
}

function normalizeMessages(input: unknown): RuntimeMessages {
  if (!input) return {}
  if (typeof input === "string") {
    return normalizeMessages(JSON.parse(input) as RuntimeMessages | LocaleFile)
  }
  if (input instanceof Uint8Array) {
    return normalizeMessages(JSON.parse(new TextDecoder().decode(input)) as RuntimeMessages | LocaleFile)
  }
  if (typeof input !== "object") return {}
  if ("messages" in input) {
    return Object.fromEntries(
      Object.entries((input as LocaleFile).messages).map(([id, entry]) => [id, entry.translation]),
    ) as RuntimeMessages
  }
  return input as RuntimeMessages
}
