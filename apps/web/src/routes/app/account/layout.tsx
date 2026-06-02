import { createFileRoute, Outlet } from "@tanstack/react-router"

import { AccountBackSlot } from "./-components/account-back"
import { AccountSidebarSlot } from "./-components/account-sidebar"

export const Route = createFileRoute("/app/account")({
  staticData: {
    appShell: {
      sidebar: { Content: AccountSidebarSlot },
      topBar: { Leading: AccountBackSlot },
    },
  },
  component: Outlet,
})
