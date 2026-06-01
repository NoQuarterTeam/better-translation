import { createFileRoute, Outlet, useParams } from "@tanstack/react-router"

import { DefaultError } from "@/components/default-error"
import { Separator } from "@/components/ui/separator"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

import { BranchSwitcher } from "./-components/branch-switcher"
import { NavUser } from "./-components/nav-user"
import { OrgSwitcher } from "./-components/org-switcher"
import { ProjectSwitcher } from "./-components/project-switcher"
import { currentOrganizationQueryOptions, organizationProjectsQueryOptions } from "./-data"

export const Route = createFileRoute("/app/$orgSlug")({
  beforeLoad: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(currentOrganizationQueryOptions(params.orgSlug)),
      context.queryClient.ensureQueryData(organizationProjectsQueryOptions(params.orgSlug)),
    ])
  },
  component: OrganizationLayout,
  errorComponent: (p) => (
    <div className="h-dvh w-screen">
      <DefaultError {...p} />
    </div>
  ),
})

function OrganizationLayout() {
  const params = useParams({ strict: false })
  const projectSlug = typeof params.projectSlug === "string" ? params.projectSlug : null
  const branchName = typeof params.branchName === "string" ? params.branchName : null

  return (
    <TooltipProvider delay={0}>
      <SidebarProvider className="flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-background">
        <header className="flex h-14 w-full shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
          <div className="flex h-full min-w-0 items-center gap-1">
            <SidebarTrigger className="-ml-2 md:hidden" />
            <OrgSwitcher />
            {projectSlug && (
              <>
                <SwitcherSeparator />
                <ProjectSwitcher />
                {branchName && (
                  <>
                    <SwitcherSeparator />
                    <BranchSwitcher />
                  </>
                )}
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

function SwitcherSeparator() {
  return (
    <Separator
      orientation="vertical"
      className="mx-1 origin-center rotate-12 data-[orientation=vertical]:h-7 data-[orientation=vertical]:self-center"
    />
  )
}
