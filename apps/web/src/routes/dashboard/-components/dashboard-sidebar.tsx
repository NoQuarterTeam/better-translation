import { Link } from "@tanstack/react-router"

import { Sidebar, SidebarContent, SidebarGroup, SidebarHeader, useSidebar } from "@/components/ui/sidebar"

type DashboardSidebarProps = {
  locale?: string
}

export function DashboardSidebar({ locale }: DashboardSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar()

  const handleNavigationLinkClick = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="flex h-16 min-w-0 justify-center overflow-hidden px-4 pt-2 group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:px-2">
        <Link
          to="/dashboard"
          search={{ locale }}
          onClick={handleNavigationLinkClick}
          className="block max-w-full min-w-0 ring-sidebar-ring outline-none focus-visible:ring-2"
        >
          BT
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup></SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
