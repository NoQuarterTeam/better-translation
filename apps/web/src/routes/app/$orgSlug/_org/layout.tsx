import { createFileRoute, Outlet } from "@tanstack/react-router"

import { SidebarInset } from "@/components/ui/sidebar"

import { OrgSidebar } from "./-components/org-sidebar"

export const Route = createFileRoute("/app/$orgSlug/_org")({
  component: OrgLayout,
})

function OrgLayout() {
  return (
    <>
      <OrgSidebar />
      <SidebarInset className="flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto overscroll-contain">
          <Outlet />
        </div>
      </SidebarInset>
    </>
  )
}
