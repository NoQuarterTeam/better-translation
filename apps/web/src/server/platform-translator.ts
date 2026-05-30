import type { generateText } from "ai"

type AiModel = Parameters<typeof generateText>[0]["model"]
const DEFAULT_TRANSLATION_CONCURRENCY = 4

export type PlatformTranslatorMessage = {
  context?: string
  defaultMessage: string
  id: string
  placeholders: string[]
  sources: unknown
}

export async function translateMessageWithPlatform({
  locale,
  message,
  model,
  prompt,
}: {
  locale: string
  message: PlatformTranslatorMessage
  model: string
  prompt: string
}) {
  const translated = (await translateWithAi({ locale, message, model, prompt })).trim()
  if (!translated) throw new Error(`The Platform translator returned no value for ${message.id}.`)
  return translated
}

export async function translateMessagesWithPlatform({
  concurrency = DEFAULT_TRANSLATION_CONCURRENCY,
  locale,
  messages,
  model,
  prompt,
}: {
  concurrency?: number
  locale: string
  messages: PlatformTranslatorMessage[]
  model: string
  prompt: string
}) {
  const translations: Record<string, string> = {}
  const workerCount = Math.max(1, Math.min(concurrency, messages.length))
  let nextIndex = 0

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < messages.length) {
        const message = messages[nextIndex]
        nextIndex += 1
        if (message) translations[message.id] = await translateMessageWithPlatform({ locale, message, model, prompt })
      }
    }),
  )

  return translations
}

async function translateWithAi({
  locale,
  message,
  model,
  prompt,
}: {
  locale: string
  message: PlatformTranslatorMessage
  model: string
  prompt: string
}) {
  const { generateText } = await import("ai")
  const { text } = await generateText({
    model: model as AiModel,
    system: createSystemPrompt(locale, prompt),
    prompt: createUserPrompt(message, locale),
  })

  return text
}

function createSystemPrompt(locale: string, prompt: string) {
  return [
    `## Translation Brief
${prompt}

## Target Locale
${locale}

## Output Contract
Return only the translated text for the provided source Message.
Do not include the Message id, labels, explanations, markdown, code fences, or surrounding quotes.
Keep placeholders exactly as provided.
Use the Message context when provided.`,
  ].join("\n\n")
}

function createUserPrompt(message: PlatformTranslatorMessage, locale: string) {
  return JSON.stringify({
    targetLocale: locale,
    message: {
      id: message.id,
      text: message.defaultMessage,
      context: message.context,
      placeholders: message.placeholders,
    },
  })
}
