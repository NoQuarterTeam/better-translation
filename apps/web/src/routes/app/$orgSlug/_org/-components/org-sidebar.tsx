import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@better-translation/ui/components/sidebar"
import { Link, useParams } from "@tanstack/react-router"
import { BoxesIcon, SettingsIcon, UsersIcon } from "lucide-react"

import { T } from "better-translation/react"

export function OrgSidebarSlot() {
  return <OrgSidebarContent />
}

function OrgSidebarContent() {
  const { orgSlug } = useParams({ from: "/app/$orgSlug" })
  const { isMobile, setOpenMobile } = useSidebar()
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
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
                    activeOptions={{ exact: true }}
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
  )
}
