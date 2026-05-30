import { Link, useParams } from "@tanstack/react-router"
import { BoxesIcon, Building2Icon, SettingsIcon, UsersIcon } from "lucide-react"

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

export function OrgSidebar() {
  const { orgSlug } = useParams({ from: "/app/$orgSlug" })
  const { isMobile, setOpenMobile } = useSidebar()
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="!top-14 !h-[calc(100svh-3.5rem)]">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <T>Organization</T>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      to="/app/$orgSlug"
                      params={{ orgSlug }}
                      onClick={closeMobile}
                      className="opacity-50 data-[status=active]:bg-muted data-[status=active]:opacity-100"
                      activeOptions={{ exact: true, includeSearch: false }}
                    />
                  }
                >
                  <Building2Icon />
                  <span>
                    <T>Organization</T>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      to="/app/$orgSlug/projects"
                      params={{ orgSlug }}
                      onClick={closeMobile}
                      className="opacity-50 data-[status=active]:bg-muted data-[status=active]:opacity-100"
                    />
                  }
                >
                  <BoxesIcon />
                  <span>
                    <T>Projects</T>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      to="/app/$orgSlug/users"
                      params={{ orgSlug }}
                      onClick={closeMobile}
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
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      to="/app/$orgSlug/settings"
                      params={{ orgSlug }}
                      onClick={closeMobile}
                      className="opacity-50 data-[status=active]:bg-muted data-[status=active]:opacity-100"
                    />
                  }
                >
                  <SettingsIcon />
                  <span>
                    <T>Settings</T>
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
