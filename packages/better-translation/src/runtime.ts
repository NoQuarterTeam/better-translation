/**
 * Framework-neutral Runtime bundle translator.
 *
 * @packageDocumentation
 */
import type { TranslateOptions } from "./types.js"

import { getCallMessageId } from "./message/id.js"
import { hasMessagePlaceholder, interpolateMessageTemplate } from "./message/template.js"
import { getOwnValue, normalizeValues } from "./message/value-record.js"

type MessageValues = Record<string, unknown>

/**
 * Resolves an authored Message from a Runtime bundle and interpolates string
 * placeholders.
 *
 * @param message - Default locale Message and fallback value.
 * @param valuesOrOptions - Placeholder values, or `id`/`context` options when
 *   the Message has no values.
 * @param options - `id`/`context` options when placeholder values are supplied.
 * @returns The matching Locale value, or `message` when no value is available.
 */
export type Translator = (
  message: string,
  valuesOrOptions?: MessageValues | TranslateOptions,
  options?: TranslateOptions,
) => string

/**
 * Creates a lightweight, framework-neutral translator from a loaded Runtime
 * bundle.
 *
 * The translator looks up Messages by their stable generated Lookup id unless
 * an explicit `id` is supplied. It interpolates `{name}` placeholders with the
 * provided values and falls back to the authored Message when the bundle has no
 * matching value.
 *
 * @param messages - Flat Runtime bundle keyed by Lookup id.
 * @returns A translator bound to that bundle.
 *
 * @example
 * ```ts
 * const t = createT(messages)
 * t("Moved {count} Messages", { count: 3 }, { context: "Bulk action toast" })
 * ```
 */
export function createT(messages: Record<string, string>): Translator {
  return function t(message: string, valuesOrOptions?: MessageValues | TranslateOptions, options?: TranslateOptions) {
    const optionsInSecondPosition = options === undefined && isTranslateOptions(valuesOrOptions, message)
    const values = optionsInSecondPosition ? undefined : normalizeValues(valuesOrOptions as MessageValues | undefined)
    const resolvedOptions = optionsInSecondPosition ? valuesOrOptions : options
    const template = getOwnValue(messages, getCallMessageId(message, resolvedOptions)) ?? message

    if (!values) return template

    return interpolateString(template, values)
  }
}

function interpolateString(template: string, values?: Record<string, string>) {
  if (!values) return template
  return interpolateMessageTemplate(template, values)
}

function isTranslateOptions(value?: MessageValues | TranslateOptions, message?: string): value is TranslateOptions {
  if (!value || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return (
    keys.every((key) => key === "id" || key === "context") &&
    !keys.some((key) => message !== undefined && hasMessagePlaceholder(message, key))
  )
}
