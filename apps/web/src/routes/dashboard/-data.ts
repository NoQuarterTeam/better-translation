import { redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import { authMiddleware } from "@/lib/functions/middleware"
import { auth } from "@/server/auth"
import { db } from "@/server/db"
import { signOut } from "@/server/sessions"

export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  await signOut()
  throw redirect({ to: "/sign-in" })
})

export const getCurrentUserFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const headers = getRequestHeaders()
    const organizations = (await auth.api.listOrganizations({ headers })) ?? []

    if (organizations.length === 0) throw redirect({ to: "/create-org" })

    let activeOrganizationId = context.session.activeOrganizationId

    if (
      !activeOrganizationId ||
      !organizations.some((organization) => Number(organization.id) === Number(activeOrganizationId))
    ) {
      const firstOrganization = organizations[0]
      if (!firstOrganization) throw redirect({ to: "/create-org" })
      await auth.api.setActiveOrganization({ headers, body: { organizationId: firstOrganization.id } })
      activeOrganizationId = firstOrganization.id
    }

    const activeOrganization = await db.query.organizationsTable.findFirst({ where: { id: Number(activeOrganizationId) } })

    if (!activeOrganization) throw redirect({ to: "/create-org" })

    return { ...context.user, activeOrganization }
  })
