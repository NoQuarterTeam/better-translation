import { createFileRoute } from "@tanstack/react-router"
import { and, eq, notInArray } from "drizzle-orm"
import * as z from "zod"

import { db } from "@/server/db"
import { apiKeysTable, branchesTable, localeValuesTable, messagesTable, projectsTable } from "@/server/db/schema"
import { createProjectApiKeyHash, createStableHash, readBearerToken } from "@/server/platform"
import { translateMessagesWithPlatform } from "@/server/platform-translator"

const manifestSourceSchema = z.object({
  column: z.number().int().optional(),
  endColumn: z.number().int().optional(),
  endLine: z.number().int().optional(),
  file: z.string().trim().min(1),
  kind: z.string().optional(),
  line: z.number().int().optional(),
  marker: z.string().optional(),
})

const manifestEntrySchema = z.object({
  defaultMessage: z.string().min(1),
  meta: z.record(z.string(), z.unknown()).optional().default({}),
  placeholders: z.array(z.string().trim().min(1)).optional().default([]),
  sources: z.array(manifestSourceSchema).optional().default([]),
})

const manifestSyncSchema = z
  .object({
    defaultLocale: z.string().trim().min(2).max(20),
    locales: z.array(z.string().trim().min(2).max(20)).min(1).max(20),
    messages: z.record(z.string().trim().min(1), manifestEntrySchema),
  })
  .transform((manifest) => {
    const defaultLocale = manifest.defaultLocale.toLowerCase()
    return {
      ...manifest,
      defaultLocale,
      locales: [...new Set([defaultLocale, ...manifest.locales.map((locale) => locale.toLowerCase())])],
    }
  })

type ManifestSync = z.infer<typeof manifestSyncSchema>
type ManifestMessages = ManifestSync["messages"]
type Message = typeof messagesTable.$inferSelect
type LocaleValue = typeof localeValuesTable.$inferSelect

export const Route = createFileRoute("/api/projects/$projectId/branches/$branchName/manifest")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const token = readBearerToken(request)
        if (!token) return json({ error: "Missing bearer token" }, 401)

        const projectAuth = await getAuthorizedProject(params.projectId, token)
        if (!projectAuth) return json({ error: "Invalid Project API key" }, 401)

        const parsed = manifestSyncSchema.safeParse(await request.json())
        if (!parsed.success) return json({ error: "Invalid Manifest payload", issues: parsed.error.issues }, 400)

        await markApiKeyUsed(projectAuth.apiKeyId)

        const branch = await upsertBranch({
          defaultLocale: parsed.data.defaultLocale,
          locales: parsed.data.locales,
          name: params.branchName,
          projectId: projectAuth.project.id,
        })
        const defaultBranchId = projectAuth.project.defaultBranchId ?? branch.id

        await updateProjectManifestState({ defaultBranchId, projectId: projectAuth.project.id })

        const syncedMessages = await syncBranchMessages({
          branchId: branch.id,
          messages: parsed.data.messages,
          projectId: projectAuth.project.id,
        })

        const filledValueCount = await fillMissingLocaleValues({
          branch,
          defaultBranchId,
          messages: syncedMessages,
          project: projectAuth.project,
        })

        await markBranchSynced(branch.id)

        return json({
          projectId: projectAuth.project.publicId,
          branch: params.branchName,
          defaultLocale: parsed.data.defaultLocale,
          locales: parsed.data.locales,
          filledValueCount,
          messageCount: syncedMessages.length,
        })
      },
    },
  },
})

async function markApiKeyUsed(apiKeyId: string) {
  await db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.id, apiKeyId))
}

async function upsertBranch({
  defaultLocale,
  locales,
  name,
  projectId,
}: {
  defaultLocale: string
  locales: string[]
  name: string
  projectId: string
}) {
  const [branch] = await db
    .insert(branchesTable)
    .values({ defaultLocale, locales, projectId, name })
    .onConflictDoUpdate({
      target: [branchesTable.projectId, branchesTable.name],
      set: { archivedAt: null, defaultLocale, locales, updatedAt: new Date() },
    })
    .returning()

  if (!branch) throw new Error("Could not create Branch.")
  return branch
}

async function updateProjectManifestState({ defaultBranchId, projectId }: { defaultBranchId: string; projectId: string }) {
  await db.update(projectsTable).set({ defaultBranchId, updatedAt: new Date() }).where(eq(projectsTable.id, projectId))
}

async function syncBranchMessages({
  branchId,
  messages,
  projectId,
}: {
  branchId: string
  messages: ManifestMessages
  projectId: string
}) {
  const syncedMessages = []

  for (const [lookupId, message] of Object.entries(messages)) {
    const syncedMessage = await upsertBranchMessage({ branchId, lookupId, message, projectId })
    syncedMessages.push(syncedMessage)
  }

  await deactivateMissingBranchMessages({ branchId, messageIds: syncedMessages.map((message) => message.id) })

  return syncedMessages
}

async function upsertBranchMessage({
  branchId,
  lookupId,
  message,
  projectId,
}: {
  branchId: string
  lookupId: string
  message: ManifestMessages[string]
  projectId: string
}) {
  const defaultMessageHash = createStableHash(message.defaultMessage)
  const [syncedMessage] = await db
    .insert(messagesTable)
    .values({
      active: true,
      branchId,
      defaultMessage: message.defaultMessage,
      defaultMessageHash,
      lookupId,
      meta: message.meta,
      placeholders: message.placeholders,
      projectId,
      sources: message.sources,
    })
    .onConflictDoUpdate({
      target: [messagesTable.branchId, messagesTable.lookupId],
      set: {
        active: true,
        defaultMessage: message.defaultMessage,
        defaultMessageHash,
        meta: message.meta,
        placeholders: message.placeholders,
        sources: message.sources,
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!syncedMessage) throw new Error(`Could not sync Message ${lookupId}.`)
  return syncedMessage
}

async function deactivateMissingBranchMessages({ branchId, messageIds }: { branchId: string; messageIds: string[] }) {
  const query = db.update(messagesTable).set({ active: false, updatedAt: new Date() })

  if (messageIds.length === 0) {
    await query.where(eq(messagesTable.branchId, branchId))
    return
  }

  await query.where(and(eq(messagesTable.branchId, branchId), notInArray(messagesTable.id, messageIds)))
}

async function markBranchSynced(branchId: string) {
  await db.update(branchesTable).set({ lastSyncedAt: new Date(), updatedAt: new Date() }).where(eq(branchesTable.id, branchId))
}

async function fillMissingLocaleValues({
  branch,
  defaultBranchId,
  messages,
  project,
}: {
  branch: typeof branchesTable.$inferSelect
  defaultBranchId: string
  messages: (typeof messagesTable.$inferSelect)[]
  project: typeof projectsTable.$inferSelect
}) {
  if (messages.length === 0) return 0

  const targetLocales = branch.locales.filter((locale) => locale !== branch.defaultLocale)
  if (targetLocales.length === 0) return 0

  const fillContext = await loadLocaleFillContext({
    branchId: branch.id,
    defaultBranchId,
    messages,
    projectId: project.id,
  })

  let filledValueCount = 0

  for (const locale of targetLocales) {
    const fillPlan = getLocaleFillPlan({ ...fillContext, locale, messages })
    if (fillPlan.length === 0) continue

    const messagesNeedingTranslation = []

    for (const item of fillPlan) {
      if (item.defaultBranchValue) {
        await copyDefaultBranchLocaleValue({
          branchId: branch.id,
          defaultBranchValue: item.defaultBranchValue,
          locale,
          message: item.message,
          projectId: project.id,
        })
        filledValueCount += 1
        continue
      }

      messagesNeedingTranslation.push(item.message)
    }

    if (messagesNeedingTranslation.length === 0) continue

    filledValueCount += await translateLocaleValues({
      branchId: branch.id,
      locale,
      messages: messagesNeedingTranslation,
      project,
    })
  }

  return filledValueCount
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

async function getAuthorizedProject(projectId: string, token: string) {
  const apiKey = await db.query.apiKeysTable.findFirst({
    columns: { id: true },
    where: {
      keyHash: createProjectApiKeyHash(token),
      project: { publicId: projectId },
      revokedAt: { isNull: true },
    },
    with: { project: true },
  })

  if (!apiKey?.project) return null

  return { apiKeyId: apiKey.id, project: apiKey.project }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-cache",
    },
  })
}
