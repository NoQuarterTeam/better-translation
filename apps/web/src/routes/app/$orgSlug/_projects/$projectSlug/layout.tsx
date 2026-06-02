import { createFileRoute, Outlet } from "@tanstack/react-router"

import { ProjectSidebarSlot } from "./-components/project-sidebar"
import { ProjectSwitcherSlot } from "./-components/project-switcher"
import { currentProjectSwitcherQueryOptions, projectBranchRedirectNameQueryOptions } from "./-data"

export const Route = createFileRoute("/app/$orgSlug/_projects/$projectSlug")({
  staticData: {
    appShell: {
      sidebar: { Content: ProjectSidebarSlot },
      topBar: { ProjectSwitcher: ProjectSwitcherSlot },
    },
  },
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(currentProjectSwitcherQueryOptions(params.orgSlug, params.projectSlug))
    void context.queryClient.prefetchQuery(projectBranchRedirectNameQueryOptions(params.orgSlug, params.projectSlug))
  },
  component: Outlet,
})
