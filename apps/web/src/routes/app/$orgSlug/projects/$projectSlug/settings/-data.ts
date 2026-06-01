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

const githubSetupSchema = z.object({
  installationId: z.string().trim().min(1),
  setupState: z.string().trim().min(1),
})

export const getProjectSettingsFn = createServerFn({ method: "GET" })
  .middleware([projectMiddleware])
  .handler(async ({ context }) => {
    return getProjectSettings(context.project, context.organization.slug)
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
    return getProjectSettings(updatedProject, context.organization.slug)
  })

export const updateProjectTranslatorFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(
    parseZod(
      z.object({
        translationModel: projectInsertSchema.shape.translationModel,
        translationPrompt: projectInsertSchema.shape.translationPrompt,
      }),
    ),
  )
  .handler(async ({ context, data }) => {
    const [updatedProject] = await db
      .update(projectsTable)
      .set({
        translationModel: data.translationModel,
        translationPrompt: data.translationPrompt,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, context.project.id))
      .returning()

    if (!updatedProject) throw new Error("Could not update Project.")
    return getProjectSettings(updatedProject, context.organization.slug)
  })

export const listGitHubInstallationRepositoriesFn = createServerFn({ method: "GET" })
  .middleware([projectMiddleware])
  .inputValidator(parseZod(githubSetupSchema))
  .handler(async ({ context, data }) => {
    if (!verifyGitHubSetupState(data.setupState, { orgSlug: context.organization.slug, projectSlug: context.project.slug })) {
      throw new Error("GitHub setup session expired. Start the connection again.")
    }

    return listGitHubInstallationRepositories(data.installationId)
  })

export const connectProjectGitHubRepositoryFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(
    parseZod(
      githubSetupSchema.extend({
        githubBranchCleanupEnabled: z.boolean(),
        repositoryId: z.string().trim().min(1),
        repositoryName: z.string().trim().min(1),
        repositoryOwner: z.string().trim().min(1),
      }),
    ),
  )
  .handler(async ({ context, data }) => {
    if (!verifyGitHubSetupState(data.setupState, { orgSlug: context.organization.slug, projectSlug: context.project.slug })) {
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
          githubInstallationId: data.installationId,
          githubRepositoryId: repository.id,
          githubRepositoryName: repository.name.toLowerCase(),
          githubRepositoryOwner: repository.owner.toLowerCase(),
          updatedAt: new Date(),
        })
        .where(eq(projectsTable.id, context.project.id))
        .returning()

      if (!project) throw new Error("Could not connect GitHub repository.")
      return project
    })

    return getProjectSettings(updatedProject, context.organization.slug)
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
    return getProjectSettings(updatedProject, context.organization.slug)
  })

export const disconnectProjectGitHubFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .handler(async ({ context }) => {
    const [updatedProject] = await db
      .update(projectsTable)
      .set({
        githubBranchCleanupEnabled: false,
        githubInstallationId: null,
        githubRepositoryId: null,
        githubRepositoryName: null,
        githubRepositoryOwner: null,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, context.project.id))
      .returning()

    if (!updatedProject) throw new Error("Could not disconnect GitHub repository.")
    return getProjectSettings(updatedProject, context.organization.slug)
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
  setupState: string
}) =>
  queryOptions({
    enabled: Boolean(installationId && setupState),
    queryKey: ["github-installation-repositories", orgSlug, projectSlug, installationId, setupState],
    queryFn: () =>
      listGitHubInstallationRepositoriesFn({
        data: { installationId, orgSlug, projectSlug, setupState },
      }),
  })

function getProjectSettings(project: typeof projectsTable.$inferSelect, orgSlug: string) {
  return {
    name: project.name,
    publicId: project.publicId,
    slug: project.slug,
    githubBranchCleanupEnabled: project.githubBranchCleanupEnabled,
    githubInstallUrl: createGitHubInstallUrl({
      expiresAt: Date.now() + 15 * 60 * 1000,
      orgSlug,
      projectSlug: project.slug,
    }),
    githubInstallationId: project.githubInstallationId,
    githubRepositoryId: project.githubRepositoryId,
    githubRepositoryName: project.githubRepositoryName,
    githubRepositoryOwner: project.githubRepositoryOwner,
    hasProductionBranch: Boolean(project.defaultBranchId),
    translationModel: project.translationModel,
    translationPrompt: project.translationPrompt,
  }
}
