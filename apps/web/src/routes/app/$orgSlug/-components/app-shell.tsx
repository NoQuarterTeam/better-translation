import { Outlet } from "@tanstack/react-router"
import type { ReactNode } from "react"

import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

import { NavUser } from "./nav-user"
import { OrgSwitcher } from "./org-switcher"

export function AppShell({
  branchSwitcher,
  projectSwitcher,
  sidebar,
}: {
  branchSwitcher?: ReactNode
  projectSwitcher?: ReactNode
  sidebar: ReactNode
}) {
  return (
    <TooltipProvider delay={0}>
      <SidebarProvider className="flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-background">
        <header className="flex h-14 w-full shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger className="-ml-2 md:hidden" />
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border text-sm font-semibold">BT</div>
            <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-6" />
            <OrgSwitcher />
            {projectSwitcher && (
              <>
                <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-6" />
                {projectSwitcher}
              </>
            )}
            {branchSwitcher && (
              <>
                <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-6" />
                {branchSwitcher}
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <NavUser />
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          {sidebar}
          <SidebarInset className="flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto overscroll-contain">
              <Outlet />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}
