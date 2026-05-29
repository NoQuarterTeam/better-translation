import type { generateText } from "ai"
import { z } from "zod"

import type { TranslateFn, TranslateMessage } from "./types.js"

const DEFAULT_GATEWAY_MODEL = "openai/gpt-5.5"
const DEFAULT_BATCH_SIZE = 25
type AiModel = Parameters<typeof generateText>[0]["model"]
const translationPayloadSchema = z.object({
  translations: z.record(z.string(), z.string()),
})

export interface CreateAiTranslateOptions {
  /** AI SDK model value. Defaults to a Vercel AI Gateway model string. */
  model?: AiModel
  /** Primary translation brief for product, tone, glossary, or domain instructions. */
  prompt?: string
  /** Maximum number of messages sent in a single translation request. */
  batchSize?: number
  /** Optional temperature forwarded to the selected model provider. */
  temperature?: number
}

export function createAiTranslate(options: CreateAiTranslateOptions = {}): TranslateFn {
  return async (messages, locale) => {
    const result: Record<string, string> = {}
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE

    for (let index = 0; index < messages.length; index += batchSize) {
      const batch = messages.slice(index, index + batchSize)
      Object.assign(result, await translateBatch(batch, locale, options))
    }

    return result
  }
}

async function translateBatch(messages: TranslateMessage[], locale: string, options: CreateAiTranslateOptions) {
  const { translations } = await translateWithAi(messages, locale, options)

  return Object.fromEntries(
    messages.map((message) => {
      const translated = translations[message.id]?.trim()
      return [message.id, translated || message.text]
    }),
  )
}

async function translateWithAi(messages: TranslateMessage[], locale: string, options: CreateAiTranslateOptions) {
  const { generateText, Output } = await import("ai")
  const { output } = await generateText({
    model: options.model ?? DEFAULT_GATEWAY_MODEL,
    output: Output.object({ schema: translationPayloadSchema }),
    system: createSystemPrompt(locale, options.prompt),
    prompt: createUserPrompt(messages, locale),
    ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
  })

  return output
}

function createSystemPrompt(locale: string, prompt?: string) {
  const translationBrief = prompt?.trim() || "Translate the provided UI messages as concise, natural application UI copy."

  return [
    `## Translation Brief
${translationBrief}

## Target Locale
${locale}

## Required Output Contract
Return translations keyed by message id in the requested structured output.
Use each message context when provided.
Do not add labels, explanations, markdown, or code fences.`,
  ].join("\n\n")
}

function createUserPrompt(messages: TranslateMessage[], locale: string) {
  return JSON.stringify({
    targetLocale: locale,
    messages: messages.map((message) => ({
      id: message.id,
      text: message.text,
      context: message.meta.context,
    })),
  })
}
