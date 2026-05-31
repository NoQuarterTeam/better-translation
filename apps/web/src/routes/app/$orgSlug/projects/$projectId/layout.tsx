import { createFileRoute, Outlet } from "@tanstack/react-router"

import { SidebarInset } from "@/components/ui/sidebar"

import { ProjectSidebar } from "./-components/project-sidebar"

export const Route = createFileRoute("/app/$orgSlug/projects/$projectId")({
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
