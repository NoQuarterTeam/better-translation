import { createServerFn } from "@tanstack/react-start"
import { and, count, desc, eq } from "drizzle-orm"
import * as z from "zod"

import { authMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { branchesTable, messagesTable, projectInsertSchema, projectsTable } from "@/server/db/schema"
import { getCurrentOrganizationAccess } from "@/server/organizations"
import { createProjectPublicId, DEFAULT_TRANSLATION_BRANCH, DEFAULT_TRANSLATION_MODEL } from "@/server/platform"

const defaultTranslationPrompt = "Translate the provided UI messages as concise, natural application UI copy."

const orgInputSchema = z.object({ orgSlug: z.string().trim().min(1) })

const createProjectInputSchema = projectInsertSchema
  .pick({
    name: true,
    slug: true,
    defaultLocale: true,
    locales: true,
    translationModel: true,
    translationPrompt: true,
    autoTranslate: true,
  })
  .extend({
    orgSlug: orgInputSchema.shape.orgSlug,
    translationModel: projectInsertSchema.shape.translationModel.optional().default(DEFAULT_TRANSLATION_MODEL),
    translationPrompt: projectInsertSchema.shape.translationPrompt.optional().default(defaultTranslationPrompt),
    autoTranslate: projectInsertSchema.shape.autoTranslate.optional().default(true),
  })
  .transform((project) => {
    const defaultLocale = project.defaultLocale.toLowerCase()
    return {
      ...project,
      defaultLocale,
      locales: [...new Set([defaultLocale, ...project.locales.map((locale) => locale.toLowerCase())])],
    }
  })

export const listProjectsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(orgInputSchema))
  .handler(async ({ context, data }) => {
    const organizationAccess = await getCurrentOrganizationAccess({ slug: data.orgSlug, userId: context.user.id })
    if (!organizationAccess) throw new Error("Organization not found.")

    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.organizationId, organizationAccess.organization.id))
      .orderBy(desc(projectsTable.updatedAt))

    return Promise.all(
      projects.map(async (project) => {
        const [branchCount] = await db
          .select({ count: count() })
          .from(branchesTable)
          .where(eq(branchesTable.projectId, project.id))
        const [messageCount] = await db
          .select({ count: count() })
          .from(messagesTable)
          .where(and(eq(messagesTable.projectId, project.id), eq(messagesTable.active, true)))

        return {
          ...project,
          branchCount: Number(branchCount?.count ?? 0),
          messageCount: Number(messageCount?.count ?? 0),
        }
      }),
    )
  })

export const createProjectFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(createProjectInputSchema))
  .handler(async ({ context, data }) => {
    const organizationAccess = await getCurrentOrganizationAccess({ slug: data.orgSlug, userId: context.user.id })
    if (!organizationAccess) throw new Error("Organization not found.")

    const [existingProject] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(eq(projectsTable.organizationId, organizationAccess.organization.id), eq(projectsTable.slug, data.slug)))
      .limit(1)

    if (existingProject) throw new Error("A Project with that slug already exists.")

    const [project] = await db
      .insert(projectsTable)
      .values({
        autoTranslate: data.autoTranslate,
        defaultLocale: data.defaultLocale,
        locales: data.locales,
        name: data.name,
        organizationId: organizationAccess.organization.id,
        publicId: createProjectPublicId(),
        slug: data.slug,
        translationModel: data.translationModel,
        translationPrompt: data.translationPrompt,
      })
      .returning()

    if (!project) throw new Error("Could not create Project.")

    await db.insert(branchesTable).values({
      projectId: project.id,
      name: DEFAULT_TRANSLATION_BRANCH,
      isDefault: true,
    })

    return project
  })
