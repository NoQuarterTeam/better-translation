import { createFileRoute, redirect } from "@tanstack/react-router"

import { getDefaultOrganizationSlugFn } from "./-data"

export const Route = createFileRoute("/app/")({
  beforeLoad: async () => {
    const orgSlug = await getDefaultOrganizationSlugFn()
    throw redirect({ to: "/app/$orgSlug", params: { orgSlug } })
  },
})
