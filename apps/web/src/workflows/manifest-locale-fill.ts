import { db } from "@/server/db"
import { localeValuesTable, type messagesTable, type projectsTable } from "@/server/db/schema"
import { createStableHash } from "@/server/platform"
import { translateMessagesWithPlatform } from "@/server/platform-translator"
import { listEnabledTranslationGlossaryTerms } from "@/server/translation-glossary"

const TRANSLATION_CHUNK_SIZE = 24
const TRANSLATION_CONCURRENCY = 8

type Message = typeof messagesTable.$inferSelect
type LocaleValue = typeof localeValuesTable.$inferSelect

export type ManifestLocaleFillInput = {
  branchId: string
  defaultBranchId: string
  projectId: string
}

export async function fillManifestLocaleValuesWorkflow(input: ManifestLocaleFillInput) {
  "use workflow"

  console.log("Starting Manifest Locale value fill", input)

  const summary = await loadManifestLocaleFillSummary(input)
  let filledValueCount = 0

  for (const locale of summary.targetLocales) {
    const fillPlan = await copyDefaultBranchLocaleValuesForLocale({ ...input, locale })
    filledValueCount += fillPlan.copiedValueCount

    for (const messageIds of chunk(fillPlan.messageIdsNeedingTranslation, TRANSLATION_CHUNK_SIZE)) {
      filledValueCount += await translateLocaleValueChunk({ ...input, locale, messageIds })
    }
  }

  const result = { filledValueCount, messageCount: summary.messageCount }
  console.log("Finished Manifest Locale value fill", { ...input, ...result })
  return result
}

async function loadManifestLocaleFillSummary(input: ManifestLocaleFillInput) {
  "use step"

  console.log("Loading Manifest Locale value fill summary", input)

  const branch = await db.query.branchesTable.findFirst({ where: { id: input.branchId, projectId: input.projectId } })
  if (!branch) throw new Error(`Branch ${input.branchId} not found.`)

  const messages = await db.query.messagesTable.findMany({
    columns: { id: true },
    where: { active: true, branchId: input.branchId, projectId: input.projectId },
  })

  return {
    messageCount: messages.length,
    targetLocales: branch.locales.filter((locale) => locale !== branch.defaultLocale),
  }
}

async function copyDefaultBranchLocaleValuesForLocale(input: ManifestLocaleFillInput & { locale: string }) {
  "use step"

  console.log("Copying matching Production Branch Locale values", input)

  const messages = await db.query.messagesTable.findMany({
    where: { active: true, branchId: input.branchId, projectId: input.projectId },
  })
  if (messages.length === 0) return { copiedValueCount: 0, messageIdsNeedingTranslation: [] }

  const fillContext = await loadLocaleFillContext({
    branchId: input.branchId,
    defaultBranchId: input.defaultBranchId,
    messages,
    projectId: input.projectId,
  })
  const fillPlan = getLocaleFillPlan({ ...fillContext, locale: input.locale, messages })
  let copiedValueCount = 0
  const messageIdsNeedingTranslation = []

  for (const item of fillPlan) {
    if (!item.defaultBranchValue) {
      messageIdsNeedingTranslation.push(item.message.id)
      continue
    }

    await copyDefaultBranchLocaleValue({
      branchId: input.branchId,
      defaultBranchValue: item.defaultBranchValue,
      locale: input.locale,
      message: item.message,
      projectId: input.projectId,
    })
    copiedValueCount += 1
  }

  return { copiedValueCount, messageIdsNeedingTranslation }
}

async function translateLocaleValueChunk({
  branchId,
  locale,
  messageIds,
  projectId,
}: ManifestLocaleFillInput & {
  locale: string
  messageIds: string[]
}) {
  "use step"

  console.log("Translating Manifest Locale value chunk", { branchId, locale, messageCount: messageIds.length, projectId })

  if (messageIds.length === 0) return 0

  const project = await db.query.projectsTable.findFirst({ where: { id: projectId } })
  if (!project) throw new Error(`Project ${projectId} not found.`)

  const messages = await db.query.messagesTable.findMany({
    where: { active: true, branchId, id: { in: messageIds }, projectId },
  })
  if (messages.length === 0) return 0

  return translateLocaleValues({ branchId, locale, messages, project })
}

function chunk<T>(items: T[], size: number) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

async function loadLocaleFillContext({
  branchId,
  defaultBranchId,
  messages,
  projectId,
}: {
  branchId: string
  defaultBranchId: string
  messages: Message[]
  projectId: string
}) {
  const defaultBranchMessages =
    branchId === defaultBranchId
      ? []
      : await db.query.messagesTable.findMany({
          where: {
            active: true,
            branchId: defaultBranchId,
            lookupId: { in: messages.map((message) => message.lookupId) },
            projectId,
          },
        })
  const branchValues = await db.query.localeValuesTable.findMany({
    where: { branchId, messageId: { in: messages.map((message) => message.id) }, projectId },
  })
  const defaultBranchValues =
    defaultBranchMessages.length === 0
      ? []
      : await db.query.localeValuesTable.findMany({
          where: {
            branchId: defaultBranchId,
            messageId: { in: defaultBranchMessages.map((message) => message.id) },
            projectId,
          },
        })

  return {
    branchValueByMessageAndLocale: new Map(branchValues.map((value) => [localeValueKey(value.messageId, value.locale), value])),
    defaultBranchMessageByLookupId: new Map(defaultBranchMessages.map((message) => [message.lookupId, message])),
    defaultBranchValueByMessageAndLocale: new Map(
      defaultBranchValues.map((value) => [localeValueKey(value.messageId, value.locale), value]),
    ),
  }
}

function getLocaleFillPlan({
  branchValueByMessageAndLocale,
  defaultBranchMessageByLookupId,
  defaultBranchValueByMessageAndLocale,
  locale,
  messages,
}: Awaited<ReturnType<typeof loadLocaleFillContext>> & {
  locale: string
  messages: Message[]
}) {
  return messages
    .filter((message) => shouldFillBranchValue(message, branchValueByMessageAndLocale.get(localeValueKey(message.id, locale))))
    .map((message) => ({
      defaultBranchValue: getMatchingDefaultBranchValue({
        defaultBranchMessageByLookupId,
        defaultBranchValueByMessageAndLocale,
        locale,
        message,
      }),
      message,
    }))
}

function shouldFillBranchValue(message: Message, branchValue: LocaleValue | undefined) {
  if (!branchValue) return true
  if (branchValue.source === "manual") return false
  return branchValue.baseValueHash !== message.defaultMessageHash
}

function getMatchingDefaultBranchValue({
  defaultBranchMessageByLookupId,
  defaultBranchValueByMessageAndLocale,
  locale,
  message,
}: {
  defaultBranchMessageByLookupId: Map<string, Message>
  defaultBranchValueByMessageAndLocale: Map<string, LocaleValue>
  locale: string
  message: Message
}) {
  const defaultBranchMessage = defaultBranchMessageByLookupId.get(message.lookupId)
  if (!defaultBranchMessage) return null
  if (defaultBranchMessage.defaultMessageHash !== message.defaultMessageHash) return null
  return defaultBranchValueByMessageAndLocale.get(localeValueKey(defaultBranchMessage.id, locale)) ?? null
}

async function copyDefaultBranchLocaleValue({
  branchId,
  defaultBranchValue,
  locale,
  message,
  projectId,
}: {
  branchId: string
  defaultBranchValue: LocaleValue
  locale: string
  message: Message
  projectId: string
}) {
  await db
    .insert(localeValuesTable)
    .values({
      baseValueHash: message.defaultMessageHash,
      branchId,
      locale,
      messageId: message.id,
      projectId,
      source: "imported",
      value: defaultBranchValue.value,
      valueHash: defaultBranchValue.valueHash,
    })
    .onConflictDoUpdate({
      target: [localeValuesTable.branchId, localeValuesTable.messageId, localeValuesTable.locale],
      set: {
        baseValueHash: message.defaultMessageHash,
        source: "imported",
        value: defaultBranchValue.value,
        valueHash: defaultBranchValue.valueHash,
        updatedAt: new Date(),
      },
    })
}

async function translateLocaleValues({
  branchId,
  locale,
  messages,
  project,
}: {
  branchId: string
  locale: string
  messages: Message[]
  project: typeof projectsTable.$inferSelect
}) {
  const translations = await translateMessagesWithPlatform({
    concurrency: TRANSLATION_CONCURRENCY,
    glossaryTerms: await listEnabledTranslationGlossaryTerms(project.id, locale),
    locale,
    prompt: project.translationPrompt,
    messages: messages.map((message) => ({
      context: typeof message.meta.context === "string" ? message.meta.context : undefined,
      defaultMessage: message.defaultMessage,
      id: message.lookupId,
      placeholders: message.placeholders,
      sources: message.sources,
    })),
  })

  for (const message of messages) {
    const value = translations[message.lookupId]?.trim()
    if (!value) throw new Error(`The Platform translator returned no value for ${message.lookupId}.`)
    await upsertTranslatedLocaleValue({ branchId, locale, message, projectId: project.id, value })
  }

  return messages.length
}

async function upsertTranslatedLocaleValue({
  branchId,
  locale,
  message,
  projectId,
  value,
}: {
  branchId: string
  locale: string
  message: Message
  projectId: string
  value: string
}) {
  await db
    .insert(localeValuesTable)
    .values({
      baseValueHash: message.defaultMessageHash,
      branchId,
      locale,
      messageId: message.id,
      projectId,
      source: "ai",
      value,
      valueHash: createStableHash(value),
    })
    .onConflictDoUpdate({
      target: [localeValuesTable.branchId, localeValuesTable.messageId, localeValuesTable.locale],
      set: {
        baseValueHash: message.defaultMessageHash,
        source: "ai",
        value,
        valueHash: createStableHash(value),
        updatedAt: new Date(),
      },
    })
}

function localeValueKey(messageId: string, locale: string) {
  return `${messageId}:${locale}`
}
