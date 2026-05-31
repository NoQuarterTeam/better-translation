import { createServerFn } from "@tanstack/react-start"

import { organizationMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { projectInsertSchema, projectsTable } from "@/server/db/schema"
import { DEFAULT_TRANSLATION_MODEL } from "@/server/platform"

export const createProjectFn = createServerFn({ method: "POST" })
  .middleware([organizationMiddleware])
  .inputValidator(
    parseZod(
      projectInsertSchema
        .pick({
          name: true,
          slug: true,
          defaultLocale: true,
          locales: true,
          translationModel: true,
          translationPrompt: true,
        })
        .extend({
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

    const [project] = await db
      .insert(projectsTable)
      .values({
        defaultLocale: data.defaultLocale,
        locales: data.locales,
        name: data.name,
        organizationId: context.organization.id,
        slug: data.slug,
        translationModel: data.translationModel,
        translationPrompt: data.translationPrompt,
      })
      .returning()

    if (!project) throw new Error("Could not create Project.")

    return project
  })
