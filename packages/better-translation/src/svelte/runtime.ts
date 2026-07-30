import { getContext, setContext } from "svelte"
import type { Snippet } from "svelte"

import type { Translator } from "../runtime.js"
import type { TranslateOptions } from "../types.js"

import {
  hasSameRichTextStructure,
  parseRichTextMessage,
  type ParsedRichTextMessage,
  type RichTextMessageNode,
} from "../message/template.js"
import { getOwnValue, normalizeValues } from "../message/value-record.js"
import { createT } from "../runtime.js"

const TRANSLATE_CONTEXT = "better-translation"
const EMPTY_MESSAGES = Object.create(null) as Record<string, string>

/** Context contract shared by Better Translation's Svelte provider and runtime helpers. */
export interface SvelteTranslateContext {
  /** Reads the current Runtime bundle so reactive provider changes are observed. */
  getMessages: () => Record<string, string>
}

/** Values accepted by the Svelte `TranslateProvider` component. */
export interface TranslateProviderProps {
  /** Active Locale used to apply development-time translation updates without reloading the page. */
  locale?: string
  /** Flat Runtime bundle for the active Locale, keyed by Lookup id. */
  messages: Record<string, string>
  /** Svelte content that reads this Runtime bundle. */
  children?: Snippet
}

export function setMessages(messages: Record<string, string> | (() => Record<string, string>)) {
  const getMessages = typeof messages === "function" ? messages : () => messages
  return setContext<SvelteTranslateContext>(TRANSLATE_CONTEXT, { getMessages })
}

/**
 * Returns the Runtime bundle supplied by the nearest Svelte
 * `TranslateProvider`.
 *
 * Call this during Svelte component initialization. It returns an empty map
 * when no provider exists above that component.
 */
export function getMessages() {
  return getMessageGetter()()
}

/** Captures the provider message reader while a compiled Svelte component is initializing. @internal */
export function getMessagesReader() {
  return getMessageGetter()
}

export function getMessage(messages: Record<string, string>, id: string) {
  return getOwnValue(messages, id)
}

/**
 * Returns a translator for Messages used in attributes, labels, and other
 * non-component positions.
 *
 * The translator observes later Runtime bundle changes from the nearest Svelte
 * `TranslateProvider`, supports `{placeholder}` interpolation plus explicit
 * `id` and `context` options, and falls back to the authored Message when no
 * Locale value is available. Call `getT` during Svelte component initialization
 * and retain the returned translator for later use.
 */
export function getT(): Translator {
  const getCurrentMessages = getMessageGetter()
  let messages = getCurrentMessages()
  let t = createT(messages)

  return (...args) => {
    const currentMessages = getCurrentMessages()
    if (currentMessages !== messages) {
      messages = currentMessages
      t = createT(messages)
    }
    return t(...args)
  }
}

export function parseSvelteRichTextMessage(message: string) {
  return parseRichTextMessage(message)
}

export function resolveSvelteRichTextNodes(
  source: ParsedRichTextMessage | undefined,
  translated: ParsedRichTextMessage | undefined,
): RichTextMessageNode[] | undefined {
  if (!source) return undefined
  if (!translated || !hasSameRichTextStructure(source.structure, translated.structure)) return source.nodes
  return translated.nodes
}

export type { TranslateOptions }
export type { ParsedRichTextMessage, RichTextMessageNode }
export { normalizeValues }

function getMessageGetter() {
  return getContext<SvelteTranslateContext | undefined>(TRANSLATE_CONTEXT)?.getMessages ?? (() => EMPTY_MESSAGES)
}
