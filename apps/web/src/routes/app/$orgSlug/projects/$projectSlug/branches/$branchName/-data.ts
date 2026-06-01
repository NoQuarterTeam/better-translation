import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import * as z from "zod"

import { projectMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { localeValueInsertSchema, localeValuesTable, type LocaleValue, type messagesTable } from "@/server/db/schema"
import { createStableHash } from "@/server/platform"
import { translateMessageWithPlatform } from "@/server/platform-translator"

const branchInputSchema = z.object({
  branchName: z.string().trim().min(1),
})

export const getBranchWorkspaceFn = createServerFn({ method: "GET" })
  .middleware([projectMiddleware])
  .inputValidator(parseZod(branchInputSchema))
  .handler(async ({ context, data }) => {
    const { project } = context
    const branch = await getProjectBranch(project.id, data.branchName)
    const messages = await db.query.messagesTable.findMany({
      orderBy: { updatedAt: "desc" },
      where: { active: true, branchId: branch.id, projectId: project.id },
    })

    const branchValues =
      messages.length === 0
        ? []
        : await db.query.localeValuesTable.findMany({
            where: {
              branchId: branch.id,
              messageId: { in: messages.map((message) => message.id) },
              projectId: project.id,
            },
          })
    const branchValueByMessageAndLocale = new Map(branchValues.map((value) => [`${value.messageId}:${value.locale}`, value]))

    return {
      project,
      branch,
      messages: messages.map((message) => ({
        context: typeof message.meta.context === "string" ? message.meta.context : null,
        createdAt: message.createdAt,
        defaultMessage: message.defaultMessage,
        defaultMessageHash: message.defaultMessageHash,
        id: message.id,
        localeValues: getMessageLocaleValues({
          branchValueByMessageAndLocale,
          defaultLocale: branch.defaultLocale,
          locales: branch.locales,
          message,
        }),
        lookupId: message.lookupId,
        placeholders: message.placeholders,
        projectId: message.projectId,
        sources: message.sources,
        updatedAt: message.updatedAt,
      })),
    }
  })

export const branchWorkspaceQueryOptions = (orgSlug: string, projectSlug: string, branchName: string) =>
  queryOptions({
    queryKey: ["branch-workspace", orgSlug, projectSlug, branchName],
    queryFn: () => getBranchWorkspaceFn({ data: { orgSlug, projectSlug, branchName } }),
  })

export const saveLocaleValueFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(
    parseZod(
      localeValueInsertSchema
        .pick({
          locale: true,
          value: true,
        })
        .extend({
          branchName: branchInputSchema.shape.branchName,
          lookupId: z.string().trim().min(1),
        }),
    ),
  )
  .handler(async ({ context, data }) => {
    const { project } = context
    const branch = await getProjectBranch(project.id, data.branchName)
    const message = await getProjectMessage(project.id, branch.id, data.lookupId)

    if (data.locale === branch.defaultLocale) throw new Error("Default locale Messages come from the Manifest.")
    if (!branch.locales.includes(data.locale)) throw new Error("Locale is not configured for this Branch.")

    return upsertLocaleValue({
      branchId: branch.id,
      locale: data.locale,
      message,
      projectId: project.id,
      source: "manual",
      updatedById: context.user.id,
      value: data.value,
      baseValueHash: message.defaultMessageHash,
    })
  })

export const translateLocaleValueFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(
    parseZod(
      z.object({
        branchName: branchInputSchema.shape.branchName,
        lookupId: z.string().trim().min(1),
        locale: localeValueInsertSchema.shape.locale,
      }),
    ),
  )
  .handler(async ({ context, data }) => {
    const { project } = context
    const branch = await getProjectBranch(project.id, data.branchName)
    const message = await getProjectMessage(project.id, branch.id, data.lookupId)

    if (data.locale === branch.defaultLocale) throw new Error("Default locale Messages come from the Manifest.")
    if (!branch.locales.includes(data.locale)) throw new Error("Locale is not configured for this Branch.")

    const value = await translateMessageWithPlatform({
      locale: data.locale,
      message: {
        context: typeof message.meta.context === "string" ? message.meta.context : undefined,
        defaultMessage: message.defaultMessage,
        id: message.lookupId,
        placeholders: message.placeholders,
        sources: message.sources,
      },
      model: project.translationModel,
      prompt: project.translationPrompt,
    })

    return upsertLocaleValue({
      branchId: branch.id,
      locale: data.locale,
      message,
      projectId: project.id,
      source: "ai",
      updatedById: context.user.id,
      value,
      baseValueHash: message.defaultMessageHash,
    })
  })

function getMessageLocaleValues({
  branchValueByMessageAndLocale,
  defaultLocale,
  locales,
  message,
}: {
  branchValueByMessageAndLocale: Map<string, LocaleValue>
  defaultLocale: string
  locales: string[]
  message: typeof messagesTable.$inferSelect
}) {
  const localeValues: Record<string, ReturnType<typeof getMessageLocaleValue>> = {}

  for (const locale of locales) {
    localeValues[locale] = getMessageLocaleValue({
      branchValue: branchValueByMessageAndLocale.get(`${message.id}:${locale}`),
      isDefaultLocale: locale === defaultLocale,
      message,
    })
  }

  return localeValues
}

function getMessageLocaleValue({
  branchValue,
  isDefaultLocale,
  message,
}: {
  branchValue: LocaleValue | undefined
  isDefaultLocale: boolean
  message: typeof messagesTable.$inferSelect
}) {
  if (!isDefaultLocale && branchValue) {
    return {
      value: branchValue.value,
      source: branchValue.source,
      hasOverride: true,
      stale: branchValue.baseValueHash !== null && branchValue.baseValueHash !== message.defaultMessageHash,
      valueId: branchValue.id,
      updatedAt: branchValue.updatedAt,
    }
  }

  return {
    value: message.defaultMessage,
    source: "default" as const,
    hasOverride: false,
    stale: false,
    valueId: null,
    updatedAt: message.updatedAt,
  }
}

async function getProjectBranch(projectId: string, branchName: string) {
  const branch = await db.query.branchesTable.findFirst({
    where: { archivedAt: { isNull: true }, projectId, name: branchName },
  })

  if (!branch) throw new Error("Branch not found.")
  return branch
}

async function getProjectMessage(projectId: string, branchId: string, lookupId: string) {
  const message = await db.query.messagesTable.findFirst({
    where: { active: true, branchId, lookupId, projectId },
  })

  if (!message) throw new Error("Message does not exist on this Branch.")
  return message
}

async function upsertLocaleValue({
  baseValueHash,
  branchId,
  locale,
  message,
  projectId,
  source,
  updatedById,
  value,
}: {
  baseValueHash: string
  branchId: string
  locale: string
  message: typeof messagesTable.$inferSelect
  projectId: string
  source: typeof localeValuesTable.$inferInsert.source
  updatedById: string
  value: string
}) {
  const trimmedValue = value.trim()
  if (!trimmedValue) throw new Error("Locale value cannot be empty.")

  const [localeValue] = await db
    .insert(localeValuesTable)
    .values({
      baseValueHash,
      branchId,
      locale,
      messageId: message.id,
      projectId,
      source,
      updatedById,
      value: trimmedValue,
      valueHash: createStableHash(trimmedValue),
    })
    .onConflictDoUpdate({
      target: [localeValuesTable.branchId, localeValuesTable.messageId, localeValuesTable.locale],
      set: {
        baseValueHash,
        source,
        updatedById,
        value: trimmedValue,
        valueHash: createStableHash(trimmedValue),
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!localeValue) throw new Error("Could not save Locale value.")
  return localeValue
}
