import type { TranslateOptions } from "./types.js"

import { getCallMessageId } from "./message-id.js"

type MessageValues = Record<string, unknown>
export type ServerTranslator = (
  message: string,
  valuesOrOptions?: MessageValues | TranslateOptions,
  options?: TranslateOptions,
) => string

/** Creates a lightweight server-side translator from a loaded message map. */
export function createTranslator(messages: Record<string, string>): ServerTranslator {
  return function t(message: string, valuesOrOptions?: MessageValues | TranslateOptions, options?: TranslateOptions) {
    const values = isTranslateOptions(valuesOrOptions) ? undefined : normalizeValues(valuesOrOptions)
    const resolvedOptions = isTranslateOptions(valuesOrOptions) ? valuesOrOptions : options
    const template = messages[getCallMessageId(message, resolvedOptions)] ?? message

    if (!values) return template

    return template.replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? `{${name}}`)
  }
}

function isTranslateOptions(value?: MessageValues | TranslateOptions): value is TranslateOptions {
  if (!value || Array.isArray(value)) return false
  return Object.keys(value).every((key) => key === "id" || key === "context")
}

function normalizeValues(values?: MessageValues) {
  if (!values) return undefined

  const entries = Object.entries(values).map(([name, value]) => [name, String(value)])
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}
