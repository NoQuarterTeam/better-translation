import { queryOptions } from "@tanstack/react-query"
import { createFileRoute, Outlet } from "@tanstack/react-router"

import { createTranslator } from "better-translation/server"

import { DefaultError } from "@/components/default-error"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

import { DashboardBreadcrumbs } from "./-components/dashboard-breadcrumbs"
import { DashboardSidebar } from "./-components/dashboard-sidebar"
import { NavUser } from "./-components/nav-user"
import { getCurrentUserFn } from "./-data"

export const currentUserQueryOptions = () => queryOptions({ queryKey: ["current-user"], queryFn: getCurrentUserFn })

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayoutShell,
  errorComponent: (p) => (
    <div className="h-dvh w-screen">
      <DefaultError {...p} />
    </div>
  ),
  ssr: false,
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("Dashboard")} · Better Translation` }] }
  },
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(currentUserQueryOptions())
    return { user }
  },
})

function DashboardLayoutShell() {
  return (
    <TooltipProvider delay={0}>
      <SidebarProvider>
        <div className="flex h-dvh w-full overflow-hidden">
          <DashboardSidebar />
          <SidebarInset className="flex flex-col overflow-hidden">
            <header className="z-30 flex h-16 w-full shrink-0 items-center justify-between gap-2 border-b bg-background px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mt-2 mr-2 data-[orientation=vertical]:h-4" />
                <DashboardBreadcrumbs />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <NavUser />
              </div>
            </header>
            <div className="flex-1 overflow-auto overscroll-contain">
              <Outlet />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}
