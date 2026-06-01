import { createFileRoute, Outlet } from "@tanstack/react-router"

import { SidebarInset } from "@/components/ui/sidebar"

import { ProfileSidebar } from "./-components/profile-sidebar"

export const Route = createFileRoute("/app/profile")({
  component: ProfileLayout,
})

function ProfileLayout() {
  return (
    <>
      <ProfileSidebar />
      <SidebarInset className="flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto overscroll-contain">
          <Outlet />
        </div>
      </SidebarInset>
    </>
  )
}
