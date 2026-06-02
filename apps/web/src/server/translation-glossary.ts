import { db } from "@/server/db"

export async function listEnabledTranslationGlossaryTerms(projectId: string, locale: string) {
  const terms = await db.query.translationGlossaryTermsTable.findMany({
    orderBy: { sourceTerm: "asc" },
    where: { enabled: true, projectId },
  })

  return terms.filter((term) => !term.targetLocale || term.targetLocale === locale)
}
