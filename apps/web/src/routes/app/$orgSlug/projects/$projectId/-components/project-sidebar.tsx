import { Link, useParams } from "@tanstack/react-router"
import { KeyRoundIcon, LanguagesIcon, SettingsIcon } from "lucide-react"

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

import { type getProjectDetailFn } from "../-data"
import { BranchSwitcher } from "./branch-switcher"

type ProjectDetail = Awaited<ReturnType<typeof getProjectDetailFn>>

export function ProjectSidebar({
  branches,
  currentBranchName,
}: {
  branches: ProjectDetail["branches"]
  currentBranchName: string
}) {
  const { orgSlug, projectId } = useParams({ from: "/app/$orgSlug/projects/$projectId" })
  const { isMobile, setOpenMobile } = useSidebar()
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="!top-14 !h-[calc(100svh-3.5rem)]">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <T>Branch</T>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <BranchSwitcher branches={branches} currentBranchName={currentBranchName} onNavigate={closeMobile} />
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      to="/app/$orgSlug/projects/$projectId/branches/$branchName"
                      params={{ orgSlug, projectId, branchName: currentBranchName }}
                      onClick={closeMobile}
                      className="opacity-50 data-[status=active]:bg-muted data-[status=active]:opacity-100"
                    />
                  }
                >
                  <LanguagesIcon />
                  <span>
                    <T>Messages</T>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>
            <T>Project</T>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      to="/app/$orgSlug/projects/$projectId/api-keys"
                      params={{ orgSlug, projectId }}
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
                      to="/app/$orgSlug/projects/$projectId/settings"
                      params={{ orgSlug, projectId }}
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
