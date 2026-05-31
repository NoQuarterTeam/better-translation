import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import * as z from "zod"

import { projectMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { projectInsertSchema, projectsTable } from "@/server/db/schema"

export const getProjectSettingsFn = createServerFn({ method: "GET" })
  .middleware([projectMiddleware])
  .handler(async ({ context }) => {
    const { project } = context
    return {
      defaultLocale: project.defaultLocale,
      locales: project.locales,
      name: project.name,
      publicId: project.publicId,
      slug: project.slug,
      translationModel: project.translationModel,
      translationPrompt: project.translationPrompt,
    }
  })

export const updateProjectNameFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(parseZod(z.object({ name: projectInsertSchema.shape.name })))
  .handler(async ({ context, data }) => {
    const { project } = context
    const [updatedProject] = await db
      .update(projectsTable)
      .set({ name: data.name, updatedAt: new Date() })
      .where(eq(projectsTable.id, project.id))
      .returning({
        defaultLocale: projectsTable.defaultLocale,
        locales: projectsTable.locales,
        name: projectsTable.name,
        publicId: projectsTable.publicId,
        slug: projectsTable.slug,
        translationModel: projectsTable.translationModel,
        translationPrompt: projectsTable.translationPrompt,
      })

    if (!updatedProject) throw new Error("Could not update Project.")
    return updatedProject
  })

export const updateProjectLocalesFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(
    parseZod(
      z.object({
        defaultLocale: projectInsertSchema.shape.defaultLocale,
        locales: projectInsertSchema.shape.locales,
      }),
    ),
  )
  .handler(async ({ context, data }) => {
    const { project } = context
    const defaultLocale = data.defaultLocale.toLowerCase()
    const locales = [...new Set([defaultLocale, ...data.locales.map((locale) => locale.toLowerCase())])]
    const [updatedProject] = await db
      .update(projectsTable)
      .set({ defaultLocale, locales, updatedAt: new Date() })
      .where(eq(projectsTable.id, project.id))
      .returning({
        defaultLocale: projectsTable.defaultLocale,
        locales: projectsTable.locales,
        name: projectsTable.name,
        publicId: projectsTable.publicId,
        slug: projectsTable.slug,
        translationModel: projectsTable.translationModel,
        translationPrompt: projectsTable.translationPrompt,
      })

    if (!updatedProject) throw new Error("Could not update Project.")
    return updatedProject
  })

export const updateProjectTranslatorFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(
    parseZod(
      z.object({
        translationModel: projectInsertSchema.shape.translationModel,
        translationPrompt: projectInsertSchema.shape.translationPrompt,
      }),
    ),
  )
  .handler(async ({ context, data }) => {
    const { project } = context
    const [updatedProject] = await db
      .update(projectsTable)
      .set({
        translationModel: data.translationModel,
        translationPrompt: data.translationPrompt,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, project.id))
      .returning({
        defaultLocale: projectsTable.defaultLocale,
        locales: projectsTable.locales,
        name: projectsTable.name,
        publicId: projectsTable.publicId,
        slug: projectsTable.slug,
        translationModel: projectsTable.translationModel,
        translationPrompt: projectsTable.translationPrompt,
      })

    if (!updatedProject) throw new Error("Could not update Project.")
    return updatedProject
  })

export const projectSettingsQueryOptions = (orgSlug: string, projectSlug: string) =>
  queryOptions({
    queryKey: ["project-settings", orgSlug, projectSlug],
    queryFn: () => getProjectSettingsFn({ data: { orgSlug, projectSlug } }),
  })
