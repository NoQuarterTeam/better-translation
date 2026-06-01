import { createId } from "@paralleldrive/cuid2"
import { boolean, index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core"
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod"
import * as z from "zod"

import { organizationsTable } from "./auth-schema"
import { githubInstallationsTable } from "./github-installations"
import { baseColumns } from "./shared"

export const projectsTable = pgTable(
  "projects",
  {
    ...baseColumns,
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    publicId: text("public_id")
      .unique()
      .notNull()
      .$defaultFn(() => `prj_${createId()}`),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    defaultBranchId: text("default_branch_id"),
    githubRepositoryOwner: text("github_repository_owner"),
    githubRepositoryName: text("github_repository_name"),
    githubRepositoryId: text("github_repository_id"),
    githubInstallationRecordId: text("github_installation_record_id").references(() => githubInstallationsTable.id, {
      onDelete: "set null",
    }),
    githubBranchCleanupEnabled: boolean("github_branch_cleanup_enabled").notNull().default(false),
    translationPrompt: text("translation_prompt")
      .notNull()
      .default("Translate the provided UI messages as concise, natural application UI copy."),
  },
  (table) => [
    index("project_organization_id_idx").on(table.organizationId),
    index("project_default_branch_id_idx").on(table.defaultBranchId),
    index("project_github_installation_record_idx").on(table.githubInstallationRecordId),
    index("project_github_repository_idx").on(table.githubRepositoryOwner, table.githubRepositoryName),
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
  translationPrompt: z.string().trim().min(1).max(4000),
  githubRepositoryOwner: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9.-]+$/)
    .nullable(),
  githubRepositoryName: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9._-]+$/)
    .nullable(),
  githubBranchCleanupEnabled: z.boolean(),
  githubRepositoryId: z.string().trim().min(1).nullable(),
  githubInstallationRecordId: z.string().trim().min(1).nullable(),
}

export const projectSchema = createSelectSchema(projectsTable).extend(customFields)
export const projectInsertSchema = createInsertSchema(projectsTable).extend(customFields)

export type Project = typeof projectsTable.$inferSelect
