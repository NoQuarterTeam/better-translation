import { createFileRoute } from "@tanstack/react-router"
import { waitUntil } from "@vercel/functions"
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm"
import * as z from "zod"

import { db } from "@/server/db"
import { localeValuesTable, messagesTable, apiKeysTable, projectsTable, branchesTable } from "@/server/db/schema"
import { createStableHash, DEFAULT_TRANSLATION_BRANCH, readBearerToken } from "@/server/platform"
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

        await db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.id, projectAuth.apiKeyId))

        const [defaultBranch] = await db
          .insert(branchesTable)
          .values({
            projectId: projectAuth.project.id,
            name: DEFAULT_TRANSLATION_BRANCH,
            isDefault: true,
          })
          .onConflictDoNothing({
            target: [branchesTable.projectId, branchesTable.name],
          })
          .returning()

        const defaultBranchId =
          defaultBranch?.id ??
          (
            await db
              .select({ id: branchesTable.id })
              .from(branchesTable)
              .where(and(eq(branchesTable.projectId, projectAuth.project.id), eq(branchesTable.name, DEFAULT_TRANSLATION_BRANCH)))
              .limit(1)
          )[0]?.id

        const [branch] = await db
          .insert(branchesTable)
          .values({
            projectId: projectAuth.project.id,
            name: params.branchName,
            parentBranchId: params.branchName === DEFAULT_TRANSLATION_BRANCH ? null : defaultBranchId,
            isDefault: params.branchName === DEFAULT_TRANSLATION_BRANCH,
          })
          .onConflictDoNothing({
            target: [branchesTable.projectId, branchesTable.name],
          })
          .returning()

        const branchId =
          branch?.id ??
          (
            await db
              .select({ id: branchesTable.id })
              .from(branchesTable)
              .where(and(eq(branchesTable.projectId, projectAuth.project.id), eq(branchesTable.name, params.branchName)))
              .limit(1)
          )[0]?.id

        if (!branchId) return json({ error: "Could not create Translation Branch" }, 500)

        const [syncedBranch] = await db.select().from(branchesTable).where(eq(branchesTable.id, branchId)).limit(1)

        if (!syncedBranch) return json({ error: "Could not load Translation Branch" }, 500)

        await db
          .update(projectsTable)
          .set({
            defaultLocale: parsed.data.defaultLocale,
            locales: parsed.data.locales,
            updatedAt: new Date(),
          })
          .where(eq(projectsTable.id, projectAuth.project.id))

        const incomingMessageIds = Object.keys(parsed.data.messages)
        for (const [messageId, message] of Object.entries(parsed.data.messages)) {
          await db
            .insert(messagesTable)
            .values({
              projectId: projectAuth.project.id,
              messageId,
              defaultMessage: message.defaultMessage,
              defaultMessageHash: createStableHash(message.defaultMessage),
              meta: message.meta,
              placeholders: message.placeholders,
              sources: message.sources,
              active: true,
            })
            .onConflictDoUpdate({
              target: [messagesTable.projectId, messagesTable.messageId],
              set: {
                defaultMessage: message.defaultMessage,
                defaultMessageHash: createStableHash(message.defaultMessage),
                meta: message.meta,
                placeholders: message.placeholders,
                sources: message.sources,
                active: true,
                updatedAt: new Date(),
              },
            })
        }

        if (incomingMessageIds.length > 0) {
          await db
            .update(messagesTable)
            .set({ active: false, updatedAt: new Date() })
            .where(
              and(eq(messagesTable.projectId, projectAuth.project.id), notInArray(messagesTable.messageId, incomingMessageIds)),
            )
        } else {
          await db
            .update(messagesTable)
            .set({ active: false, updatedAt: new Date() })
            .where(eq(messagesTable.projectId, projectAuth.project.id))
        }

        const activeMessages = await db
          .select()
          .from(messagesTable)
          .where(and(eq(messagesTable.projectId, projectAuth.project.id), eq(messagesTable.active, true)))

        const translationQueued =
          projectAuth.project.autoTranslate &&
          activeMessages.length > 0 &&
          parsed.data.locales.some((locale) => locale !== parsed.data.defaultLocale)

        if (translationQueued) {
          waitUntil(
            fillMissingLocaleValues({
              branch: syncedBranch,
              defaultLocale: parsed.data.defaultLocale,
              locales: parsed.data.locales,
              messages: activeMessages,
              project: projectAuth.project,
            }).catch((error: unknown) => {
              console.error("Failed to fill missing Locale values after Manifest sync", error)
            }),
          )
        }

        await db
          .update(branchesTable)
          .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
          .where(eq(branchesTable.id, branchId))

        return json({
          projectId: projectAuth.project.publicId,
          branch: params.branchName,
          defaultLocale: parsed.data.defaultLocale,
          locales: parsed.data.locales,
          messageCount: incomingMessageIds.length,
          translationQueued,
        })
      },
    },
  },
})

async function fillMissingLocaleValues({
  branch,
  defaultLocale,
  locales,
  messages,
  project,
}: {
  branch: typeof branchesTable.$inferSelect
  defaultLocale: string
  locales: string[]
  messages: (typeof messagesTable.$inferSelect)[]
  project: typeof projectsTable.$inferSelect
}) {
  if (!project.autoTranslate) return 0
  if (messages.length === 0) return 0

  const targetLocales = locales.filter((locale) => locale !== defaultLocale)
  if (targetLocales.length === 0) return 0

  const branchIds = branch.parentBranchId ? [branch.id, branch.parentBranchId] : [branch.id]
  const existingValues = await db
    .select({
      branchId: localeValuesTable.branchId,
      locale: localeValuesTable.locale,
      messageId: localeValuesTable.messageId,
    })
    .from(localeValuesTable)
    .where(and(eq(localeValuesTable.projectId, project.id), inArray(localeValuesTable.branchId, branchIds)))

  let translatedValueCount = 0

  for (const locale of targetLocales) {
    const missingMessages = messages.filter((message) => {
      const hasBranchValue = existingValues.some(
        (value) => value.branchId === branch.id && value.messageId === message.id && value.locale === locale,
      )
      const hasParentValue = existingValues.some(
        (value) => value.branchId === branch.parentBranchId && value.messageId === message.id && value.locale === locale,
      )
      return !hasBranchValue && !hasParentValue
    })

    if (missingMessages.length === 0) continue

    const translations = await translateMessagesWithPlatform({
      locale,
      model: project.translationModel,
      prompt: project.translationPrompt,
      messages: missingMessages.map((message) => ({
        context: typeof message.meta.context === "string" ? message.meta.context : undefined,
        defaultMessage: message.defaultMessage,
        id: message.messageId,
        placeholders: message.placeholders,
        sources: message.sources,
      })),
    })

    for (const message of missingMessages) {
      const value = translations[message.messageId]?.trim()
      if (!value) throw new Error(`The Platform translator returned no value for ${message.messageId}.`)

      const [insertedValue] = await db
        .insert(localeValuesTable)
        .values({
          branchId: branch.id,
          locale,
          messageId: message.id,
          parentValueHash: message.defaultMessageHash,
          projectId: project.id,
          source: "ai",
          value,
          valueHash: createStableHash(value),
        })
        .onConflictDoNothing({
          target: [localeValuesTable.branchId, localeValuesTable.messageId, localeValuesTable.locale],
        })
        .returning({ id: localeValuesTable.id })

      if (insertedValue) translatedValueCount += 1
    }
  }

  return translatedValueCount
}

async function getAuthorizedProject(projectId: string, token: string) {
  const [row] = await db
    .select({
      apiKeyId: apiKeysTable.id,
      project: projectsTable,
    })
    .from(apiKeysTable)
    .innerJoin(projectsTable, eq(apiKeysTable.projectId, projectsTable.id))
    .where(
      and(
        eq(projectsTable.publicId, projectId),
        eq(apiKeysTable.keyHash, createStableHash(token)),
        isNull(apiKeysTable.revokedAt),
      ),
    )
    .limit(1)

  return row ?? null
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
