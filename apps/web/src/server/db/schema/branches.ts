import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod"
import * as z from "zod"

import { projectsTable } from "./projects"
import { baseColumns } from "./shared"

export const branchesTable = pgTable(
  "branches",
  {
    ...baseColumns,
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    defaultLocale: text("default_locale").notNull().default("en"),
    locales: text("locales").array().notNull().default(["en"]),
    archivedAt: timestamp("archived_at"),
    lastSyncedAt: timestamp("last_synced_at"),
  },
  (table) => [
    index("branch_project_id_idx").on(table.projectId),
    uniqueIndex("branch_project_name_idx").on(table.projectId, table.name),
  ],
)

const customFields = {
  name: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9._/-]+$/),
  defaultLocale: z.string().trim().min(2).max(20),
  locales: z.array(z.string().trim().min(2).max(20)).min(1).max(20),
}

export const branchSchema = createSelectSchema(branchesTable).extend(customFields)
export const branchInsertSchema = createInsertSchema(branchesTable).extend(customFields)

export type Branch = typeof branchesTable.$inferSelect
