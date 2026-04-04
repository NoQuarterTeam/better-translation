import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

import type { TranslationCache } from "./types.js"

const CURRENT_VERSION = 1

export function loadCache(path: string): TranslationCache {
  if (!existsSync(path)) return { version: CURRENT_VERSION, entries: {} }
  try {
    const data = JSON.parse(readFileSync(path, "utf-8")) as TranslationCache
    if (data.version !== CURRENT_VERSION) return { version: CURRENT_VERSION, entries: {} }
    return data
  } catch {
    return { version: CURRENT_VERSION, entries: {} }
  }
}

export function saveCache(path: string, cache: TranslationCache) {
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, JSON.stringify(cache, null, 2))
}

export function getCacheKey(sourceText: string, locale: string) {
  return `${sourceText}\0${locale}`
}
