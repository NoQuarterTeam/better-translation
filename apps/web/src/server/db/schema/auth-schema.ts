import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { createSelectSchema } from "drizzle-orm/zod"
import * as z from "zod"

import { baseColumns } from "./shared"

export const usersTable = pgTable("users", {
  ...baseColumns,
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  isAdmin: boolean("is_admin").default(false).notNull(),
})

const customFields = {
  name: z.string().trim().min(1),
  email: z.email().trim().min(3).toLowerCase(),
}

export const userSchema = createSelectSchema(usersTable).extend(customFields)

export type User = typeof usersTable.$inferSelect

export const organizationsTable = pgTable(
  "organizations",
  {
    ...baseColumns,
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    metadata: text("metadata"),
  },
  (table) => [index("organization_slug_idx").on(table.slug)],
)

export type Organization = typeof organizationsTable.$inferSelect

export const membersTable = pgTable(
  "members",
  {
    ...baseColumns,
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
  },
  (table) => [index("member_organization_id_idx").on(table.organizationId), index("member_user_id_idx").on(table.userId)],
)

export type Member = typeof membersTable.$inferSelect

export const invitationsTable = pgTable(
  "invitations",
  {
    ...baseColumns,
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at").notNull(),
    inviterId: integer("inviter_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
  },
  (table) => [index("invitation_organization_id_idx").on(table.organizationId), index("invitation_email_idx").on(table.email)],
)

export type Invitation = typeof invitationsTable.$inferSelect

export const sessionsTable = pgTable(
  "sessions",
  {
    ...baseColumns,
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    activeOrganizationId: integer("active_organization_id").references(() => organizationsTable.id, {
      onDelete: "set null",
    }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
)

export const accountsTable = pgTable(
  "accounts",
  {
    ...baseColumns,
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
)

export const verificationsTable = pgTable(
  "verifications",
  {
    ...baseColumns,
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
)
