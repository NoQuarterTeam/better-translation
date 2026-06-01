import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import * as z from "zod"

import { projectMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { branchesTable, projectInsertSchema, projectsTable } from "@/server/db/schema"
import {
  createGitHubInstallUrl,
  ensureGitHubInstallationRepository,
  listGitHubInstallationRepositories,
  verifyGitHubSetupState,
} from "@/server/github"
import {
  getOrganizationGitHubInstallation,
  listOrganizationGitHubInstallations,
  organizationCanUseGitHubInstallation,
} from "@/server/github-installations"

const githubSetupSchema = z.object({
  installationId: z.string().trim().min(1),
  setupState: z.string().trim().min(1).optional(),
})

export const getProjectSettingsFn = createServerFn({ method: "GET" })
  .middleware([projectMiddleware])
  .handler(async ({ context }) => {
    return getProjectSettings(context.project, context.organization)
  })

export const updateProjectNameFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(parseZod(z.object({ name: projectInsertSchema.shape.name })))
  .handler(async ({ context, data }) => {
    const [updatedProject] = await db
      .update(projectsTable)
      .set({ name: data.name, updatedAt: new Date() })
      .where(eq(projectsTable.id, context.project.id))
      .returning()

    if (!updatedProject) throw new Error("Could not update Project.")
    return getProjectSettings(updatedProject, context.organization)
  })

export const updateProjectTranslatorFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(
    parseZod(
      z.object({
        translationPrompt: projectInsertSchema.shape.translationPrompt,
      }),
    ),
  )
  .handler(async ({ context, data }) => {
    const [updatedProject] = await db
      .update(projectsTable)
      .set({
        translationPrompt: data.translationPrompt,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, context.project.id))
      .returning()

    if (!updatedProject) throw new Error("Could not update Project.")
    return getProjectSettings(updatedProject, context.organization)
  })

export const listGitHubInstallationRepositoriesFn = createServerFn({ method: "GET" })
  .middleware([projectMiddleware])
  .inputValidator(parseZod(githubSetupSchema))
  .handler(async ({ context, data }) => {
    const githubInstallation = await getOrganizationGitHubInstallation({
      installationId: data.installationId,
      organizationId: context.organization.id,
    })

    if (!githubInstallation && !(await canUseGitHubInstallation(context.project, context.organization, data))) {
      throw new Error("GitHub setup session expired. Start the connection again.")
    }

    return listGitHubInstallationRepositories(data.installationId)
  })

export const connectProjectGitHubRepositoryFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(
    parseZod(
      githubSetupSchema.extend({
        githubBranchCleanupEnabled: z.boolean().optional().default(true),
        repositoryId: z.string().trim().min(1),
        repositoryName: z.string().trim().min(1),
        repositoryOwner: z.string().trim().min(1),
      }),
    ),
  )
  .handler(async ({ context, data }) => {
    const githubInstallation = await getOrganizationGitHubInstallation({
      installationId: data.installationId,
      organizationId: context.organization.id,
    })

    if (!githubInstallation && !(await canUseGitHubInstallation(context.project, context.organization, data))) {
      throw new Error("GitHub setup session expired. Start the connection again.")
    }

    const repository = await ensureGitHubInstallationRepository({
      installationId: data.installationId,
      repositoryId: data.repositoryId,
      repositoryName: data.repositoryName,
      repositoryOwner: data.repositoryOwner,
    })

    const updatedProject = await db.transaction(async (tx) => {
      let defaultBranchId = context.project.defaultBranchId

      if (!defaultBranchId) {
        const [branch] = await tx
          .insert(branchesTable)
          .values({ name: repository.defaultBranch, projectId: context.project.id })
          .onConflictDoUpdate({
            set: { archivedAt: null, updatedAt: new Date() },
            target: [branchesTable.projectId, branchesTable.name],
          })
          .returning()

        if (!branch) throw new Error("Could not create Production Branch.")
        defaultBranchId = branch.id
      }

      const [project] = await tx
        .update(projectsTable)
        .set({
          defaultBranchId,
          githubBranchCleanupEnabled: data.githubBranchCleanupEnabled,
          githubInstallationRecordId: githubInstallation?.id ?? context.project.githubInstallationRecordId,
          githubRepositoryId: repository.id,
          githubRepositoryName: repository.name,
          githubRepositoryOwner: repository.owner,
          updatedAt: new Date(),
        })
        .where(eq(projectsTable.id, context.project.id))
        .returning()

      if (!project) throw new Error("Could not connect GitHub repository.")
      return project
    })

    return getProjectSettings(updatedProject, context.organization)
  })

export const updateProjectGitHubCleanupFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(parseZod(z.object({ githubBranchCleanupEnabled: z.boolean() })))
  .handler(async ({ context, data }) => {
    if (data.githubBranchCleanupEnabled && !context.project.githubRepositoryId) {
      throw new Error("Connect a GitHub repository before enabling Branch cleanup.")
    }

    const [updatedProject] = await db
      .update(projectsTable)
      .set({ githubBranchCleanupEnabled: data.githubBranchCleanupEnabled, updatedAt: new Date() })
      .where(eq(projectsTable.id, context.project.id))
      .returning()

    if (!updatedProject) throw new Error("Could not update GitHub settings.")
    return getProjectSettings(updatedProject, context.organization)
  })

export const disconnectProjectGitHubFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .handler(async ({ context }) => {
    const [updatedProject] = await db
      .update(projectsTable)
      .set({
        githubBranchCleanupEnabled: false,
        githubInstallationRecordId: null,
        githubRepositoryId: null,
        githubRepositoryName: null,
        githubRepositoryOwner: null,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, context.project.id))
      .returning()

    if (!updatedProject) throw new Error("Could not disconnect GitHub repository.")
    return getProjectSettings(updatedProject, context.organization)
  })

export const projectSettingsQueryOptions = (orgSlug: string, projectSlug: string) =>
  queryOptions({
    queryKey: ["project-settings", orgSlug, projectSlug],
    queryFn: () => getProjectSettingsFn({ data: { orgSlug, projectSlug } }),
  })

export const githubInstallationRepositoriesQueryOptions = ({
  installationId,
  orgSlug,
  projectSlug,
  setupState,
}: {
  installationId: string
  orgSlug: string
  projectSlug: string
  setupState?: string
}) =>
  queryOptions({
    enabled: Boolean(installationId),
    queryKey: ["github-installation-repositories", orgSlug, projectSlug, installationId, setupState],
    queryFn: () =>
      listGitHubInstallationRepositoriesFn({
        data: { installationId, orgSlug, projectSlug, setupState },
      }),
    staleTime: 5 * 60 * 1000,
  })

async function canUseGitHubInstallation(
  project: typeof projectsTable.$inferSelect,
  organization: { id: string; slug: string },
  data: { installationId: string; setupState?: string },
) {
  if (await organizationCanUseGitHubInstallation({ installationId: data.installationId, organizationId: organization.id }))
    return true
  if (!data.setupState) return false
  return verifyGitHubSetupState(data.setupState, { orgSlug: organization.slug, projectSlug: project.slug })
}

async function getProjectSettings(project: typeof projectsTable.$inferSelect, organization: { id: string; slug: string }) {
  const githubInstallation = project.githubInstallationRecordId
    ? await db.query.githubInstallationsTable.findFirst({
        columns: { installationId: true },
        where: { id: project.githubInstallationRecordId },
      })
    : null

  return {
    name: project.name,
    publicId: project.publicId,
    slug: project.slug,
    githubBranchCleanupEnabled: project.githubBranchCleanupEnabled,
    githubInstallUrl: createGitHubInstallUrl({
      expiresAt: Date.now() + 15 * 60 * 1000,
      orgSlug: organization.slug,
      projectSlug: project.slug,
    }),
    githubInstallationId: githubInstallation?.installationId ?? null,
    githubInstallations: await listOrganizationGitHubInstallations(organization.id),
    githubRepositoryId: project.githubRepositoryId,
    githubRepositoryName: project.githubRepositoryName,
    githubRepositoryOwner: project.githubRepositoryOwner,
    hasProductionBranch: Boolean(project.defaultBranchId),
    translationPrompt: project.translationPrompt,
  }
}
