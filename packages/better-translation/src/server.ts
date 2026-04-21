import type { TranslateOptions } from "./types.js"

import { getCallMessageId } from "./message-id.js"

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

type MessageValues = Record<string, unknown>

/** The server-side translation helpers returned by `createTranslator()`. */
export interface ServerTranslator {
  /** Translates a plain string in non-JSX contexts such as errors or email helpers. */
  t: (message: string, options?: TranslateOptions) => string
  /** Translates a server-side message and optionally interpolates `{placeholders}`. */
  msg: (message: string, valuesOrOptions?: MessageValues | TranslateOptions, options?: TranslateOptions) => string
}

/** Creates lightweight server-side translation helpers from a loaded message map. */
export function createTranslator(messages: Record<string, string>): ServerTranslator {
  function t(message: string, options?: TranslateOptions) {
    return messages[getCallMessageId(message, options)] ?? message
  }

  function msg(message: string, valuesOrOptions?: MessageValues | TranslateOptions, options?: TranslateOptions) {
    const values = isTranslateOptions(valuesOrOptions) ? undefined : normalizeValues(valuesOrOptions)
    const resolvedOptions = isTranslateOptions(valuesOrOptions) ? valuesOrOptions : options
    const template = messages[getCallMessageId(message, resolvedOptions)] ?? message

    if (!values) return template

    return template.replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? `{${name}}`)
  }

  return { t, msg }
}

function isTranslateOptions(value?: MessageValues | TranslateOptions): value is TranslateOptions {
  if (!value || Array.isArray(value)) return false
  return Object.keys(value).every((key) => key === "id" || key === "context")
}

function normalizeValues(values?: MessageValues) {
  if (!values) return undefined

  const entries = Object.entries(values).flatMap(([name, value]) => {
    if (isVarResult(value)) return [[value.name, String(value.value)]]
    return [[name, String(value)]]
  })

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function isVarResult(value: unknown): value is VarResult {
  return typeof value === "object" && value !== null && "__i18n" in value && "name" in value && "value" in value
}
