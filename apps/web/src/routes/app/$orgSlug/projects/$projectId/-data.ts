import { createServerFn } from "@tanstack/react-start"
import { getCookie, setCookie } from "@tanstack/react-start/server"
import { and, count, desc, eq, isNull } from "drizzle-orm"
import * as z from "zod"

import { authMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import {
  apiKeyInsertSchema,
  apiKeysTable,
  branchesTable,
  localeValuesTable,
  messagesTable,
  projectInsertSchema,
  projectsTable,
} from "@/server/db/schema"
import { getCurrentOrganizationAccess } from "@/server/organizations"
import { createProjectApiKeyRecord, createProjectApiKeySecret, DEFAULT_TRANSLATION_BRANCH } from "@/server/platform"

const projectInputSchema = z.object({
  orgSlug: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
})

const createApiKeyInputSchema = apiKeyInsertSchema.pick({ name: true }).extend({
  orgSlug: projectInputSchema.shape.orgSlug,
  projectId: projectInputSchema.shape.projectId,
})

const revokeApiKeyInputSchema = z.object({
  orgSlug: projectInputSchema.shape.orgSlug,
  projectId: projectInputSchema.shape.projectId,
  apiKeyId: z.number().int().positive(),
})

const setSelectedBranchInputSchema = projectInputSchema.extend({
  branchName: z.string().trim().min(1),
})

const updateProjectNameInputSchema = projectInputSchema.extend({
  name: projectInsertSchema.shape.name,
})

const updateProjectLocalesInputSchema = projectInputSchema.extend({
  defaultLocale: projectInsertSchema.shape.defaultLocale,
  locales: projectInsertSchema.shape.locales,
})

const updateProjectTranslatorInputSchema = projectInputSchema.extend({
  autoTranslate: projectInsertSchema.shape.autoTranslate,
  translationModel: projectInsertSchema.shape.translationModel,
  translationPrompt: projectInsertSchema.shape.translationPrompt,
})

export const getProjectDetailFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(projectInputSchema))
  .handler(async ({ context, data }) => {
    const { project } = await getAuthorizedProject(data, context.user.id)

    const branches = await db
      .select()
      .from(branchesTable)
      .where(eq(branchesTable.projectId, project.id))
      .orderBy(desc(branchesTable.isDefault), desc(branchesTable.updatedAt))

    const apiKeys = await listProjectApiKeys(project.id)

    const [messageCount] = await db
      .select({ count: count() })
      .from(messagesTable)
      .where(and(eq(messagesTable.projectId, project.id), eq(messagesTable.active, true)))

    const branchRows = await Promise.all(
      branches.map(async (branch) => {
        const [valueCount] = await db
          .select({ count: count() })
          .from(localeValuesTable)
          .where(eq(localeValuesTable.branchId, branch.id))

        return {
          ...branch,
          parentBranchName: branches.find((candidate) => candidate.id === branch.parentBranchId)?.name ?? null,
          valueCount: Number(valueCount?.count ?? 0),
        }
      }),
    )

    return {
      project,
      branches: branchRows,
      apiKeys,
      messageCount: Number(messageCount?.count ?? 0),
      selectedBranchName: getSelectedBranchName(project.publicId, branchRows),
    }
  })

export const getProjectLandingBranchFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(projectInputSchema))
  .handler(async ({ context, data }) => {
    const { project } = await getAuthorizedProject(data, context.user.id)
    const branches = await db
      .select({ name: branchesTable.name, isDefault: branchesTable.isDefault })
      .from(branchesTable)
      .where(eq(branchesTable.projectId, project.id))

    return getSelectedBranchName(project.publicId, branches)
  })

export const setSelectedBranchFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(setSelectedBranchInputSchema))
  .handler(async ({ context, data }) => {
    const { project } = await getAuthorizedProject(data, context.user.id)
    const [branch] = await db
      .select({ name: branchesTable.name })
      .from(branchesTable)
      .where(and(eq(branchesTable.projectId, project.id), eq(branchesTable.name, data.branchName)))
      .limit(1)

    if (!branch) throw new Error("Branch not found.")

    setCookie(getSelectedBranchCookieName(project.publicId), branch.name, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })

    return branch
  })

export const createProjectApiKeyFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(createApiKeyInputSchema))
  .handler(async ({ context, data }) => {
    const { project } = await getAuthorizedProject(data, context.user.id)
    const secret = createProjectApiKeySecret()

    const [apiKey] = await db
      .insert(apiKeysTable)
      .values({
        projectId: project.id,
        name: data.name,
        createdById: context.user.id,
        ...createProjectApiKeyRecord(secret),
      })
      .returning({
        id: apiKeysTable.id,
        name: apiKeysTable.name,
        keyPrefix: apiKeysTable.keyPrefix,
        keyLastFour: apiKeysTable.keyLastFour,
        createdAt: apiKeysTable.createdAt,
        lastUsedAt: apiKeysTable.lastUsedAt,
        revokedAt: apiKeysTable.revokedAt,
      })

    if (!apiKey) throw new Error("Could not create API key.")

    return { apiKey, secret }
  })

export const revokeProjectApiKeyFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(revokeApiKeyInputSchema))
  .handler(async ({ context, data }) => {
    const { project } = await getAuthorizedProject(data, context.user.id)
    const [apiKey] = await db
      .update(apiKeysTable)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeysTable.id, data.apiKeyId), eq(apiKeysTable.projectId, project.id), isNull(apiKeysTable.revokedAt)))
      .returning({ id: apiKeysTable.id })

    if (!apiKey) throw new Error("Could not revoke API key.")
    return apiKey
  })

export const updateProjectNameFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(updateProjectNameInputSchema))
  .handler(async ({ context, data }) => {
    const { project } = await getAuthorizedProject(data, context.user.id)
    const [updatedProject] = await db
      .update(projectsTable)
      .set({ name: data.name, updatedAt: new Date() })
      .where(eq(projectsTable.id, project.id))
      .returning()

    if (!updatedProject) throw new Error("Could not update Project.")
    return updatedProject
  })

export const updateProjectLocalesFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(updateProjectLocalesInputSchema))
  .handler(async ({ context, data }) => {
    const { project } = await getAuthorizedProject(data, context.user.id)
    const defaultLocale = data.defaultLocale.toLowerCase()
    const locales = [...new Set([defaultLocale, ...data.locales.map((locale) => locale.toLowerCase())])]
    const [updatedProject] = await db
      .update(projectsTable)
      .set({ defaultLocale, locales, updatedAt: new Date() })
      .where(eq(projectsTable.id, project.id))
      .returning()

    if (!updatedProject) throw new Error("Could not update Project.")
    return updatedProject
  })

export const updateProjectTranslatorFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(updateProjectTranslatorInputSchema))
  .handler(async ({ context, data }) => {
    const { project } = await getAuthorizedProject(data, context.user.id)
    const [updatedProject] = await db
      .update(projectsTable)
      .set({
        autoTranslate: data.autoTranslate,
        translationModel: data.translationModel,
        translationPrompt: data.translationPrompt,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, project.id))
      .returning()

    if (!updatedProject) throw new Error("Could not update Project.")
    return updatedProject
  })

async function listProjectApiKeys(projectId: number) {
  return db
    .select({
      id: apiKeysTable.id,
      name: apiKeysTable.name,
      keyPrefix: apiKeysTable.keyPrefix,
      keyLastFour: apiKeysTable.keyLastFour,
      createdAt: apiKeysTable.createdAt,
      lastUsedAt: apiKeysTable.lastUsedAt,
      revokedAt: apiKeysTable.revokedAt,
    })
    .from(apiKeysTable)
    .where(eq(apiKeysTable.projectId, projectId))
    .orderBy(desc(apiKeysTable.createdAt))
}

async function getAuthorizedProject(params: { orgSlug: string; projectId: string }, userId: number) {
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
  return { organization: organizationAccess.organization, project }
}

export const projectDetailQueryOptions = (orgSlug: string, projectId: string) => ({
  queryKey: ["project-detail", orgSlug, projectId],
  queryFn: () => getProjectDetailFn({ data: { orgSlug, projectId } }),
})

function getSelectedBranchCookieName(projectPublicId: string) {
  return `bt_selected_branch_${projectPublicId}`
}

function getSelectedBranchName(projectPublicId: string, branches: { isDefault: boolean; name: string }[]) {
  const selectedBranchName = getCookie(getSelectedBranchCookieName(projectPublicId))
  const selectedBranch = branches.find((branch) => branch.name === selectedBranchName)
  if (selectedBranch) return selectedBranch.name

  return branches.find((branch) => branch.isDefault)?.name ?? DEFAULT_TRANSLATION_BRANCH
}
