import { createFileRoute, Outlet } from "@tanstack/react-router"

import { OrgSwitcherSlot } from "./-components/org-switcher"
import { currentOrganizationQueryOptions } from "./-data"

export const Route = createFileRoute("/app/$orgSlug")({
  staticData: {
    appShell: {
      topBar: { Leading: OrgSwitcherSlot },
    },
  },
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(currentOrganizationQueryOptions(params.orgSlug))
  },
  component: Outlet,
})
