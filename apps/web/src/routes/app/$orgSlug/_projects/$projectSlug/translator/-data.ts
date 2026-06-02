import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import * as z from "zod"

import { projectMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { projectInsertSchema, projectsTable } from "@/server/db/schema"

export const getProjectTranslatorFn = createServerFn({ method: "GET" })
  .middleware([projectMiddleware])
  .handler(async ({ context }) => {
    return getProjectTranslator(context.project)
  })

export const updateProjectTranslatorFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(
    parseZod(
      z.object({
        translationPrompt: projectInsertSchema.shape.translationPrompt,
      }),
    ),
  )
  .handler(async ({ context, data }) => {
    const [updatedProject] = await db
      .update(projectsTable)
      .set({
        translationPrompt: data.translationPrompt,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, context.project.id))
      .returning()

    if (!updatedProject) throw new Error("Could not update Project.")
    return getProjectTranslator(updatedProject)
  })

export const projectTranslatorQueryOptions = (orgSlug: string, projectSlug: string) =>
  queryOptions({
    queryKey: ["project-translator", orgSlug, projectSlug],
    queryFn: () => getProjectTranslatorFn({ data: { orgSlug, projectSlug } }),
  })

function getProjectTranslator(project: typeof projectsTable.$inferSelect) {
  return {
    translationPrompt: project.translationPrompt,
  }
}
