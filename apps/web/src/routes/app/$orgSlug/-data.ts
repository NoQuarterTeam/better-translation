import { queryOptions, useSuspenseQuery } from "@tanstack/react-query"
import { redirect, useParams } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders, setCookie } from "@tanstack/react-start/server"
import * as z from "zod"

import type { OrganizationAccessOptions, OrganizationRole } from "@/lib/auth/permissions"
import { hasOrganizationAccess } from "@/lib/auth/permissions"
import { authMiddleware, organizationMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { auth } from "@/server/auth"
import { db } from "@/server/db"
import {
  getSelectedBranchCookieName,
  listOrganizationProjects,
  listUserOrganizations,
  selectedOrganizationCookieName,
  selectedProjectCookieName,
} from "@/server/organizations"

export const currentOrganizationFn = createServerFn({ method: "GET" })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    return {
      user: context.user,
      organization: context.organization,
      member: context.member,
    }
  })

export const listUserOrganizationsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => listUserOrganizations({ id: context.user.id }))

export const listOrganizationProjectsFn = createServerFn({ method: "GET" })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => listOrganizationProjects(context.organization.id))

export const setSelectedOrganizationFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(z.object({ organizationId: z.string().trim().min(1) })))
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

export const setSelectedProjectFn = createServerFn({ method: "POST" })
  .middleware([organizationMiddleware])
  .inputValidator(parseZod(z.object({ projectId: z.string().trim().min(1) })))
  .handler(async ({ context, data }) => {
    const project = await db.query.projectsTable.findFirst({
      columns: { id: true },
      where: { id: data.projectId, organizationId: context.organization.id },
    })

    if (!project) {
      throw redirect({ to: "/app/$orgSlug", params: { orgSlug: data.orgSlug } })
    }

    setCookie(selectedProjectCookieName, data.projectId, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
  })

const branchSwitcherInputSchema = z.object({
  projectSlug: z.string().trim().min(1),
})

export const setSelectedBranchFn = createServerFn({ method: "POST" })
  .middleware([organizationMiddleware])
  .inputValidator(
    parseZod(
      branchSwitcherInputSchema.extend({
        branchName: z.string().trim().min(1),
      }),
    ),
  )
  .handler(async ({ context, data }) => {
    const project = await db.query.projectsTable.findFirst({
      columns: { id: true, publicId: true },
      where: { organizationId: context.organization.id, slug: data.projectSlug },
    })

    if (!project) throw new Error("Project not found.")

    const branch = await db.query.branchesTable.findFirst({
      columns: { name: true },
      where: { archivedAt: { isNull: true }, projectId: project.id, name: data.branchName },
    })

    if (!branch) throw new Error("Branch not found.")

    setCookie(getSelectedBranchCookieName(project.publicId), branch.name, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })

    return branch
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

type CurrentOrganizationAccess = ReturnType<typeof useCurrentOrganization>

export function hasCurrentOrganizationAccess(
  organizationAccess: CurrentOrganizationAccess,
  options: OrganizationAccessOptions = {},
) {
  return hasOrganizationAccess(organizationAccess.member.role as OrganizationRole, options)
}

export function useHasCurrentOrganizationAccess(options: OrganizationAccessOptions = {}) {
  return hasCurrentOrganizationAccess(useCurrentOrganization(), options)
}
