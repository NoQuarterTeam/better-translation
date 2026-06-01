import { createFileRoute, Outlet } from "@tanstack/react-router"

import { currentOrganizationQueryOptions, organizationProjectsQueryOptions } from "./-data"

export const Route = createFileRoute("/app/$orgSlug")({
  beforeLoad: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(currentOrganizationQueryOptions(params.orgSlug)),
      context.queryClient.ensureQueryData(organizationProjectsQueryOptions(params.orgSlug)),
    ])
  },
  component: Outlet,
})
