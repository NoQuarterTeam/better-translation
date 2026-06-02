import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, useParams } from "@tanstack/react-router"
import { GitBranchIcon, KeyRoundIcon, LanguagesIcon, SettingsIcon } from "lucide-react"
import { Suspense } from "react"

import { T } from "better-translation/react"

import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"

import { projectBranchRedirectNameQueryOptions } from "../-data"

export function ProjectSidebarSlot() {
  return (
    <Suspense fallback={<ProjectSidebarFallback />}>
      <ProjectSidebarContent />
    </Suspense>
  )
}

function ProjectSidebarContent() {
  const { orgSlug, projectSlug } = useParams({ from: "/app/$orgSlug/_projects/$projectSlug" })
  const params = useParams({ strict: false })
  const branchName = typeof params.branchName === "string" ? params.branchName : null
  const redirectBranchName = useSuspenseQuery(projectBranchRedirectNameQueryOptions(orgSlug, projectSlug)).data
  const messagesBranchName = branchName ?? redirectBranchName
  const { isMobile, setOpenMobile } = useSidebar()
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
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
                  messagesBranchName ? (
                    <Link
                      to="/app/$orgSlug/$projectSlug/$branchName"
                      params={{ orgSlug, projectSlug, branchName: messagesBranchName }}
                      onClick={closeMobile}
                      className="opacity-50 data-[status=active]:bg-muted data-[status=active]:opacity-100"
                    />
                  ) : (
                    <Link
                      to="/app/$orgSlug/$projectSlug"
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
                    to="/app/$orgSlug/$projectSlug/branches"
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
                    to="/app/$orgSlug/$projectSlug/api-keys"
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
                    to="/app/$orgSlug/$projectSlug/settings"
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
  )
}

function ProjectSidebarFallback() {
  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>
          <T>Project</T>
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {Array.from({ length: 4 }).map((_, index) => (
              <SidebarMenuItem key={index}>
                <div className="flex h-8 items-center gap-2 rounded-md px-2">
                  <Skeleton className="size-4 rounded-sm" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}
