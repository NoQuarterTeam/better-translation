import { createServerFn } from "@tanstack/react-start"

import { organizationMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { projectInsertSchema, projectsTable } from "@/server/db/schema"

export const createProjectFn = createServerFn({ method: "POST" })
  .middleware([organizationMiddleware])
  .inputValidator(
    parseZod(
      projectInsertSchema
        .pick({
          name: true,
          slug: true,
          translationPrompt: true,
        })
        .extend({
          translationPrompt: projectInsertSchema.shape.translationPrompt
            .optional()
            .default("Translate the provided UI messages as concise, natural application UI copy."),
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
        name: data.name,
        organizationId: context.organization.id,
        slug: data.slug,
        translationPrompt: data.translationPrompt,
      })
      .returning()

    if (!project) throw new Error("Could not create Project.")
    return project
  })
