import { createFileRoute, Outlet } from "@tanstack/react-router"

import { SidebarInset } from "@/components/ui/sidebar"

import { ProjectSidebar } from "./-components/project-sidebar"
import { projectBranchRedirectNameQueryOptions } from "./index/-data"

export const Route = createFileRoute("/app/$orgSlug/projects/$projectSlug")({
  beforeLoad: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(projectBranchRedirectNameQueryOptions(params.orgSlug, params.projectSlug))
  },
  component: ProjectLayout,
})

function ProjectLayout() {
  return (
    <>
      <ProjectSidebar />
      <SidebarInset className="flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto overscroll-contain">
          <Outlet />
        </div>
      </SidebarInset>
    </>
  )
}
