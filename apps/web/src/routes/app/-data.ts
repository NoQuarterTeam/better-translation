import { queryOptions } from "@tanstack/react-query"
import { redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders, setCookie } from "@tanstack/react-start/server"
import * as z from "zod"

import { authMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { auth } from "@/server/auth"
import { getDefaultOrganizationForUser, listUserOrganizations, selectedOrganizationCookieName } from "@/server/organizations"

export const getDefaultOrganizationSlugFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const organization = await getDefaultOrganizationForUser({ id: context.user.id })
    if (!organization) throw redirect({ to: "/app/create-org" })
    return organization.slug
  })

export const listUserOrganizationsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => listUserOrganizations({ id: context.user.id }))

export const setSelectedOrganizationFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseZod(z.object({ organizationId: z.string().trim().min(1) })))
  .handler(async ({ context, data }) => {
    const organizations = await listUserOrganizations({ id: context.user.id })
    if (!organizations.some((organization) => organization.id === data.organizationId)) throw redirect({ to: "/app" })

    await auth.api.setActiveOrganization({
      headers: getRequestHeaders(),
      body: { organizationId: data.organizationId },
    })

    setCookie(selectedOrganizationCookieName, data.organizationId, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
  })

export const userOrganizationsQueryOptions = () =>
  queryOptions({
    queryKey: ["user-organizations"],
    queryFn: listUserOrganizationsFn,
    staleTime: 30_000,
  })
