import type { generateText } from "ai"

type AiModel = Parameters<typeof generateText>[0]["model"]
const DEFAULT_TRANSLATION_CONCURRENCY = 4
const PLATFORM_TRANSLATION_MODEL = "openai/gpt-5.5"

export type PlatformTranslatorMessage = {
  context?: string
  defaultMessage: string
  id: string
  placeholders: string[]
  sources: unknown
}

export type PlatformTranslatorGlossaryTerm = {
  action: "preserve" | "translate_as" | "avoid"
  note: string | null
  sourceTerm: string
  targetLocale: string | null
  targetTerm: string | null
}

export async function translateMessageWithPlatform({
  glossaryTerms = [],
  locale,
  message,
  prompt,
}: {
  glossaryTerms?: PlatformTranslatorGlossaryTerm[]
  locale: string
  message: PlatformTranslatorMessage
  prompt: string
}) {
  const translated = (await translateWithAi({ glossaryTerms, locale, message, prompt })).trim()
  if (!translated) throw new Error(`The Platform translator returned no value for ${message.id}.`)
  return translated
}

export async function translateMessagesWithPlatform({
  concurrency = DEFAULT_TRANSLATION_CONCURRENCY,
  glossaryTerms = [],
  locale,
  messages,
  prompt,
}: {
  concurrency?: number
  glossaryTerms?: PlatformTranslatorGlossaryTerm[]
  locale: string
  messages: PlatformTranslatorMessage[]
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
        if (message) translations[message.id] = await translateMessageWithPlatform({ glossaryTerms, locale, message, prompt })
      }
    }),
  )

  return translations
}

async function translateWithAi({
  glossaryTerms,
  locale,
  message,
  prompt,
}: {
  glossaryTerms: PlatformTranslatorGlossaryTerm[]
  locale: string
  message: PlatformTranslatorMessage
  prompt: string
}) {
  const { generateText } = await import("ai")
  const { text } = await generateText({
    model: PLATFORM_TRANSLATION_MODEL as AiModel,
    system: createSystemPrompt(locale, prompt, glossaryTerms),
    prompt: createUserPrompt(message, locale),
  })

  return text
}

function createSystemPrompt(locale: string, prompt: string, glossaryTerms: PlatformTranslatorGlossaryTerm[]) {
  return [
    `## Translation Brief
${prompt}

## Target Locale
${locale}

## Translation Glossary
${createGlossaryPrompt(glossaryTerms)}

## Output Contract
Return only the translated text for the provided source Message.
Do not include the lookup id, labels, explanations, markdown, code fences, or surrounding quotes.
Keep placeholders exactly as provided.
Use the Message context when provided.`,
  ].join("\n\n")
}

function createGlossaryPrompt(glossaryTerms: PlatformTranslatorGlossaryTerm[]) {
  if (glossaryTerms.length === 0) return "No glossary terms are configured for this Locale."

  return JSON.stringify(
    {
      instructions: [
        "For preserve entries, keep sourceTerm unchanged when it appears in the source Message.",
        "For translate_as entries, use targetTerm for sourceTerm when it appears in the source Message.",
        "For avoid entries, do not use targetTerm when translating sourceTerm.",
      ],
      terms: glossaryTerms.map((term) => ({
        sourceTerm: term.sourceTerm,
        action: term.action,
        targetLocale: term.targetLocale,
        targetTerm: term.targetTerm,
        note: term.note,
      })),
    },
    null,
    2,
  )
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
