import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import * as z from "zod"

import { projectMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { projectsTable, translationGlossaryTermsTable } from "@/server/db/schema"

import { glossaryTermFields, glossaryTermInputSchema, validateGlossaryTargetTerm } from "./-schema"

const glossaryTermIdSchema = z.object({
  termId: z.string().trim().min(1),
})

const glossaryTermUpdateInputSchema = glossaryTermIdSchema
  .extend(glossaryTermFields.shape)
  .superRefine(validateGlossaryTargetTerm)

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
        translationPrompt: z.string().trim().min(1).max(4000),
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

export const createTranslationGlossaryTermFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(parseZod(glossaryTermInputSchema))
  .handler(async ({ context, data }) => {
    const [term] = await db
      .insert(translationGlossaryTermsTable)
      .values({
        action: data.action,
        enabled: data.enabled,
        note: data.note,
        projectId: context.project.id,
        sourceTerm: data.sourceTerm,
        targetLocale: data.targetLocale,
        targetTerm: data.targetTerm,
      })
      .returning()

    if (!term) throw new Error("Could not create glossary term.")
    return term
  })

export const updateTranslationGlossaryTermFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(parseZod(glossaryTermUpdateInputSchema))
  .handler(async ({ context, data }) => {
    const [term] = await db
      .update(translationGlossaryTermsTable)
      .set({
        action: data.action,
        enabled: data.enabled,
        note: data.note,
        sourceTerm: data.sourceTerm,
        targetLocale: data.targetLocale,
        targetTerm: data.targetTerm,
        updatedAt: new Date(),
      })
      .where(
        and(eq(translationGlossaryTermsTable.id, data.termId), eq(translationGlossaryTermsTable.projectId, context.project.id)),
      )
      .returning()

    if (!term) throw new Error("Could not update glossary term.")
    return term
  })

export const setTranslationGlossaryTermEnabledFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(parseZod(glossaryTermIdSchema.extend({ enabled: z.boolean() })))
  .handler(async ({ context, data }) => {
    const [term] = await db
      .update(translationGlossaryTermsTable)
      .set({ enabled: data.enabled, updatedAt: new Date() })
      .where(
        and(eq(translationGlossaryTermsTable.id, data.termId), eq(translationGlossaryTermsTable.projectId, context.project.id)),
      )
      .returning()

    if (!term) throw new Error("Could not update glossary term.")
    return term
  })

export const deleteTranslationGlossaryTermFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(parseZod(glossaryTermIdSchema))
  .handler(async ({ context, data }) => {
    const [term] = await db
      .delete(translationGlossaryTermsTable)
      .where(
        and(eq(translationGlossaryTermsTable.id, data.termId), eq(translationGlossaryTermsTable.projectId, context.project.id)),
      )
      .returning({ id: translationGlossaryTermsTable.id })

    if (!term) throw new Error("Could not remove glossary term.")
    return term
  })

export const projectTranslatorQueryOptions = (orgSlug: string, projectSlug: string) =>
  queryOptions({
    queryKey: ["project-translator", orgSlug, projectSlug],
    queryFn: () => getProjectTranslatorFn({ data: { orgSlug, projectSlug } }),
  })

async function getProjectTranslator(project: typeof projectsTable.$inferSelect) {
  const branches = await db.query.branchesTable.findMany({
    columns: { defaultLocale: true, locales: true },
    where: { archivedAt: { isNull: true }, projectId: project.id },
  })

  return {
    translationLocales: [
      ...new Set(branches.flatMap((branch) => branch.locales.filter((locale) => locale !== branch.defaultLocale))),
    ].sort(),
    translationPrompt: project.translationPrompt,
    translationGlossaryTerms: await db.query.translationGlossaryTermsTable.findMany({
      orderBy: { sourceTerm: "asc" },
      where: { projectId: project.id },
    }),
  }
}
