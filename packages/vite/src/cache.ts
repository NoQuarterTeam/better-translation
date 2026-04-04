import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

import type { TranslationCache } from "./types.js"

const CURRENT_VERSION = 1

export function createEmptyCache(): TranslationCache {
  return { version: CURRENT_VERSION, entries: {} }
}

/** Loads the translation cache from disk, resetting it when the schema version changes. */
export function loadCache(path: string): TranslationCache {
  if (!existsSync(path)) return createEmptyCache()
  try {
    const data = JSON.parse(readFileSync(path, "utf-8")) as TranslationCache
    if (data.version !== CURRENT_VERSION) return createEmptyCache()
    return data
  } catch {
    return createEmptyCache()
  }
}

/** Persists the translation cache so future runs can reuse existing translations. */
export function saveCache(path: string, cache: TranslationCache) {
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, JSON.stringify(cache, null, 2))
}

/** Builds the cache key used to distinguish translations by stable message id and locale. */
export function getCacheKey(messageId: string, locale: string) {
  return `${messageId}\0${locale}`
}
