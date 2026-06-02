import { createFileRoute, Outlet } from "@tanstack/react-router"

import { ProfileBackSlot } from "./-components/profile-back"
import { ProfileSidebarSlot } from "./-components/profile-sidebar"

export const Route = createFileRoute("/app/profile")({
  staticData: {
    appShell: {
      sidebar: { Content: ProfileSidebarSlot },
      topBar: { Leading: ProfileBackSlot },
    },
  },
  component: Outlet,
})
