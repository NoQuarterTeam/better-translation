import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core"
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod"
import * as z from "zod"

import { projectsTable } from "./projects"
import { baseColumns } from "./shared"

export type MessageMeta = {
  context?: string
  id?: string
} & Record<string, unknown>

export type MessageSourceSnapshot = {
  column?: number
  endColumn?: number
  endLine?: number
  file: string
  kind?: string
  line?: number
  marker?: string
}

export const messagesTable = pgTable(
  "messages",
  {
    ...baseColumns,
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    defaultMessage: text("default_message").notNull(),
    defaultMessageHash: text("default_message_hash").notNull(),
    meta: jsonb("meta").$type<MessageMeta>().notNull().default({}),
    placeholders: jsonb("placeholders").$type<string[]>().notNull().default([]),
    sources: jsonb("sources").$type<MessageSourceSnapshot[]>().notNull().default([]),
    active: boolean("active").notNull().default(true),
  },
  (table) => [
    index("message_project_id_idx").on(table.projectId),
    uniqueIndex("message_project_message_id_idx").on(table.projectId, table.messageId),
  ],
)

const messageMetaSchema = z.record(z.string(), z.unknown()).and(
  z.object({
    context: z.string().optional(),
    id: z.string().optional(),
  }),
)

const messageSourceSnapshotSchema = z.object({
  column: z.number().int().optional(),
  endColumn: z.number().int().optional(),
  endLine: z.number().int().optional(),
  file: z.string().trim().min(1),
  kind: z.string().optional(),
  line: z.number().int().optional(),
  marker: z.string().optional(),
})

const customFields = {
  messageId: z.string().trim().min(1).max(240),
  defaultMessage: z.string().min(1),
  defaultMessageHash: z.string().trim().min(1),
  meta: messageMetaSchema,
  placeholders: z.array(z.string().trim().min(1)).max(100),
  sources: z.array(messageSourceSnapshotSchema).max(100),
}

export const messageSchema = createSelectSchema(messagesTable).extend(customFields)
export const messageInsertSchema = createInsertSchema(messagesTable).extend(customFields)

export type Message = typeof messagesTable.$inferSelect
