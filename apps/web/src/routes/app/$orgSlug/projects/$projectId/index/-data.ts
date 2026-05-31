import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"

import { projectMiddleware } from "@/lib/functions/middleware"
import { db } from "@/server/db"

export const getProjectBranchRedirectNameFn = createServerFn({ method: "GET" })
  .middleware([projectMiddleware])
  .handler(async ({ context }) => {
    const { project } = context
    const selectedBranchName = getCookie(getSelectedBranchCookieName(project.publicId))

    if (selectedBranchName) {
      const selectedBranch = await db.query.branchesTable.findFirst({
        columns: { name: true },
        where: { projectId: project.id, name: selectedBranchName },
      })

      if (selectedBranch) return selectedBranch.name
    }

    if (!project.defaultBranchId) return null

    const defaultBranch = await db.query.branchesTable.findFirst({
      columns: { name: true },
      where: { id: project.defaultBranchId, projectId: project.id },
    })

    return defaultBranch?.name ?? null
  })

export const projectBranchRedirectNameQueryOptions = (orgSlug: string, projectId: string) =>
  queryOptions({
    queryKey: ["project-branch-redirect-name", orgSlug, projectId],
    queryFn: () => getProjectBranchRedirectNameFn({ data: { orgSlug, projectId } }),
  })

function getSelectedBranchCookieName(projectPublicId: string) {
  return `bt_selected_branch_${projectPublicId}`
}
