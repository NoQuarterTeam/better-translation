import { queryOptions } from "@tanstack/react-query"
import { redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie, setCookie } from "@tanstack/react-start/server"
import * as z from "zod"

import { organizationMiddleware, projectMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { selectedProjectCookieName } from "@/server/organizations"
import { withProjectIconUrl } from "@/server/profile-images"

export const getCurrentProjectSwitcherFn = createServerFn({ method: "GET" })
  .middleware([projectMiddleware])
  .handler(async ({ context }) => {
    const { project } = context
    const branchName = await getProjectBranchRedirect(project)

    return {
      branchName,
      ...(await withProjectIconUrl(project)),
      id: project.id,
      name: project.name,
      slug: project.slug,
    }
  })

export const getProjectBranchRedirectNameFn = createServerFn({ method: "GET" })
  .middleware([projectMiddleware])
  .handler(async ({ context }) => {
    return getProjectBranchRedirect(context.project)
  })

export const listProjectSwitcherProjectsFn = createServerFn({ method: "GET" })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const projects = await db.query.projectsTable.findMany({
      columns: {
        defaultBranchId: true,
        id: true,
        icon: true,
        name: true,
        publicId: true,
        slug: true,
      },
      orderBy: { name: "asc" },
      where: { organizationId: context.organization.id },
    })

    return Promise.all(
      projects.map(async (project) => ({
        branchName: await getProjectBranchRedirect(project),
        ...(await withProjectIconUrl(project)),
        id: project.id,
        name: project.name,
        slug: project.slug,
      })),
    )
  })

export const setSelectedProjectFn = createServerFn({ method: "POST" })
  .middleware([organizationMiddleware])
  .inputValidator(parseZod(z.object({ projectId: z.string().trim().min(1) })))
  .handler(async ({ context, data }) => {
    const project = await db.query.projectsTable.findFirst({
      columns: { id: true },
      where: { id: data.projectId, organizationId: context.organization.id },
    })

    if (!project) {
      throw redirect({ to: "/app/$orgSlug", params: { orgSlug: data.orgSlug } })
    }

    setCookie(selectedProjectCookieName, data.projectId, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
  })

export const currentProjectSwitcherQueryOptions = (orgSlug: string, projectSlug: string) =>
  queryOptions({
    queryKey: ["current-project-switcher", orgSlug, projectSlug],
    queryFn: () => getCurrentProjectSwitcherFn({ data: { orgSlug, projectSlug } }),
  })

export const projectSwitcherProjectsQueryOptions = (orgSlug: string) =>
  queryOptions({
    queryKey: ["project-switcher-projects", orgSlug],
    queryFn: () => listProjectSwitcherProjectsFn({ data: { orgSlug } }),
    staleTime: 30_000,
  })

export const projectBranchRedirectNameQueryOptions = (orgSlug: string, projectSlug: string) =>
  queryOptions({
    queryKey: ["project-branch-redirect-name", orgSlug, projectSlug],
    queryFn: () => getProjectBranchRedirectNameFn({ data: { orgSlug, projectSlug } }),
  })

async function getProjectBranchRedirect(project: { defaultBranchId: string | null; id: string; publicId: string }) {
  const selectedBranchName = getCookie(getSelectedBranchCookieName(project.publicId))

  if (selectedBranchName) {
    const selectedBranch = await db.query.branchesTable.findFirst({
      columns: { name: true },
      where: { archivedAt: { isNull: true }, projectId: project.id, name: selectedBranchName },
    })

    if (selectedBranch) return selectedBranch.name
  }

  if (!project.defaultBranchId) return null

  const defaultBranch = await db.query.branchesTable.findFirst({
    columns: { name: true },
    where: { archivedAt: { isNull: true }, id: project.defaultBranchId, projectId: project.id },
  })

  return defaultBranch?.name ?? null
}

function getSelectedBranchCookieName(projectPublicId: string) {
  return `bt_selected_branch_${projectPublicId}`
}
