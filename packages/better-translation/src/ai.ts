import type { generateText } from "ai"

import type { TranslateFn, TranslateMessage } from "./types.js"

const DEFAULT_GATEWAY_MODEL = "openai/gpt-5.5"
const DEFAULT_CONCURRENCY = 10
type AiModel = Parameters<typeof generateText>[0]["model"]

export interface CreateAiTranslateOptions {
  /** AI SDK model value. Defaults to a Vercel AI Gateway model string. */
  model?: AiModel
  /** Primary translation brief for product, tone, glossary, or domain instructions. */
  prompt?: string
  /** Optional temperature forwarded to the selected model provider. */
  temperature?: number
  /** Maximum number of per-message translation requests to run at once. */
  concurrency?: number
}

export function createAiTranslate(options: CreateAiTranslateOptions = {}): TranslateFn {
  return async (messages, locale) => {
    const result: Record<string, string> = {}
    const concurrency = normalizeConcurrency(options.concurrency)

    await Promise.all(
      Array.from({ length: Math.min(concurrency, messages.length) }, async (_, workerIndex) => {
        for (let index = workerIndex; index < messages.length; index += concurrency) {
          const message = messages[index]!
          result[message.id] = await translateMessage(message, locale, options)
        }
      }),
    )

    return result
  }
}

function normalizeConcurrency(concurrency = DEFAULT_CONCURRENCY) {
  if (!Number.isFinite(concurrency)) return DEFAULT_CONCURRENCY
  return Math.max(1, Math.floor(concurrency))
}

async function translateMessage(message: TranslateMessage, locale: string, options: CreateAiTranslateOptions) {
  const translated = (await translateWithAi(message, locale, options)).trim()

  return translated || message.text
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
