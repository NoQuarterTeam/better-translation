import { redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"

import { authMiddleware } from "@/lib/functions/middleware"
import { getDefaultOrganizationForUser } from "@/server/organizations"

export const getDefaultOrganizationSlugFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const organization = await getDefaultOrganizationForUser({ id: context.user.id })
    if (!organization) throw redirect({ to: "/app/create-org" })
    return organization.slug
  })
