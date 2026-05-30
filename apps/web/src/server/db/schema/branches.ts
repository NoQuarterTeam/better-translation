import type { AnyPgColumn } from "drizzle-orm/pg-core"
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod"
import * as z from "zod"

import { projectsTable } from "./projects"
import { baseColumns } from "./shared"

export const branchesTable = pgTable(
  "branches",
  {
    ...baseColumns,
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    parentBranchId: integer("parent_branch_id").references((): AnyPgColumn => branchesTable.id, {
      onDelete: "set null",
    }),
    isDefault: boolean("is_default").notNull().default(false),
    lastSyncedAt: timestamp("last_synced_at"),
  },
  (table) => [
    index("branch_project_id_idx").on(table.projectId),
    index("branch_parent_branch_id_idx").on(table.parentBranchId),
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
}

export const branchSchema = createSelectSchema(branchesTable).extend(customFields)
export const branchInsertSchema = createInsertSchema(branchesTable).extend(customFields)

export type Branch = typeof branchesTable.$inferSelect
