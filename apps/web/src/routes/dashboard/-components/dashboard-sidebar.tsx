import { Link } from "@tanstack/react-router"
import { LayoutIcon, UsersIcon } from "lucide-react"

import { T } from "better-translation/react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function DashboardSidebar() {
  const { isMobile, setOpenMobile } = useSidebar()

  const handleNavigationLinkClick = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="flex h-16 min-w-0 justify-center overflow-hidden px-4 pt-2 group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:px-2">
        <Link
          to="/dashboard"
          onClick={handleNavigationLinkClick}
          className="block max-w-full min-w-0 ring-sidebar-ring outline-none focus-visible:ring-2"
        >
          BT
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={
                  <Link
                    to="/dashboard"
                    onClick={handleNavigationLinkClick}
                    className="opacity-50 data-[status=active]:bg-muted data-[status=active]:opacity-100"
                    activeOptions={{ exact: true, includeSearch: false }}
                  />
                }
              >
                <LayoutIcon />
                <span>
                  <T>Dashboard</T>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={
                  <Link
                    to="/dashboard/users"
                    onClick={handleNavigationLinkClick}
                    className="opacity-50 data-[status=active]:bg-muted data-[status=active]:opacity-100"
                  />
                }
              >
                <UsersIcon />
                <span>
                  <T>Users</T>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
