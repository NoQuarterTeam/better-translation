import { index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core"

import { organizationsTable, usersTable } from "./auth-schema"
import { baseColumns } from "./shared"

export const githubInstallationsTable = pgTable(
  "github_installations",
  {
    ...baseColumns,
    installationId: text("installation_id").notNull(),
    accountLogin: text("account_login").notNull(),
    accountType: text("account_type").notNull(),
    accountAvatarUrl: text("account_avatar_url"),
    repositorySelection: text("repository_selection").notNull(),
    connectedByUserId: text("connected_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  },
  (table) => [
    index("github_installation_account_idx").on(table.accountLogin),
    uniqueIndex("github_installation_installation_id_idx").on(table.installationId),
  ],
)

export const organizationGithubInstallationsTable = pgTable(
  "organization_github_installations",
  {
    ...baseColumns,
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    githubInstallationId: text("github_installation_id")
      .notNull()
      .references(() => githubInstallationsTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("organization_github_installation_organization_id_idx").on(table.organizationId),
    uniqueIndex("organization_github_installation_unique_idx").on(table.organizationId, table.githubInstallationId),
  ],
)

export type GitHubInstallation = typeof githubInstallationsTable.$inferSelect
