import { Separator } from "@better-translation/ui/components/separator"
import { Sidebar, SidebarInset, SidebarProvider, SidebarTrigger } from "@better-translation/ui/components/sidebar"
import { TooltipProvider } from "@better-translation/ui/components/tooltip"
import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router"

import { DefaultError } from "@/components/default-error"

import { NavUser } from "./-components/nav-user"

export const Route = createFileRoute("/app")({
  component: AppLayout,
  errorComponent: (p) => (
    <div className="h-dvh w-screen">
      <DefaultError {...p} />
    </div>
  ),
})

function AppLayout() {
  const shell = useMatches({
    select: (matches) => {
      const nearestMatches = [...matches].reverse()

      return {
        BranchSwitcher: nearestMatches.find((match) => match.staticData.appShell?.topBar?.BranchSwitcher)?.staticData.appShell
          ?.topBar?.BranchSwitcher,
        Leading: nearestMatches.find((match) => match.staticData.appShell?.topBar?.Leading)?.staticData.appShell?.topBar?.Leading,
        ProjectSwitcher: nearestMatches.find((match) => match.staticData.appShell?.topBar?.ProjectSwitcher)?.staticData.appShell
          ?.topBar?.ProjectSwitcher,
        SidebarContent: nearestMatches.find((match) => match.staticData.appShell?.sidebar?.Content)?.staticData.appShell?.sidebar
          ?.Content,
      }
    },
  })

  const ProjectSwitcher = shell.ProjectSwitcher
  const BranchSwitcher = shell.BranchSwitcher
  const Leading = shell.Leading
  const SidebarContent = shell.SidebarContent

  return (
    <TooltipProvider delay={0}>
      <SidebarProvider className="flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-background">
        <header className="flex h-14 w-full shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
          <div className="flex h-full min-w-0 items-center gap-0.5 sm:gap-1">
            {SidebarContent && <SidebarTrigger className="-ml-2 md:hidden" />}
            {Leading && <Leading />}
            {ProjectSwitcher && (
              <>
                <SwitcherSeparator />
                <ProjectSwitcher />
              </>
            )}
            {BranchSwitcher && (
              <>
                <SwitcherSeparator />
                <BranchSwitcher />
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <NavUser />
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          {SidebarContent ? (
            <>
              <Sidebar collapsible="icon" variant="sidebar" className="top-14! h-[calc(100svh-3.5rem)]!">
                <SidebarContent />
              </Sidebar>
              <SidebarInset className="flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto overscroll-contain">
                  <Outlet />
                </div>
              </SidebarInset>
            </>
          ) : (
            <main className="min-h-0 flex-1 overflow-auto overscroll-contain">
              <Outlet />
            </main>
          )}
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}

function SwitcherSeparator() {
  return (
    <Separator
      orientation="vertical"
      className="mx-1 hidden origin-center rotate-12 data-[orientation=vertical]:h-7 data-[orientation=vertical]:self-center sm:block"
    />
  )
}
