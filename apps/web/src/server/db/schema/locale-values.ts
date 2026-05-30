import { index, integer, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core"
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod"
import * as z from "zod"

import { usersTable } from "./auth-schema"
import { branchesTable } from "./branches"
import { messagesTable } from "./messages"
import { projectsTable } from "./projects"
import { baseColumns } from "./shared"

export const localeValueSourceEnum = pgEnum("locale_value_source", ["imported", "ai", "manual"])

export const localeValuesTable = pgTable(
  "locale_values",
  {
    ...baseColumns,
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branchesTable.id, { onDelete: "cascade" }),
    messageId: integer("message_id")
      .notNull()
      .references(() => messagesTable.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    value: text("value").notNull(),
    source: localeValueSourceEnum("source").notNull(),
    valueHash: text("value_hash").notNull(),
    parentValueHash: text("parent_value_hash"),
    updatedById: integer("updated_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  },
  (table) => [
    index("locale_value_project_id_idx").on(table.projectId),
    index("locale_value_branch_id_idx").on(table.branchId),
    index("locale_value_message_id_idx").on(table.messageId),
    uniqueIndex("locale_value_branch_message_locale_idx").on(table.branchId, table.messageId, table.locale),
  ],
)

const customFields = {
  locale: z.string().trim().min(2).max(20),
  value: z.string().trim().min(1),
  valueHash: z.string().trim().min(1),
  parentValueHash: z.string().trim().min(1).nullable(),
}

export const localeValueSchema = createSelectSchema(localeValuesTable).extend(customFields)
export const localeValueInsertSchema = createInsertSchema(localeValuesTable).extend(customFields)

export type LocaleValue = typeof localeValuesTable.$inferSelect
