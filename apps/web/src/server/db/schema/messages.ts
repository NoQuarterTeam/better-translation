import { boolean, index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core"
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod"
import * as z from "zod"

import { branchesTable } from "./branches"
import { projectsTable } from "./projects"
import { baseColumns } from "./shared"

export type MessageMeta = {
  context?: string
  id?: string
} & Record<string, unknown>

export type MessageSourceSnapshot = {
  file: string
  kind?: string
  marker?: string
}

export const messagesTable = pgTable(
  "messages",
  {
    ...baseColumns,
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    branchId: text("branch_id")
      .notNull()
      .references(() => branchesTable.id, { onDelete: "cascade" }),
    lookupId: text("lookup_id").notNull(),
    defaultMessage: text("default_message").notNull(),
    defaultMessageHash: text("default_message_hash").notNull(),
    meta: jsonb("meta").$type<MessageMeta>().notNull().default({}),
    placeholders: jsonb("placeholders").$type<string[]>().notNull().default([]),
    sources: jsonb("sources").$type<MessageSourceSnapshot[]>().notNull().default([]),
    active: boolean("active").notNull().default(true),
  },
  (table) => [
    index("message_project_id_idx").on(table.projectId),
    index("message_branch_id_idx").on(table.branchId),
    index("message_project_branch_active_idx").on(table.projectId, table.branchId, table.active),
    uniqueIndex("message_branch_lookup_id_idx").on(table.branchId, table.lookupId),
  ],
)

const messageMetaSchema = z.record(z.string(), z.unknown()).and(
  z.object({
    context: z.string().optional(),
    id: z.string().optional(),
  }),
)

const messageSourceSnapshotSchema = z
  .object({
    file: z.string().trim().min(1),
    kind: z.string().optional(),
    marker: z.string().optional(),
  })
  .strict()

const customFields = {
  lookupId: z.string().trim().min(1).max(240),
  defaultMessage: z.string().min(1),
  defaultMessageHash: z.string().trim().min(1),
  meta: messageMetaSchema,
  placeholders: z.array(z.string().trim().min(1)).max(100),
  sources: z.array(messageSourceSnapshotSchema).max(100),
}

export const messageSchema = createSelectSchema(messagesTable).extend(customFields)
export const messageInsertSchema = createInsertSchema(messagesTable).extend(customFields)

export type Message = typeof messagesTable.$inferSelect
