import { Link, useParams } from "@tanstack/react-router"
import { GitBranchIcon, KeyRoundIcon, LanguagesIcon, SettingsIcon } from "lucide-react"

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

export function ProjectSidebar() {
  const { orgSlug, projectSlug } = useParams({ from: "/app/$orgSlug/projects/$projectSlug" })
  const params = useParams({ strict: false })
  const branchName = typeof params.branchName === "string" ? params.branchName : null
  const { isMobile, setOpenMobile } = useSidebar()
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="top-14! h-[calc(100svh-3.5rem)]!">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <T>Project</T>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    branchName ? (
                      <Link
                        to="/app/$orgSlug/projects/$projectSlug/branches/$branchName"
                        params={{ orgSlug, projectSlug, branchName }}
                        onClick={closeMobile}
                        className="opacity-50 data-[status=active]:bg-muted data-[status=active]:opacity-100"
                      />
                    ) : (
                      <Link
                        to="/app/$orgSlug/projects/$projectSlug"
                        params={{ orgSlug, projectSlug }}
                        onClick={closeMobile}
                        className="opacity-50 data-[status=active]:bg-muted data-[status=active]:opacity-100"
                        activeOptions={{ exact: true, includeSearch: false }}
                      />
                    )
                  }
                >
                  <LanguagesIcon />
                  <span>
                    <T>Messages</T>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      to="/app/$orgSlug/projects/$projectSlug/branches"
                      params={{ orgSlug, projectSlug }}
                      onClick={closeMobile}
                      activeOptions={{ exact: true }}
                      className="opacity-50 data-[status=active]:bg-muted data-[status=active]:opacity-100"
                    />
                  }
                >
                  <GitBranchIcon />
                  <span>
                    <T>Branches</T>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      to="/app/$orgSlug/projects/$projectSlug/api-keys"
                      params={{ orgSlug, projectSlug }}
                      onClick={closeMobile}
                      className="opacity-50 data-[status=active]:bg-muted data-[status=active]:opacity-100"
                    />
                  }
                >
                  <KeyRoundIcon />
                  <span>
                    <T>API keys</T>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      to="/app/$orgSlug/projects/$projectSlug/settings"
                      params={{ orgSlug, projectSlug }}
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
