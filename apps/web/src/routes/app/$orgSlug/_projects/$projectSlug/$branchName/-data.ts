import { queryOptions, type QueryClient } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { setCookie } from "@tanstack/react-start/server"
import * as z from "zod"

import { projectMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { localeValueInsertSchema, localeValuesTable, type LocaleValue, type messagesTable } from "@/server/db/schema"
import { createStableHash } from "@/server/platform"
import { translateMessageWithPlatform } from "@/server/platform-translator"

import {
  currentProjectSwitcherQueryOptions,
  projectBranchRedirectNameQueryOptions,
  projectSwitcherProjectsQueryOptions,
} from "../-data"

const branchInputSchema = z.object({
  branchName: z.string().trim().min(1),
})

export const messageViewSchema = z.enum(["all", "needs-value", "manual", "ai"]).catch("all")
export type MessageView = z.infer<typeof messageViewSchema>

const branchMessagesInputSchema = branchInputSchema.extend({
  q: z.string().trim().optional().catch(undefined),
  view: messageViewSchema,
})

const branchMessageDetailInputSchema = branchInputSchema.extend({
  messageId: z.string().trim().min(1),
})

export const listBranchMessagesFn = createServerFn({ method: "GET" })
  .middleware([projectMiddleware])
  .inputValidator(parseZod(branchMessagesInputSchema))
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
    const valuesByMessageId = new Map<string, LocaleValue[]>()

    for (const value of branchValues) {
      const messageValues = valuesByMessageId.get(value.messageId) ?? []
      messageValues.push(value)
      valuesByMessageId.set(value.messageId, messageValues)
    }

    const editableLocales = branch.locales.filter((locale) => locale !== branch.defaultLocale)
    const query = data.q?.toLowerCase()
    const filteredMessages = messages
      .filter((message) => {
        const messageValues = valuesByMessageId.get(message.id) ?? []

        if (query) {
          const searchableValues = [message.defaultMessage, ...messageValues.map((value) => value.value)]
          if (!searchableValues.some((value) => value.toLowerCase().includes(query))) return false
        }

        if (data.view === "all") return true

        const completeness = getMessageCompleteness({
          branchValueByMessageAndLocale,
          editableLocales,
          messageId: message.id,
        })

        if (data.view === "needs-value") return completeness.done < completeness.total
        return messageValues.some((value) => value.source === data.view)
      })
      .sort((left, right) => {
        const leftComplete = getMessageCompleteness({
          branchValueByMessageAndLocale,
          editableLocales,
          messageId: left.id,
        })
        const rightComplete = getMessageCompleteness({
          branchValueByMessageAndLocale,
          editableLocales,
          messageId: right.id,
        })

        return Number(leftComplete.done === leftComplete.total) - Number(rightComplete.done === rightComplete.total)
      })

    const incompleteCount = messages.filter((message) => {
      const completeness = getMessageCompleteness({
        branchValueByMessageAndLocale,
        editableLocales,
        messageId: message.id,
      })
      return completeness.done < completeness.total
    }).length

    return {
      project,
      branch,
      incompleteCount,
      messages: filteredMessages.map((message) => ({
        defaultMessage: message.defaultMessage,
        id: message.id,
        lookupId: message.lookupId,
        ...getMessageCompleteness({
          branchValueByMessageAndLocale,
          editableLocales,
          messageId: message.id,
        }),
        updatedAt: message.updatedAt,
      })),
      totalMessageCount: messages.length,
    }
  })

export const getBranchMessageDetailFn = createServerFn({ method: "GET" })
  .middleware([projectMiddleware])
  .inputValidator(parseZod(branchMessageDetailInputSchema))
  .handler(async ({ context, data }) => {
    const { project } = context
    const branch = await getProjectBranch(project.id, data.branchName)
    const message = await getProjectMessageById(project.id, branch.id, data.messageId)
    const branchValues = await db.query.localeValuesTable.findMany({
      where: { branchId: branch.id, messageId: message.id, projectId: project.id },
    })
    const branchValueByMessageAndLocale = new Map(branchValues.map((value) => [`${value.messageId}:${value.locale}`, value]))

    return {
      project,
      branch,
      message: {
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
      },
    }
  })

export const branchMessagesQueryOptions = (
  orgSlug: string,
  projectSlug: string,
  branchName: string,
  options: { q?: string; view: MessageView },
) =>
  queryOptions({
    queryKey: ["branch-messages", orgSlug, projectSlug, branchName, options],
    queryFn: () => listBranchMessagesFn({ data: { orgSlug, projectSlug, branchName, ...options } }),
  })

export const branchMessageDetailQueryOptions = (orgSlug: string, projectSlug: string, branchName: string, messageId: string) =>
  queryOptions({
    queryKey: ["branch-message-detail", orgSlug, projectSlug, branchName, messageId],
    queryFn: () => getBranchMessageDetailFn({ data: { orgSlug, projectSlug, branchName, messageId } }),
  })

export const getCurrentBranchSwitcherFn = createServerFn({ method: "GET" })
  .middleware([projectMiddleware])
  .inputValidator(parseZod(branchInputSchema))
  .handler(async ({ context, data }) => {
    const branch = await getProjectBranch(context.project.id, data.branchName)
    return {
      id: branch.id,
      isDefault: branch.id === context.project.defaultBranchId,
      name: branch.name,
    }
  })

export const listBranchSwitcherBranchesFn = createServerFn({ method: "GET" })
  .middleware([projectMiddleware])
  .handler(async ({ context }) => {
    const { project } = context
    const branches = await db.query.branchesTable.findMany({
      columns: { id: true, name: true },
      orderBy: { updatedAt: "desc" },
      where: { archivedAt: { isNull: true }, projectId: project.id },
    })

    return branches
      .map((branch) => ({
        ...branch,
        isDefault: branch.id === project.defaultBranchId,
      }))
      .sort((left, right) => Number(right.isDefault) - Number(left.isDefault))
  })

export const setSelectedBranchFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(parseZod(branchInputSchema))
  .handler(async ({ context, data }) => {
    const branch = await db.query.branchesTable.findFirst({
      columns: { name: true },
      where: { archivedAt: { isNull: true }, projectId: context.project.id, name: data.branchName },
    })

    if (!branch) throw notFound()

    setCookie(getSelectedBranchCookieName(context.project.publicId), branch.name, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })

    return branch
  })

export const currentBranchSwitcherQueryOptions = (orgSlug: string, projectSlug: string, branchName: string) =>
  queryOptions({
    queryKey: ["current-branch-switcher", orgSlug, projectSlug, branchName],
    queryFn: () => getCurrentBranchSwitcherFn({ data: { orgSlug, projectSlug, branchName } }),
  })

export const branchSwitcherBranchesQueryOptions = (orgSlug: string, projectSlug: string) =>
  queryOptions({
    queryKey: ["branch-switcher-branches", orgSlug, projectSlug],
    queryFn: () => listBranchSwitcherBranchesFn({ data: { orgSlug, projectSlug } }),
  })

export function setSelectedBranchChromeQueryData(
  queryClient: QueryClient,
  orgSlug: string,
  projectSlug: string,
  branchName: string,
) {
  queryClient.setQueryData(projectBranchRedirectNameQueryOptions(orgSlug, projectSlug).queryKey, branchName)
}

export function invalidateSelectedBranchChromeQueries(queryClient: QueryClient, orgSlug: string, projectSlug: string) {
  void queryClient.invalidateQueries(currentProjectSwitcherQueryOptions(orgSlug, projectSlug))
  void queryClient.invalidateQueries(projectBranchRedirectNameQueryOptions(orgSlug, projectSlug))
  void queryClient.invalidateQueries(projectSwitcherProjectsQueryOptions(orgSlug))
}

export const saveLocaleValueFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(
    parseZod(
      localeValueInsertSchema.pick({ locale: true, value: true }).extend({
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

function getMessageCompleteness({
  branchValueByMessageAndLocale,
  editableLocales,
  messageId,
}: {
  branchValueByMessageAndLocale: Map<string, LocaleValue>
  editableLocales: string[]
  messageId: string
}) {
  const done = editableLocales.filter((locale) => branchValueByMessageAndLocale.has(`${messageId}:${locale}`)).length
  return { done, total: editableLocales.length }
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

  if (!branch) throw notFound()
  return branch
}

function getSelectedBranchCookieName(projectPublicId: string) {
  return `bt_selected_branch_${projectPublicId}`
}

async function getProjectMessage(projectId: string, branchId: string, lookupId: string) {
  const message = await db.query.messagesTable.findFirst({ where: { active: true, branchId, lookupId, projectId } })

  if (!message) throw notFound()
  return message
}

async function getProjectMessageById(projectId: string, branchId: string, messageId: string) {
  const message = await db.query.messagesTable.findFirst({ where: { active: true, branchId, id: messageId, projectId } })

  if (!message) throw notFound()
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
