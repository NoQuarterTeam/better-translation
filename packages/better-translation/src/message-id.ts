import type { TranslateOptions } from "./types.js"

export function normalizeMeta(meta?: TranslateOptions): TranslateOptions {
  if (!meta) return {}

  return Object.fromEntries(
    Object.entries(meta)
      .filter(([key, value]) => key !== "id" && value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  ) as TranslateOptions
}

export function serializeMeta(meta?: TranslateOptions) {
  if (!meta) return ""

  const normalized = normalizeMeta(meta)
  return Object.keys(normalized).length > 0 ? JSON.stringify(normalized) : ""
}

export function getMessageIdentity(message: string, meta?: TranslateOptions) {
  const serializedMeta = serializeMeta(meta)
  return serializedMeta ? `${message}\0${serializedMeta}` : message
}

/** Generates the stable hashed id used to store and look up a translated message. */
export function getMessageId(message: string, meta?: TranslateOptions) {
  const value = getMessageIdentity(message, meta)
  let hash = 2166136261

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return `m_${(hash >>> 0).toString(36)}`
}

/** Resolves the lookup id for function-style `t()` calls, preferring an explicit `options.id`. */
export function getCallMessageId(message: string, options?: TranslateOptions) {
  return options?.id ?? getMessageId(message, options)
}
