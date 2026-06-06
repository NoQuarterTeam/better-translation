import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import * as z from "zod"

import { organizationMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { branchesTable, projectInsertSchema, projectsTable } from "@/server/db/schema"
import {
  createGitHubInstallUrl,
  ensureGitHubInstallationRepository,
  listGitHubRepositoryBranches,
  searchGitHubInstallationRepositories,
} from "@/server/github"
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
        defaultBranchName: z.string().trim().min(1).max(100),
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

      const [branch] = await tx.insert(branchesTable).values({ name: data.defaultBranchName, projectId: project.id }).returning()
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

export const suggestProjectSlugFn = createServerFn({ method: "GET" })
  .middleware([organizationMiddleware])
  .inputValidator(parseZod(z.object({ baseSlug: projectInsertSchema.shape.slug })))
  .handler(async ({ context, data }) => {
    const projects = await db.query.projectsTable.findMany({
      columns: { slug: true },
      where: { organizationId: context.organization.id },
    })
    const existingSlugs = new Set(projects.map((project) => project.slug))

    if (!existingSlugs.has(data.baseSlug)) return data.baseSlug

    for (let index = 2; ; index++) {
      const suffix = `-${index}`
      const slug = `${data.baseSlug.slice(0, 64 - suffix.length).replace(/-+$/g, "")}${suffix}`
      if (!existingSlugs.has(slug)) return slug
    }
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
  .inputValidator(
    parseZod(
      z.object({
        installationId: z.string().trim().min(1),
        page: z.number().int().min(1).optional().default(1),
        search: z.string().trim().optional(),
      }),
    ),
  )
  .handler(async ({ context, data }) => {
    const canUseInstallation = await organizationCanUseGitHubInstallation({
      installationId: data.installationId,
      organizationId: context.organization.id,
    })

    if (!canUseInstallation) throw new Error("Connect this GitHub account before listing repositories.")

    return searchGitHubInstallationRepositories({
      installationId: data.installationId,
      page: data.page,
      perPage: 5,
      search: data.search,
    })
  })

export const listNewProjectGitHubBranchesFn = createServerFn({ method: "GET" })
  .middleware([organizationMiddleware])
  .inputValidator(
    parseZod(
      z.object({
        installationId: z.string().trim().min(1),
        repositoryId: z.string().trim().min(1),
        repositoryName: projectInsertSchema.shape.githubRepositoryName.unwrap(),
        repositoryOwner: projectInsertSchema.shape.githubRepositoryOwner.unwrap(),
      }),
    ),
  )
  .handler(async ({ context, data }) => {
    const canUseInstallation = await organizationCanUseGitHubInstallation({
      installationId: data.installationId,
      organizationId: context.organization.id,
    })

    if (!canUseInstallation) throw new Error("Connect this GitHub account before listing branches.")

    await ensureGitHubInstallationRepository({
      installationId: data.installationId,
      repositoryId: data.repositoryId,
      repositoryName: data.repositoryName,
      repositoryOwner: data.repositoryOwner,
    })

    return listGitHubRepositoryBranches({
      installationId: data.installationId,
      repositoryName: data.repositoryName,
      repositoryOwner: data.repositoryOwner,
    })
  })

export const newProjectGitHubSetupQueryOptions = (orgSlug: string) =>
  queryOptions({
    queryKey: ["new-project-github-setup", orgSlug],
    queryFn: () => getNewProjectGitHubSetupFn({ data: { orgSlug } }),
  })

export const newProjectGitHubRepositoriesQueryOptions = ({
  installationId,
  orgSlug,
  page,
  search,
}: {
  installationId: string
  orgSlug: string
  page: number
  search: string
}) =>
  queryOptions({
    enabled: Boolean(installationId),
    queryKey: ["new-project-github-repositories", orgSlug, installationId, search, page],
    queryFn: () => listNewProjectGitHubRepositoriesFn({ data: { orgSlug, installationId, page, search } }),
    staleTime: 5 * 60 * 1000,
  })

export const newProjectGitHubBranchesQueryOptions = ({
  installationId,
  orgSlug,
  repository,
}: {
  installationId: string
  orgSlug: string
  repository: { id: string; name: string; owner: string }
}) =>
  queryOptions({
    enabled: Boolean(installationId),
    queryKey: ["new-project-github-branches", orgSlug, installationId, repository.id],
    queryFn: () =>
      listNewProjectGitHubBranchesFn({
        data: {
          installationId,
          orgSlug,
          repositoryId: repository.id,
          repositoryName: repository.name,
          repositoryOwner: repository.owner,
        },
      }),
    staleTime: 5 * 60 * 1000,
  })

export const suggestedProjectSlugQueryOptions = (orgSlug: string, baseSlug: string) =>
  queryOptions({
    enabled: Boolean(baseSlug),
    queryKey: ["suggested-project-slug", orgSlug, baseSlug],
    queryFn: () => suggestProjectSlugFn({ data: { baseSlug, orgSlug } }),
  })
