import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import * as z from "zod"

import { organizationMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { branchesTable, projectInsertSchema, projectsTable } from "@/server/db/schema"
import { createGitHubInstallUrl, ensureGitHubInstallationRepository, listGitHubInstallationRepositories } from "@/server/github"
import {
  getOrganizationGitHubInstallation,
  listOrganizationGitHubInstallations,
  organizationCanUseGitHubInstallation,
} from "@/server/github-installations"

const defaultTranslationPrompt = "Translate the provided UI messages as concise, natural application UI copy."

export const createProjectFn = createServerFn({ method: "POST" })
  .middleware([organizationMiddleware])
  .inputValidator(
    parseZod(
      projectInsertSchema
        .pick({
          name: true,
          slug: true,
          translationPrompt: true,
        })
        .extend({
          defaultBranchName: z.string().trim().min(1).max(100).optional(),
          translationPrompt: projectInsertSchema.shape.translationPrompt.optional().default(defaultTranslationPrompt),
        }),
    ),
  )
  .handler(async ({ context, data }) => {
    const existingProject = await db.query.projectsTable.findFirst({
      columns: { id: true },
      where: { organizationId: context.organization.id, slug: data.slug },
    })

    if (existingProject) throw new Error("A Project with that slug already exists.")

    const project = await db.transaction(async (tx) => {
      const [createdProject] = await tx
        .insert(projectsTable)
        .values({
          name: data.name,
          organizationId: context.organization.id,
          slug: data.slug,
          translationPrompt: data.translationPrompt,
        })
        .returning()

      if (!createdProject) throw new Error("Could not create Project.")
      if (!data.defaultBranchName) return createdProject

      const [branch] = await tx
        .insert(branchesTable)
        .values({ name: data.defaultBranchName, projectId: createdProject.id })
        .returning()
      if (!branch) throw new Error("Could not create Production Branch.")

      const [updatedProject] = await tx
        .update(projectsTable)
        .set({ defaultBranchId: branch.id, updatedAt: new Date() })
        .where(eq(projectsTable.id, createdProject.id))
        .returning()

      if (!updatedProject) throw new Error("Could not update Project.")
      return updatedProject
    })

    return project
  })

export const createProjectFromGitHubRepositoryFn = createServerFn({ method: "POST" })
  .middleware([organizationMiddleware])
  .inputValidator(
    parseZod(
      z.object({
        installationId: z.string().trim().min(1),
        name: projectInsertSchema.shape.name,
        repositoryId: z.string().trim().min(1),
        repositoryName: projectInsertSchema.shape.githubRepositoryName.unwrap(),
        repositoryOwner: projectInsertSchema.shape.githubRepositoryOwner.unwrap(),
        slug: projectInsertSchema.shape.slug,
      }),
    ),
  )
  .handler(async ({ context, data }) => {
    const existingProject = await db.query.projectsTable.findFirst({
      columns: { id: true },
      where: { organizationId: context.organization.id, slug: data.slug },
    })

    if (existingProject) throw new Error("A Project with that slug already exists.")

    const githubInstallation = await getOrganizationGitHubInstallation({
      installationId: data.installationId,
      organizationId: context.organization.id,
    })

    if (!githubInstallation) throw new Error("Connect this GitHub account before importing a repository.")

    const repository = await ensureGitHubInstallationRepository({
      installationId: data.installationId,
      repositoryId: data.repositoryId,
      repositoryName: data.repositoryName,
      repositoryOwner: data.repositoryOwner,
    })

    return db.transaction(async (tx) => {
      const [project] = await tx
        .insert(projectsTable)
        .values({
          githubBranchCleanupEnabled: false,
          githubInstallationRecordId: githubInstallation.id,
          githubRepositoryId: repository.id,
          githubRepositoryName: repository.name,
          githubRepositoryOwner: repository.owner,
          name: data.name,
          organizationId: context.organization.id,
          slug: data.slug,
          translationPrompt: defaultTranslationPrompt,
        })
        .returning()

      if (!project) throw new Error("Could not create Project.")

      const [branch] = await tx
        .insert(branchesTable)
        .values({ name: repository.defaultBranch, projectId: project.id })
        .returning()
      if (!branch) throw new Error("Could not create Production Branch.")

      const [updatedProject] = await tx
        .update(projectsTable)
        .set({ defaultBranchId: branch.id, updatedAt: new Date() })
        .where(eq(projectsTable.id, project.id))
        .returning()

      if (!updatedProject) throw new Error("Could not update Project.")
      return updatedProject
    })
  })

export const getNewProjectGitHubSetupFn = createServerFn({ method: "GET" })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => ({
    githubInstallUrl: createGitHubInstallUrl({
      expiresAt: Date.now() + 15 * 60 * 1000,
      orgSlug: context.organization.slug,
    }),
    githubInstallations: await listOrganizationGitHubInstallations(context.organization.id),
  }))

export const listNewProjectGitHubRepositoriesFn = createServerFn({ method: "GET" })
  .middleware([organizationMiddleware])
  .inputValidator(parseZod(z.object({ installationId: z.string().trim().min(1) })))
  .handler(async ({ context, data }) => {
    const canUseInstallation = await organizationCanUseGitHubInstallation({
      installationId: data.installationId,
      organizationId: context.organization.id,
    })

    if (!canUseInstallation) throw new Error("Connect this GitHub account before listing repositories.")

    return listGitHubInstallationRepositories(data.installationId)
  })

export const newProjectGitHubSetupQueryOptions = (orgSlug: string) =>
  queryOptions({
    queryKey: ["new-project-github-setup", orgSlug],
    queryFn: () => getNewProjectGitHubSetupFn({ data: { orgSlug } }),
  })

export const newProjectGitHubRepositoriesQueryOptions = (orgSlug: string, installationId: string) =>
  queryOptions({
    enabled: Boolean(installationId),
    queryKey: ["new-project-github-repositories", orgSlug, installationId],
    queryFn: () => listNewProjectGitHubRepositoriesFn({ data: { orgSlug, installationId } }),
  })
