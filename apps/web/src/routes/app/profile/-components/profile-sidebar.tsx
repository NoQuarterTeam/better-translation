import { Link } from "@tanstack/react-router"
import { ShieldCheckIcon, UserIcon } from "lucide-react"

import { T } from "better-translation/react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function ProfileSidebar() {
  const { isMobile, setOpenMobile } = useSidebar()
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="top-14! h-[calc(100svh-3.5rem)]!">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <T>Account</T>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      to="/app/profile"
                      onClick={closeMobile}
                      className="opacity-50 data-[status=active]:bg-muted data-[status=active]:opacity-100"
                      activeOptions={{ exact: true, includeSearch: false }}
                    />
                  }
                >
                  <UserIcon />
                  <span>
                    <T>Profile</T>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      to="/app/profile/authentication"
                      onClick={closeMobile}
                      className="opacity-50 data-[status=active]:bg-muted data-[status=active]:opacity-100"
                    />
                  }
                >
                  <ShieldCheckIcon />
                  <span>
                    <T>Authentication</T>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
