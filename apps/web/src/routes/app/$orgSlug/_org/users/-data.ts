import { queryOptions } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { and, desc, eq, inArray, not } from "drizzle-orm"
import * as z from "zod"

import type { OrganizationRole } from "@/lib/auth/permissions"
import { hasOrganizationAccess, type OrganizationAccessOptions } from "@/lib/auth/permissions"
import { organizationMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { MANAGEABLE_ORGANIZATION_ROLES } from "@/lib/static/organization"
import { auth } from "@/server/auth"
import { db } from "@/server/db"
import { invitationsTable, membersTable, usersTable } from "@/server/db/schema"

export const listOrganizationMembersFn = createServerFn({ method: "GET" })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    ensureOrganizationAccess(context.member.role, { roles: ["owner", "admin"] })

    return db
      .select({
        id: membersTable.id,
        role: membersTable.role,
        createdAt: membersTable.createdAt,
        updatedAt: membersTable.updatedAt,
        userId: usersTable.id,
        userName: usersTable.name,
        userEmail: usersTable.email,
        userImage: usersTable.image,
      })
      .from(membersTable)
      .innerJoin(usersTable, eq(usersTable.id, membersTable.userId))
      .where(eq(membersTable.organizationId, context.organization.id))
      .orderBy(usersTable.name, usersTable.email)
  })

export const listOrganizationInvitationsFn = createServerFn({ method: "GET" })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    ensureOrganizationAccess(context.member.role, { permissions: { invitation: ["create", "cancel"] } })

    const invitations = await db
      .select()
      .from(invitationsTable)
      .where(and(eq(invitationsTable.organizationId, context.organization.id), not(eq(invitationsTable.status, "accepted"))))
      .orderBy(desc(invitationsTable.createdAt))

    const inviterIds = [...new Set(invitations.map((invitation) => invitation.inviterId))]
    const inviters =
      inviterIds.length > 0
        ? await db
            .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
            .from(usersTable)
            .where(inArray(usersTable.id, inviterIds))
        : []

    const invitersById = new Map(inviters.map((inviter) => [inviter.id, inviter]))

    return invitations.map((invitation) => ({
      ...invitation,
      inviter: invitersById.get(invitation.inviterId) ?? null,
    }))
  })

export const getOrganizationUsersPageContextFn = createServerFn({ method: "GET" })
  .middleware([organizationMiddleware])
  .handler(({ context }) => {
    const memberRole = context.member.role as OrganizationRole

    return {
      canInviteMembers: hasOrganizationAccess(memberRole, { permissions: { invitation: ["create"] } }),
      canManageMembers: hasOrganizationAccess(memberRole, { permissions: { member: ["update"] } }),
      currentMemberRole: memberRole,
      currentUserId: context.user.id,
    }
  })

export const inviteOrganizationMembersFn = createServerFn({ method: "POST" })
  .middleware([organizationMiddleware])
  .inputValidator(
    parseZod(
      z.object({
        invites: z.array(z.object({ email: z.email().trim().toLowerCase(), role: z.enum(MANAGEABLE_ORGANIZATION_ROLES) })).min(1),
      }),
    ),
  )
  .handler(async ({ context, data }) => {
    ensureOrganizationAccess(context.member.role, { permissions: { invitation: ["create"] } })

    return Promise.all(
      data.invites.map((invite) =>
        auth.api.createInvitation({
          headers: getRequestHeaders(),
          body: { organizationId: context.organization.id, email: invite.email, role: invite.role },
        }),
      ),
    )
  })

export const updateOrganizationMemberRoleFn = createServerFn({ method: "POST" })
  .middleware([organizationMiddleware])
  .inputValidator(
    parseZod(
      z.object({
        memberId: z.string().trim().min(1),
        role: z.enum(["owner", ...MANAGEABLE_ORGANIZATION_ROLES] as [OrganizationRole, ...OrganizationRole[]]),
      }),
    ),
  )
  .handler(({ context, data }) => {
    ensureOrganizationAccess(context.member.role, { permissions: { member: ["update"] } })

    return auth.api.updateMemberRole({
      headers: getRequestHeaders(),
      body: { organizationId: context.organization.id, memberId: data.memberId, role: data.role },
    })
  })

export const removeOrganizationMemberFn = createServerFn({ method: "POST" })
  .middleware([organizationMiddleware])
  .inputValidator(parseZod(z.object({ memberId: z.string().trim().min(1) })))
  .handler(async ({ context, data }) => {
    ensureOrganizationAccess(context.member.role, { permissions: { member: ["delete"] } })

    const member = await db.query.membersTable.findFirst({
      columns: { userId: true },
      where: { id: data.memberId, organizationId: context.organization.id },
    })

    if (!member) throw notFound()

    return auth.api.removeMember({
      headers: getRequestHeaders(),
      body: {
        organizationId: context.organization.id,
        memberIdOrEmail: member.userId,
      },
    })
  })

export const cancelOrganizationInvitationFn = createServerFn({ method: "POST" })
  .middleware([organizationMiddleware])
  .inputValidator(parseZod(z.object({ invitationId: z.string().trim().min(1) })))
  .handler(async ({ context, data }) => {
    ensureOrganizationAccess(context.member.role, { permissions: { invitation: ["cancel"] } })

    const invitation = await db.query.invitationsTable.findFirst({
      columns: { id: true },
      where: { id: data.invitationId, organizationId: context.organization.id },
    })

    if (!invitation) throw notFound()

    return auth.api.cancelInvitation({ headers: getRequestHeaders(), body: { invitationId: data.invitationId } })
  })

export const organizationMembersQueryOptions = (orgSlug: string) =>
  queryOptions({
    queryKey: ["organization-members", orgSlug],
    queryFn: () => listOrganizationMembersFn({ data: { orgSlug } }),
  })

export const organizationInvitationsQueryOptions = (orgSlug: string) =>
  queryOptions({
    queryKey: ["organization-invitations", orgSlug],
    queryFn: () => listOrganizationInvitationsFn({ data: { orgSlug } }),
  })

export const organizationUsersPageContextQueryOptions = (orgSlug: string) =>
  queryOptions({
    queryKey: ["organization-users-page-context", orgSlug],
    queryFn: () => getOrganizationUsersPageContextFn({ data: { orgSlug } }),
  })

function ensureOrganizationAccess(role: string, options: OrganizationAccessOptions) {
  if (!hasOrganizationAccess(role as OrganizationRole, options))
    throw new Error("You do not have access to this organization action.")
}
