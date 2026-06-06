import { getContext, setContext } from "svelte"
import type { Snippet } from "svelte"

import type { Translator } from "./runtime.js"
import type { TranslateOptions } from "./types.js"

import { createTranslator } from "./runtime.js"

const TRANSLATE_CONTEXT = "better-translation"

export interface SvelteTranslateContext {
  getMessages: () => Record<string, string>
}

export interface TranslateProviderProps {
  messages: Record<string, string>
  children?: Snippet
}

export function setMessages(messages: Record<string, string> | (() => Record<string, string>)) {
  const getMessages = typeof messages === "function" ? messages : () => messages
  return setContext<SvelteTranslateContext>(TRANSLATE_CONTEXT, { getMessages })
}

export function getMessages() {
  return getContext<SvelteTranslateContext | undefined>(TRANSLATE_CONTEXT)?.getMessages() ?? {}
}

export function getT(): Translator {
  return createTranslator(getMessages())
}

export type { TranslateOptions }
