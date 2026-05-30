import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Outlet, useParams } from "@tanstack/react-router"

import { SidebarInset } from "@/components/ui/sidebar"

import { ProjectSidebar } from "../../-components/project-sidebar"
import { projectDetailQueryOptions } from "./-data"

export const Route = createFileRoute("/app/$orgSlug/projects/$projectId")({
  component: ProjectLayout,
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(projectDetailQueryOptions(params.orgSlug, params.projectId))
  },
})

function ProjectLayout() {
  const { orgSlug, projectId } = Route.useParams()
  const params = useParams({ strict: false })
  const projectQuery = useQuery(projectDetailQueryOptions(orgSlug, projectId))
  const defaultBranchName = projectQuery.data?.branches.find((branch) => branch.isDefault)?.name ?? "main"
  const currentBranchName =
    typeof params.branchName === "string" ? params.branchName : (projectQuery.data?.selectedBranchName ?? defaultBranchName)

  return (
    <>
      {projectQuery.data ? (
        <ProjectSidebar branches={projectQuery.data.branches} currentBranchName={currentBranchName} />
      ) : (
        <ProjectSidebar branches={[]} currentBranchName={currentBranchName} />
      )}
      <SidebarInset className="flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto overscroll-contain">
          <Outlet />
        </div>
      </SidebarInset>
    </>
  )
}
