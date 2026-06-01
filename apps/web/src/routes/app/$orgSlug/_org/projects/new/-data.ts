import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"

import { organizationMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { branchInsertSchema, branchesTable, projectInsertSchema, projectsTable } from "@/server/db/schema"
import { DEFAULT_TRANSLATION_MODEL } from "@/server/platform"

export const createProjectFn = createServerFn({ method: "POST" })
  .middleware([organizationMiddleware])
  .inputValidator(
    parseZod(
      projectInsertSchema
        .pick({
          name: true,
          slug: true,
          translationModel: true,
          translationPrompt: true,
        })
        .extend({
          defaultBranchName: branchInsertSchema.shape.name,
          defaultLocale: branchInsertSchema.shape.defaultLocale,
          locales: branchInsertSchema.shape.locales,
          translationModel: projectInsertSchema.shape.translationModel.optional().default(DEFAULT_TRANSLATION_MODEL),
          translationPrompt: projectInsertSchema.shape.translationPrompt
            .optional()
            .default("Translate the provided UI messages as concise, natural application UI copy."),
        })
        .transform((project) => {
          const defaultLocale = project.defaultLocale.toLowerCase()
          return {
            ...project,
            defaultLocale,
            locales: [...new Set([defaultLocale, ...project.locales.map((locale) => locale.toLowerCase())])],
          }
        }),
    ),
  )
  .handler(async ({ context, data }) => {
    const existingProject = await db.query.projectsTable.findFirst({
      columns: { id: true },
      where: { organizationId: context.organization.id, slug: data.slug },
    })

    if (existingProject) throw new Error("A Project with that slug already exists.")

    const project = await db.transaction(async (tx) => {
      const [createdProject] = await tx
        .insert(projectsTable)
        .values({
          name: data.name,
          organizationId: context.organization.id,
          slug: data.slug,
          translationModel: data.translationModel,
          translationPrompt: data.translationPrompt,
        })
        .returning()

      if (!createdProject) throw new Error("Could not create Project.")

      const [defaultBranch] = await tx
        .insert(branchesTable)
        .values({
          defaultLocale: data.defaultLocale,
          locales: data.locales,
          name: data.defaultBranchName,
          projectId: createdProject.id,
        })
        .returning()

      if (!defaultBranch) throw new Error("Could not create default Branch.")

      const [projectWithDefaultBranch] = await tx
        .update(projectsTable)
        .set({ defaultBranchId: defaultBranch.id })
        .where(eq(projectsTable.id, createdProject.id))
        .returning()

      if (!projectWithDefaultBranch) throw new Error("Could not set default Branch.")
      return projectWithDefaultBranch
    })

    return project
  })
