import { createServerFn } from "@tanstack/react-start"
import { and, desc, eq } from "drizzle-orm"
import * as z from "zod"

import { authMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { branchesTable, localeValueInsertSchema, localeValuesTable, messagesTable, projectsTable } from "@/server/db/schema"
import { getCurrentOrganizationAccess } from "@/server/organizations"
import { createStableHash } from "@/server/platform"
import { translateMessageWithPlatform } from "@/server/platform-translator"

const branchInputSchema = z.object({
  orgSlug: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  branchName: z.string().trim().min(1),
})

const saveLocaleValueInputSchema = localeValueInsertSchema
  .pick({
    locale: true,
    value: true,
  })
  .extend({
    orgSlug: branchInputSchema.shape.orgSlug,
    projectId: branchInputSchema.shape.projectId,
    branchName: branchInputSchema.shape.branchName,
    messageId: z.string().trim().min(1),
  })

const translateLocaleValueInputSchema = z.object({
  orgSlug: branchInputSchema.shape.orgSlug,
  projectId: branchInputSchema.shape.projectId,
  branchName: branchInputSchema.shape.branchName,
  messageId: z.string().trim().min(1),
  locale: saveLocaleValueInputSchema.shape.locale,
})

export const getTranslationBranchWorkspaceFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(branchInputSchema))
  .handler(async ({ context, data }) => {
    const { project, branch } = await getAuthorizedBranch(data, context.user.id)
    const messages = await db
      .select()
      .from(messagesTable)
      .where(and(eq(messagesTable.projectId, project.id), eq(messagesTable.active, true)))
      .orderBy(desc(messagesTable.updatedAt))

    const branchValues = await db.select().from(localeValuesTable).where(eq(localeValuesTable.branchId, branch.id))

    const parentValues = branch.parentBranchId
      ? await db.select().from(localeValuesTable).where(eq(localeValuesTable.branchId, branch.parentBranchId))
      : []

    return {
      project,
      branch,
      parentBranch:
        branch.parentBranchId === null
          ? null
          : ((await db.select().from(branchesTable).where(eq(branchesTable.id, branch.parentBranchId)).limit(1))[0] ?? null),
      messages: messages.map((message) => ({
        active: message.active,
        context: typeof message.meta.context === "string" ? message.meta.context : null,
        createdAt: message.createdAt,
        defaultMessage: message.defaultMessage,
        defaultMessageHash: message.defaultMessageHash,
        id: message.id,
        localeValues: Object.fromEntries(
          project.locales.map((locale) => {
            const branchValue = branchValues.find((value) => value.messageId === message.id && value.locale === locale)
            const parentValue = parentValues.find((value) => value.messageId === message.id && value.locale === locale)
            if (locale === project.defaultLocale) {
              return [
                locale,
                {
                  value: message.defaultMessage,
                  source: "default",
                  hasOverride: false,
                  valueId: null,
                  updatedAt: message.updatedAt,
                },
              ]
            }
            if (branchValue) {
              return [
                locale,
                {
                  value: branchValue.value,
                  source: branchValue.source,
                  hasOverride: true,
                  valueId: branchValue.id,
                  updatedAt: branchValue.updatedAt,
                },
              ]
            }
            if (parentValue) {
              return [
                locale,
                {
                  value: parentValue.value,
                  source: "inherited",
                  hasOverride: false,
                  valueId: parentValue.id,
                  updatedAt: parentValue.updatedAt,
                },
              ]
            }
            return [
              locale,
              {
                value: message.defaultMessage,
                source: "default",
                hasOverride: false,
                valueId: null,
                updatedAt: message.updatedAt,
              },
            ]
          }),
        ),
        messageId: message.messageId,
        placeholders: message.placeholders,
        projectId: message.projectId,
        sources: message.sources,
        updatedAt: message.updatedAt,
      })),
    }
  })

export const saveLocaleValueFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(saveLocaleValueInputSchema))
  .handler(async ({ context, data }) => {
    const { project, branch } = await getAuthorizedBranch(data, context.user.id)
    const message = await getProjectMessage(project.id, data.messageId)

    if (data.locale === project.defaultLocale) throw new Error("Default locale Messages come from the Manifest.")
    if (!project.locales.includes(data.locale)) throw new Error("Locale is not configured for this Project.")

    return upsertLocaleValue({
      branchId: branch.id,
      locale: data.locale,
      message,
      projectId: project.id,
      source: "manual",
      updatedById: context.user.id,
      value: data.value,
      parentValueHash: await getParentValueHash(branch.parentBranchId, message.id, data.locale, message.defaultMessageHash),
    })
  })

export const translateLocaleValueFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(translateLocaleValueInputSchema))
  .handler(async ({ context, data }) => {
    const { project, branch } = await getAuthorizedBranch(data, context.user.id)
    const message = await getProjectMessage(project.id, data.messageId)

    if (!project.autoTranslate) throw new Error("The Platform translator is disabled for this Project.")
    if (data.locale === project.defaultLocale) throw new Error("Default locale Messages come from the Manifest.")
    if (!project.locales.includes(data.locale)) throw new Error("Locale is not configured for this Project.")

    const value = await translateMessageWithPlatform({
      locale: data.locale,
      message: {
        context: typeof message.meta.context === "string" ? message.meta.context : undefined,
        defaultMessage: message.defaultMessage,
        id: message.messageId,
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
      parentValueHash: await getParentValueHash(branch.parentBranchId, message.id, data.locale, message.defaultMessageHash),
    })
  })

async function getAuthorizedBranch(params: { orgSlug: string; projectId: string; branchName: string }, userId: number) {
  const organizationAccess = await getCurrentOrganizationAccess({ slug: params.orgSlug, userId })
  if (!organizationAccess) throw new Error("Organization not found.")

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(
      and(eq(projectsTable.publicId, params.projectId), eq(projectsTable.organizationId, organizationAccess.organization.id)),
    )
    .limit(1)

  if (!project) throw new Error("Project not found.")

  const [branch] = await db
    .select()
    .from(branchesTable)
    .where(and(eq(branchesTable.projectId, project.id), eq(branchesTable.name, params.branchName)))
    .limit(1)

  if (!branch) throw new Error("Translation Branch not found.")

  return { project, branch }
}

async function getProjectMessage(projectId: number, messageId: string) {
  const [message] = await db
    .select()
    .from(messagesTable)
    .where(and(eq(messagesTable.projectId, projectId), eq(messagesTable.messageId, messageId)))
    .limit(1)

  if (!message) throw new Error("Message does not exist on this Project.")
  return message
}

async function getParentValueHash(parentBranchId: number | null, messageId: number, locale: string, defaultMessageHash: string) {
  if (!parentBranchId) return defaultMessageHash

  const [parentValue] = await db
    .select({ valueHash: localeValuesTable.valueHash })
    .from(localeValuesTable)
    .where(
      and(
        eq(localeValuesTable.branchId, parentBranchId),
        eq(localeValuesTable.messageId, messageId),
        eq(localeValuesTable.locale, locale),
      ),
    )
    .limit(1)

  return parentValue?.valueHash ?? defaultMessageHash
}

async function upsertLocaleValue({
  branchId,
  locale,
  message,
  parentValueHash,
  projectId,
  source,
  updatedById,
  value,
}: {
  branchId: number
  locale: string
  message: typeof messagesTable.$inferSelect
  parentValueHash: string
  projectId: number
  source: "ai" | "manual"
  updatedById: number
  value: string
}) {
  const trimmedValue = value.trim()
  if (!trimmedValue) throw new Error("Locale value cannot be empty.")

  const [localeValue] = await db
    .insert(localeValuesTable)
    .values({
      branchId,
      locale,
      messageId: message.id,
      parentValueHash,
      projectId,
      source,
      updatedById,
      value: trimmedValue,
      valueHash: createStableHash(trimmedValue),
    })
    .onConflictDoUpdate({
      target: [localeValuesTable.branchId, localeValuesTable.messageId, localeValuesTable.locale],
      set: {
        parentValueHash,
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
