import { boolean, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core"
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod"
import * as z from "zod"

import { organizationsTable } from "./auth-schema"
import { baseColumns } from "./shared"

export const projectsTable = pgTable(
  "projects",
  {
    ...baseColumns,
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    publicId: text("public_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    defaultLocale: text("default_locale").notNull().default("en"),
    locales: text("locales").array().notNull().default(["en"]),
    translationModel: text("translation_model").notNull().default("openai/gpt-5.5"),
    translationPrompt: text("translation_prompt")
      .notNull()
      .default("Translate the provided UI messages as concise, natural application UI copy."),
    autoTranslate: boolean("auto_translate").notNull().default(true),
  },
  (table) => [
    index("project_organization_id_idx").on(table.organizationId),
    uniqueIndex("project_public_id_idx").on(table.publicId),
    uniqueIndex("project_organization_slug_idx").on(table.organizationId, table.slug),
  ],
)

const customFields = {
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  defaultLocale: z.string().trim().min(2).max(20),
  locales: z.array(z.string().trim().min(2).max(20)).min(1).max(20),
  translationModel: z.string().trim().min(1).max(120),
  translationPrompt: z.string().trim().min(1).max(4000),
}

export const projectSchema = createSelectSchema(projectsTable).extend(customFields)
export const projectInsertSchema = createInsertSchema(projectsTable).extend(customFields)

export type Project = typeof projectsTable.$inferSelect
