import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Outlet, useParams } from "@tanstack/react-router"

import { DefaultError } from "@/components/default-error"
import { Separator } from "@/components/ui/separator"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

import { NavUser } from "./-components/nav-user"
import { OrgSwitcher } from "./-components/org-switcher"
import { ProjectSwitcher } from "./-components/project-switcher"
import { currentOrganizationQueryOptions } from "./-data"
import { projectDetailQueryOptions } from "./projects/$projectId/-data"

export const organizationQueryOptions = (orgSlug: string) => currentOrganizationQueryOptions(orgSlug)

export const Route = createFileRoute("/app/$orgSlug")({
  beforeLoad: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(organizationQueryOptions(params.orgSlug))
  },
  component: OrganizationLayout,
  errorComponent: (p) => (
    <div className="h-dvh w-screen">
      <DefaultError {...p} />
    </div>
  ),
})

function OrganizationLayout() {
  const { orgSlug } = Route.useParams()
  const params = useParams({ strict: false })
  const projectId = typeof params.projectId === "string" ? params.projectId : null
  const projectQuery = useQuery({
    ...projectDetailQueryOptions(orgSlug, projectId ?? ""),
    enabled: Boolean(projectId),
  })
  const project = projectQuery.data?.project

  return (
    <TooltipProvider delay={0}>
      <SidebarProvider className="flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-background">
        <header className="flex h-14 w-full shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
          <div className="flex h-full min-w-0 items-center gap-1">
            <SidebarTrigger className="-ml-2 md:hidden" />
            <OrgSwitcher />
            {project && (
              <>
                <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-14" />
                <ProjectSwitcher project={project} />
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <NavUser />
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <Outlet />
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}
