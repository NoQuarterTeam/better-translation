import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

import type { TranslationCache } from "../types.js"

const CURRENT_VERSION = 1
let temporaryFileSequence = 0

export function createEmptyCache(): TranslationCache {
  return { version: CURRENT_VERSION, entries: createCacheEntries() }
}

/** Loads the translation cache from disk, resetting it when the schema version changes. */
export function loadCache(path: string): TranslationCache {
  if (!existsSync(path)) return createEmptyCache()
  try {
    const data = JSON.parse(readFileSync(path, "utf-8")) as unknown
    if (!isTranslationCache(data)) return createEmptyCache()
    return {
      version: data.version,
      entries: createCacheEntries(Object.entries(data.entries)),
    }
  } catch {
    return createEmptyCache()
  }
}

/** Persists the translation cache so future runs can reuse existing translations. */
export function saveCache(path: string, cache: TranslationCache) {
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const next = JSON.stringify(cache, null, 2)
  if (existsSync(path) && readFileSync(path, "utf-8") === next) return
  const temporaryPath = `${path}.${process.pid}.${temporaryFileSequence++}.tmp`
  try {
    writeFileSync(temporaryPath, next)
    renameSync(temporaryPath, path)
  } finally {
    if (existsSync(temporaryPath)) rmSync(temporaryPath)
  }
}

/** Builds the cache key used to distinguish translations by stable lookup id and locale. */
export function getCacheKey(lookupId: string, locale: string) {
  return `${lookupId}\0${locale}`
}

function createCacheEntries(entries: Iterable<readonly [string, TranslationCache["entries"][string]]> = []) {
  const cacheEntries = Object.create(null) as TranslationCache["entries"]
  for (const [key, entry] of entries) cacheEntries[key] = entry
  return cacheEntries
}

function isTranslationCache(input: unknown): input is TranslationCache {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false
  if (!("version" in input) || input.version !== CURRENT_VERSION) return false
  if (!("entries" in input) || typeof input.entries !== "object" || input.entries === null || Array.isArray(input.entries)) {
    return false
  }

  return Object.values(input.entries).every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      "sourceText" in entry &&
      typeof entry.sourceText === "string" &&
      "meta" in entry &&
      typeof entry.meta === "object" &&
      entry.meta !== null &&
      !Array.isArray(entry.meta) &&
      "locale" in entry &&
      typeof entry.locale === "string" &&
      "translation" in entry &&
      typeof entry.translation === "string" &&
      "timestamp" in entry &&
      typeof entry.timestamp === "number" &&
      Number.isFinite(entry.timestamp),
  )
}
