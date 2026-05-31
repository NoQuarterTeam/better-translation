import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod"
import * as z from "zod"

import { usersTable } from "./auth-schema"
import { projectsTable } from "./projects"
import { baseColumns } from "./shared"

export const apiKeysTable = pgTable(
  "api_keys",
  {
    ...baseColumns,
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    keyLastFour: text("key_last_four").notNull(),
    createdById: text("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [index("api_key_project_id_idx").on(table.projectId), uniqueIndex("api_key_hash_idx").on(table.keyHash)],
)

const customFields = {
  name: z.string().trim().min(1).max(120),
  keyPrefix: z.string().trim().min(1).max(40),
  keyHash: z.string().trim().min(1),
  keyLastFour: z.string().trim().min(4).max(8),
}

export const apiKeySchema = createSelectSchema(apiKeysTable).extend(customFields)
export const apiKeyInsertSchema = createInsertSchema(apiKeysTable).extend(customFields)

export type ApiKey = typeof apiKeysTable.$inferSelect
