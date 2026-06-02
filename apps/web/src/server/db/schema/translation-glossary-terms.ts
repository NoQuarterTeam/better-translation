import { boolean, index, pgEnum, pgTable, text } from "drizzle-orm/pg-core"
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod"
import * as z from "zod"

import { projectsTable } from "./projects"
import { baseColumns } from "./shared"

export const translationGlossaryTermActionEnum = pgEnum("translation_glossary_term_action", ["preserve", "translate_as", "avoid"])

export const translationGlossaryTermsTable = pgTable(
  "translation_glossary_terms",
  {
    ...baseColumns,
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    sourceTerm: text("source_term").notNull(),
    action: translationGlossaryTermActionEnum("action").notNull(),
    targetLocale: text("target_locale"),
    targetTerm: text("target_term"),
    note: text("note"),
    enabled: boolean("enabled").notNull().default(true),
  },
  (table) => [
    index("translation_glossary_term_project_id_idx").on(table.projectId),
    index("translation_glossary_term_project_enabled_idx").on(table.projectId, table.enabled),
  ],
)

const customFields = {
  sourceTerm: z.string().trim().min(1).max(160),
  targetLocale: z.string().trim().min(2).max(20).nullable(),
  targetTerm: z.string().trim().min(1).max(160).nullable(),
  note: z.string().trim().min(1).max(1000).nullable(),
  enabled: z.boolean(),
}

export const translationGlossaryTermSchema = createSelectSchema(translationGlossaryTermsTable).extend(customFields)
export const translationGlossaryTermInsertSchema = createInsertSchema(translationGlossaryTermsTable).extend(customFields)

export type TranslationGlossaryTerm = typeof translationGlossaryTermsTable.$inferSelect
