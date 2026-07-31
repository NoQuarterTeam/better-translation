import { notFound, redirect } from "@tanstack/react-router"
import { createMiddleware } from "@tanstack/react-start"
import * as z from "zod"

import { db } from "@/server/db"
import { getDefaultOrganizationForUser } from "@/server/organizations"
import { ensureSession } from "@/server/sessions"

import { parseZod } from "./zod"

export const authMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const session = await ensureSession()
  const user = await db.query.usersTable.findFirst({ where: { id: session.user.id } })

  if (!user) throw redirect({ to: "/sign-in" })

  return next({ context: { ...session, user } })
})

export const organizationMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .validator(parseZod(z.object({ orgSlug: z.string().trim().min(1) }).loose()))
  .server(async ({ next, context, data }) => {
    const organizationAccess = await getCurrentOrganizationAccess({ slug: data.orgSlug, userId: context.user.id })

    if (!organizationAccess) {
      const defaultOrganization = await getDefaultOrganizationForUser({ id: context.user.id })
      if (!defaultOrganization) throw redirect({ to: "/app/create-org" })
      throw redirect({ to: "/app/$orgSlug", params: { orgSlug: defaultOrganization.slug } })
    }

    return next({
      context: { ...context, organization: organizationAccess.organization, member: organizationAccess.member },
    })
  })

export const projectMiddleware = createMiddleware({ type: "function" })
  .middleware([organizationMiddleware])
  .validator(parseZod(z.object({ projectSlug: z.string().trim().min(1) }).loose()))
  .server(async ({ next, context, data }) => {
    const project = await db.query.projectsTable.findFirst({
      where: { slug: data.projectSlug, organizationId: context.organization.id },
    })

    if (!project) throw notFound()

    return next({ context: { ...context, project } })
  })

export const adminMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    if (!context.user.isAdmin) throw redirect({ to: "/app" })

    return next({
      context: { ...context, user: { ...context.user, isAdmin: true as const } },
    })
  })

async function getCurrentOrganizationAccess(params: { slug: string; userId: string }) {
  const organization = await db.query.organizationsTable.findFirst({ where: { slug: params.slug } })

  if (!organization) return null

  const member = await db.query.membersTable.findFirst({
    columns: { id: true, role: true },
    where: { organizationId: organization.id, userId: params.userId },
  })

  if (!member) return null

  return { organization, member }
}
