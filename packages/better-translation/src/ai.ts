/**
 * Optional AI SDK adapter for local-mode translation.
 *
 * @packageDocumentation
 */
import type { generateText } from "ai"

import type { TranslateFn, TranslateMessage } from "./types.js"

import { hasSameMessageStructure } from "./message/template.js"

const DEFAULT_GATEWAY_MODEL = "openai/gpt-5.5"
type AiModel = Parameters<typeof generateText>[0]["model"]

/** Model and translation-brief options for {@link createAiTranslate}. */
export interface CreateAiTranslateOptions {
  /** AI SDK model used for each Message. Defaults to `"openai/gpt-5.5"` through Vercel AI Gateway. */
  model?: AiModel
  /** Translation brief containing product, tone, glossary, or domain guidance. */
  prompt?: string
  /** Temperature forwarded to the selected model when explicitly provided. */
  temperature?: number
}

/**
 * Creates a local-mode {@link TranslateFn} backed by AI SDK `generateText`.
 *
 * Each Message is translated independently. The returned callback preserves
 * placeholders and numbered rich-text tags, and rejects generated values whose
 * structure does not match the Default locale Message. Use it as
 * `runtime.translate` only; remote mode uses the Platform translator.
 *
 * @param options - Model and translation-brief configuration.
 * @returns A callback accepted by the local runtime's `translate` option.
 */
export function createAiTranslate(options: CreateAiTranslateOptions = {}): TranslateFn {
  return async (messages, locale) => {
    const entries = await Promise.all(
      messages.map(async (message) => [message.id, await translateMessage(message, locale, options)] as const),
    )

    return Object.fromEntries(entries.filter((entry): entry is [string, string] => entry[1] !== undefined))
  }
}

async function translateMessage(message: TranslateMessage, locale: string, options: CreateAiTranslateOptions) {
  const translated = (await translateWithAi(message, locale, options)).trim()

  if (!translated) return undefined
  if (!hasSameMessageStructure(message.text, translated)) {
    throw new Error(`The translation for ${message.id} did not preserve its placeholders and rich-text elements.`)
  }
  return translated
}

async function translateWithAi(message: TranslateMessage, locale: string, options: CreateAiTranslateOptions) {
  const { generateText } = await import("ai")
  const { text } = await generateText({
    model: options.model ?? DEFAULT_GATEWAY_MODEL,
    system: createSystemPrompt(locale, options.prompt),
    prompt: createUserPrompt(message, locale),
    ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
  })

  return text
}

function createSystemPrompt(locale: string, prompt?: string) {
  const translationBrief = prompt?.trim() || "Translate the provided UI messages as concise, natural application UI copy."

  return [
    `## Translation Brief
${translationBrief}

## Target Locale
${locale}

## Output Contract
Return only the translated text for the provided source message.
Do not include the lookup id, labels, explanations, markdown, code fences, or surrounding quotes.
Keep variable placeholders and numbered rich-text tags exactly as provided.
Use the message context when provided.`,
  ].join("\n\n")
}

function createUserPrompt(message: TranslateMessage, locale: string) {
  return JSON.stringify({
    targetLocale: locale,
    message: {
      id: message.id,
      text: message.text,
      context: message.meta.context,
    },
  })
}
