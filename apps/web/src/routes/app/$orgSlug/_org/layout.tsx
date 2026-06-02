import { createFileRoute, Outlet } from "@tanstack/react-router"

import { OrgSidebarSlot } from "./-components/org-sidebar"

export const Route = createFileRoute("/app/$orgSlug/_org")({
  staticData: {
    appShell: {
      sidebar: { Content: OrgSidebarSlot },
    },
  },
  component: Outlet,
})
