import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useParams } from "@tanstack/react-router"

import { AppShell } from "../../-components/app-shell"
import { BranchSwitcher } from "../../-components/branch-switcher"
import { ProjectSidebar } from "../../-components/project-sidebar"
import { ProjectSwitcher } from "../../-components/project-switcher"
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
  const currentBranchName = typeof params.branchName === "string" ? params.branchName : defaultBranchName
  const project = projectQuery.data?.project

  return (
    <AppShell
      branchSwitcher={
        projectQuery.data ? <BranchSwitcher branches={projectQuery.data.branches} currentBranchName={currentBranchName} /> : null
      }
      projectSwitcher={project ? <ProjectSwitcher project={project} /> : null}
      sidebar={<ProjectSidebar defaultBranchName={currentBranchName} />}
    />
  )
}
