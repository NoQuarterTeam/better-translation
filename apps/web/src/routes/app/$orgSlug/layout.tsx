import { createFileRoute, Outlet } from "@tanstack/react-router"

import { DefaultError } from "@/components/default-error"

import { currentOrganizationQueryOptions } from "./-data"

export const organizationQueryOptions = (orgSlug: string) => currentOrganizationQueryOptions(orgSlug)

export const Route = createFileRoute("/app/$orgSlug")({
  beforeLoad: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(organizationQueryOptions(params.orgSlug))
  },
  component: Outlet,
  errorComponent: (p) => (
    <div className="h-dvh w-screen">
      <DefaultError {...p} />
    </div>
  ),
})
