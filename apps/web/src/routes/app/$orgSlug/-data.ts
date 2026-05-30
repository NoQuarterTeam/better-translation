import { queryOptions, useSuspenseQuery } from "@tanstack/react-query"
import { redirect, useParams } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders, setCookie } from "@tanstack/react-start/server"
import * as z from "zod"

import { authMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { auth } from "@/server/auth"
import {
  getCurrentOrganizationAccess,
  getDefaultOrganizationForUser,
  listOrganizationProjects,
  listUserOrganizations,
  selectedOrganizationCookieName,
  selectedProjectCookieName,
} from "@/server/organizations"

const organizationInputSchema = z.object({ orgSlug: z.string().trim().min(1) })

export const currentOrganizationFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(organizationInputSchema))
  .handler(async ({ context, data }) => {
    const organizationAccess = await getCurrentOrganizationAccess({ slug: data.orgSlug, userId: context.user.id })

    if (!organizationAccess) {
      const defaultOrganization = await getDefaultOrganizationForUser({ id: context.user.id })
      if (!defaultOrganization) throw redirect({ to: "/app/create-org" })
      throw redirect({ to: "/app/$orgSlug", params: { orgSlug: defaultOrganization.slug } })
    }

    return {
      user: context.user,
      organization: organizationAccess.organization,
      member: organizationAccess.member,
    }
  })

export const listUserOrganizationsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => listUserOrganizations({ id: context.user.id }))

export const listOrganizationProjectsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(organizationInputSchema))
  .handler(async ({ context, data }) => {
    const organizationAccess = await getCurrentOrganizationAccess({ slug: data.orgSlug, userId: context.user.id })
    if (!organizationAccess) throw redirect({ to: "/app" })
    return listOrganizationProjects(organizationAccess.organization.id)
  })

export const setSelectedOrganizationFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(z.object({ organizationId: z.number().int().positive() })))
  .handler(async ({ context, data }) => {
    const organizations = await listUserOrganizations({ id: context.user.id })
    if (!organizations.some((organization) => organization.id === data.organizationId)) throw redirect({ to: "/app" })

    await auth.api.setActiveOrganization({
      headers: getRequestHeaders(),
      body: { organizationId: String(data.organizationId) },
    })

    setCookie(selectedOrganizationCookieName, String(data.organizationId), {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
  })

export const setSelectedProjectFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(z.object({ orgSlug: organizationInputSchema.shape.orgSlug, projectId: z.number().int().positive() })))
  .handler(async ({ context, data }) => {
    const organizationAccess = await getCurrentOrganizationAccess({ slug: data.orgSlug, userId: context.user.id })
    if (!organizationAccess) throw redirect({ to: "/app" })
    const projects = await listOrganizationProjects(organizationAccess.organization.id)
    if (!projects.some((project) => project.id === data.projectId))
      throw redirect({ to: "/app/$orgSlug", params: { orgSlug: data.orgSlug } })

    setCookie(selectedProjectCookieName, String(data.projectId), {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
  })

export const currentOrganizationQueryOptions = (orgSlug: string) =>
  queryOptions({
    queryKey: ["current-organization", orgSlug],
    queryFn: () => currentOrganizationFn({ data: { orgSlug } }),
    staleTime: 30_000,
  })

export const userOrganizationsQueryOptions = () =>
  queryOptions({
    queryKey: ["user-organizations"],
    queryFn: listUserOrganizationsFn,
    staleTime: 30_000,
  })

export const organizationProjectsQueryOptions = (orgSlug: string) =>
  queryOptions({
    queryKey: ["organization-projects", orgSlug],
    queryFn: () => listOrganizationProjectsFn({ data: { orgSlug } }),
    staleTime: 30_000,
  })

export function useCurrentOrganization() {
  const { orgSlug } = useParams({ from: "/app/$orgSlug" })
  return useSuspenseQuery(currentOrganizationQueryOptions(orgSlug)).data
}
